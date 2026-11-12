// Import solves from a csTimer export (Export → "Export to file", a .txt file of JSON).
//
// The file looks like:
//   { "session1": [ [[penalty, time, ...splits], scramble, comment, unixSeconds], ... ],
//     "session2": [...],
//     "properties": { "sessionData": "{\"1\":{\"name\":\"Main\",\"opt\":{\"scrType\":\"333\"},\"rank\":1}, ...}" } }
// penalty is 0, 2000 (+2) or -1 (DNF); time is in ms without the penalty. sessionData is a JSON
// string in most versions and an object in some. opt only lists non-default options, so a missing
// scrType means 3×3.

import { newSession, type Session } from "./sessions";
import { toPuzzle, type PuzzleId } from "./puzzles";
import { DNF, type Penalty, type Solve } from "./stats";

export interface ImportResult {
  sessions: Session[]; // the full list after the import
  added: { name: string; puzzle: PuzzleId; solves: number; merged: boolean }[];
  skipped: { name: string; reason: string; solves: number }[];
}

// csTimer scramble types → puzzles here. FMC times are move counts, so they're left out.
function puzzleFor(scrType: unknown): PuzzleId | null {
  const t = typeof scrType === "string" ? scrType : "333";
  if (t === "333fm") return null;
  if (t.startsWith("333")) return "333";
  if (t.startsWith("222")) return "222";
  if (t.startsWith("444")) return "444";
  if (t === "fto") return "fto";
  return null;
}

function toSolve(raw: unknown): Solve | null {
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null;
  const [pen, time] = raw[0];
  if (typeof pen !== "number" || typeof time !== "number" || time < 0) return null;
  const at = typeof raw[3] === "number" ? raw[3] * 1000 : 0;
  const scr = typeof raw[1] === "string" ? raw[1].trim() : "";
  // Any other penalty (csTimer allows custom ones) is folded into the time.
  let t = time, p: Penalty = 0;
  if (pen === -1) p = DNF;
  else if (pen === 2000) p = 2;
  else if (pen > 0) t += pen;
  return { t: Math.round(t), pen: p, scr, at };
}

// csTimer keeps dates to the second, so compare at that precision: a file exported from here and
// imported back then matches the solves it came from.
const solveKey = (s: Solve) => `${Math.round(s.at / 1000)}:${s.t}`;

// Export every session as a csTimer file (the same format importCsTimer reads), so it can be
// imported into csTimer, or back into this app on another device.
const SCR_TYPE: Record<PuzzleId, string> = { "333": "333", "222": "222so", "444": "444wca", fto: "fto" };

export function exportCsTimer(sessions: Session[]): string {
  const data: Record<string, unknown> = {};
  const meta: Record<string, unknown> = {};
  sessions.forEach((s, i) => {
    const id = i + 1;
    data[`session${id}`] = s.solves.map(v => [
      [v.pen === DNF ? -1 : v.pen === 2 ? 2000 : 0, v.t], v.scr, "", Math.round(v.at / 1000),
    ]);
    meta[id] = { name: s.name, opt: { scrType: SCR_TYPE[toPuzzle(s.puzzle)] }, rank: id };
  });
  data.properties = { sessionData: JSON.stringify(meta) };
  return JSON.stringify(data);
}

export function importCsTimer(text: string, existing: Session[]): ImportResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This isn't a csTimer export file.");
  }
  if (!data || typeof data !== "object") throw new Error("This isn't a csTimer export file.");
  const keys = Object.keys(data).filter(k => /^session\d+$/.test(k));
  if (!keys.length) throw new Error("No csTimer sessions found in this file.");

  const props = (data.properties ?? {}) as Record<string, unknown>;
  let meta: Record<string, { name?: unknown; opt?: { scrType?: unknown }; rank?: number }> = {};
  try {
    const raw = props.sessionData;
    meta = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {};
  } catch { /* no names or types; fall back to defaults */ }

  const ordered = keys
    .map(k => ({ key: k, id: k.slice("session".length) }))
    .sort((a, b) => (meta[a.id]?.rank ?? +a.id) - (meta[b.id]?.rank ?? +b.id));

  let sessions = [...existing];
  const added: ImportResult["added"] = [];
  const skipped: ImportResult["skipped"] = [];

  for (const { key, id } of ordered) {
    const m = meta[id] ?? {};
    // csTimer's default session names are just numbers.
    const n = String(m.name ?? "").trim() || id;
    const name = /^\d+$/.test(n) ? `csTimer ${n}` : n;
    const list = Array.isArray(data[key]) ? (data[key] as unknown[]) : [];
    const solves = list.map(toSolve).filter((s): s is Solve => s !== null).sort((a, b) => a.at - b.at);
    if (!solves.length) continue;

    const puzzle = puzzleFor(m.opt?.scrType);
    if (!puzzle) {
      skipped.push({ name, reason: `${String(m.opt?.scrType)} isn't supported here`, solves: solves.length });
      continue;
    }

    // Importing the same file again only adds solves that aren't there yet.
    const match = sessions.find(s => s.name === name && toPuzzle(s.puzzle) === puzzle);
    if (match) {
      const known = new Set(match.solves.map(solveKey));
      const fresh = solves.filter(s => !known.has(solveKey(s)));
      if (!fresh.length) {
        skipped.push({ name, reason: "already imported", solves: solves.length });
        continue;
      }
      const merged = { ...match, solves: [...match.solves, ...fresh].sort((a, b) => a.at - b.at) };
      sessions = sessions.map(s => (s.id === match.id ? merged : s));
      added.push({ name, puzzle, solves: fresh.length, merged: true });
    } else {
      sessions.push(newSession(name, { solves, puzzle }));
      added.push({ name, puzzle, solves: solves.length, merged: false });
    }
  }

  // Drop the untouched starter session if the import brought real ones.
  if (added.length) {
    sessions = sessions.filter(s => !(s.solves.length === 0 && /^Session \d+$/.test(s.name) && existing.length === 1));
    if (!sessions.length) sessions = [...existing];
  }
  return { sessions, added, skipped };
}
