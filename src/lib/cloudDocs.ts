// How synced data is laid out in Firestore, split so no document gets near the 1 MiB limit:
//
//   users/{uid}                    { layout: 2, inspection, algs, order: [sessionId…], updatedAt }
//   users/{uid}/sessions/{id}      { name, createdAt, puzzle?, cube?, goal?, rounds?, chunks }
//   users/{uid}/chunks/{id}_{k}    { sid, k, solves: [ …up to CHUNK solves ] }
//   users/{uid}/trainer/times      { times: { caseId: [ms…] }, timesAt: { caseId: ms } }
//
// Chunk k holds solves k·CHUNK … (k+1)·CHUNK−1 of the session, so adding a solve rewrites only the
// last chunk, and a session can hold any number of solves.
//
// Before layout 2, everything sat in users/{uid} as { sessions: Session[], inspection, algs }.
// fromDocs still reads that, and the next write moves it into the layout above.
//
// Paths here are relative to users/{uid}: "user", "sessions/{id}", "chunks/{id}_{k}", "trainer/times".

import { mergeSessions, type Session } from "./sessions";
import type { Solve } from "./stats";
import { readCloudAlgPrefs, type AlgPrefs } from "./algPrefs";
import { readRecord, type RoundRecord } from "./mockComp";
import { readCloudTrainer, type TrainerTimes } from "./trainer";

export const CHUNK = 1000;
export const TRAINER = "trainer/times";

export interface SyncState { sessions: Session[]; inspection: boolean; algs: AlgPrefs; trainer: TrainerTimes }

// JSON with object keys sorted, so the same data always compares equal whatever order Firestore
// returns map fields in.
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => val && typeof val === "object" && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
    : val);
}

type Doc = Record<string, unknown>;

// Everything the state should look like in Firestore, keyed by relative path. The user document
// comes last, so when writes are split into several batches it lands after the sessions it lists.
export function toDocs(state: SyncState): Map<string, Doc> {
  const docs = new Map<string, Doc>();
  for (const s of state.sessions) {
    const chunks = Math.ceil(s.solves.length / CHUNK);
    const meta: Doc = { name: s.name, createdAt: s.createdAt, chunks };
    if (s.puzzle) meta.puzzle = s.puzzle;
    if (s.cube) meta.cube = s.cube;
    if (s.goal) meta.goal = s.goal;
    if (s.rounds?.length) meta.rounds = s.rounds;
    docs.set(`sessions/${s.id}`, meta);
    for (let k = 0; k < chunks; k++) {
      docs.set(`chunks/${s.id}_${k}`, { sid: s.id, k, solves: s.solves.slice(k * CHUNK, (k + 1) * CHUNK) });
    }
  }
  if (Object.keys(state.trainer.times).length) docs.set(TRAINER, { times: state.trainer.times, timesAt: state.trainer.timesAt });
  docs.set("user", { layout: 2, inspection: state.inspection, algs: state.algs, order: state.sessions.map(s => s.id) });
  return docs;
}

export interface Remote {
  exists: boolean; // the user document exists
  sessions: Session[] | null; // null: nothing stored yet
  inspection: boolean;
  algs: AlgPrefs | null;
  trainer: TrainerTimes | null; // null: none stored yet
  legacy: boolean; // still in the old single-document layout
  complete: boolean; // every chunk the session documents mention is present
}

// Rebuild the state from the user document plus every session and chunk document.
export function fromDocs(user: Doc | null, sessionDocs: [string, Doc][], chunkDocs: Doc[], trainerDoc: Doc | null = null): Remote {
  const base = { exists: !!user, inspection: !!user?.inspection, algs: readCloudAlgPrefs(user?.algs), trainer: readCloudTrainer(trainerDoc) };
  if (!user) return { ...base, sessions: null, legacy: false, complete: true };
  const legacySessions = Array.isArray(user.sessions) ? (user.sessions as Session[]) : null;
  if (user.layout !== 2 && !sessionDocs.length) return { ...base, sessions: legacySessions, legacy: true, complete: true };

  const chunks = new Map<string, Solve[]>();
  for (const c of chunkDocs) {
    if (typeof c.sid === "string" && typeof c.k === "number" && Array.isArray(c.solves)) chunks.set(`${c.sid}_${c.k}`, c.solves as Solve[]);
  }
  let complete = true;
  const byId = new Map<string, Session>();
  for (const [id, d] of sessionDocs) {
    const solves: Solve[] = [];
    const n = typeof d.chunks === "number" ? d.chunks : 0;
    for (let k = 0; k < n; k++) {
      const part = chunks.get(`${id}_${k}`);
      if (!part) { complete = false; break; }
      solves.push(...part);
    }
    const s: Session = { id, name: String(d.name ?? "Session"), createdAt: Number(d.createdAt) || 0, solves };
    if (typeof d.puzzle === "string") s.puzzle = d.puzzle as Session["puzzle"];
    if (typeof d.cube === "string" && d.cube) s.cube = d.cube;
    if (typeof d.goal === "number" && d.goal > 0) s.goal = d.goal;
    if (Array.isArray(d.rounds)) {
      const rounds = d.rounds.map(readRecord).filter((r): r is RoundRecord => !!r);
      if (rounds.length) s.rounds = rounds;
    }
    byId.set(id, s);
  }
  // Listed order first; anything the list doesn't know about (written mid-update) after, oldest first.
  const order = Array.isArray(user.order) ? (user.order as string[]) : [];
  const listed = order.map(id => byId.get(id)).filter((s): s is Session => !!s);
  const rest = [...byId.values()].filter(s => !order.includes(s.id)).sort((a, b) => a.createdAt - b.createdAt);
  const split = [...listed, ...rest];
  // The split documents exist but the user document is in the old layout: an older copy of the
  // app (not yet updated) rewrote it. Keep the split data and add anything extra it saved, rather
  // than letting it replace everything; the next write puts the user document right again.
  if (user.layout !== 2) {
    return { ...base, sessions: legacySessions ? mergeSessions(split, legacySessions, 0) : split, legacy: true, complete };
  }
  return { ...base, sessions: split, legacy: false, complete };
}

// What to write so Firestore matches `desired`, given what it holds now (`known`: path → stable
// JSON of the document, without updatedAt). Sets come in `desired` order, deletes after them.
export function diffDocs(known: Map<string, string>, desired: Map<string, Doc>) {
  const sets: [string, Doc][] = [];
  for (const [path, data] of desired) if (known.get(path) !== stable(data)) sets.push([path, data]);
  const deletes = [...known.keys()].filter(p => !desired.has(p));
  return { sets, deletes };
}

// Split writes into batches Firestore accepts (at most 500 writes, about 10 MiB per request),
// keeping the user document in the last batch.
export function toBatches(sets: [string, Doc][], deletes: string[], maxOps = 400, maxBytes = 4_000_000) {
  type Op = { path: string; data?: Doc };
  const ops: Op[] = [...sets.filter(([p]) => p !== "user").map(([path, data]) => ({ path, data })), ...deletes.map(path => ({ path }))];
  const user = sets.find(([p]) => p === "user");
  if (user) ops.push({ path: "user", data: user[1] });
  const batches: Op[][] = [];
  let cur: Op[] = [], bytes = 0;
  for (const op of ops) {
    const size = op.data ? JSON.stringify(op.data).length : 100;
    if (cur.length && (cur.length >= maxOps || bytes + size > maxBytes)) { batches.push(cur); cur = []; bytes = 0; }
    cur.push(op); bytes += size;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
