import { useCallback, useEffect, useState } from "react";
import { avgOf, DNF, eff, meanOf, type Penalty, type Solve, type Stat } from "./stats";
import { toPuzzle, type PuzzleId } from "./puzzles";
import type { Session } from "./sessions";

// Mock competition: a round run the way a WCA round is. Ao5 (or Mo3), inspection on, one scramble
// per attempt, an optional cutoff (beat it in the first two attempts, or the first one for Mo3, to
// get the rest) and time limit (a solve over it is a DNF). The round's solves are ordinary solves
// in the session; the round only keeps which ones they are, so a +2 or DNF given later counts.
// A finished round is kept on its session (Session.rounds), so it syncs with the solves and goes
// when the session does.

export type CompFormat = "ao5" | "mo3";
export const FORMATS: Record<CompFormat, { label: string; n: number; cutoffAfter: number; fn: Stat }> = {
  ao5: { label: "Ao5", n: 5, cutoffAfter: 2, fn: avgOf },
  mo3: { label: "Mo3", n: 3, cutoffAfter: 1, fn: meanOf },
};

// A round as kept on its session.
export interface RoundRecord {
  startAt: number;
  format: CompFormat;
  cutoff: number | null;  // ms
  limit: number | null;   // ms
  ats: number[];          // the attempts' solve time stamps, in order
}

// The round being run, and the session it runs in.
export interface Round extends RoundRecord { sid: string }

export const toRecord = ({ startAt, format, cutoff, limit, ats }: RoundRecord): RoundRecord => ({ startAt, format, cutoff, limit, ats });

// A round read from storage or Firestore, or null if it isn't one.
export function readRecord(v: unknown): RoundRecord | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && x > 0 ? x : null);
  if (typeof r.startAt !== "number" || !(r.format === "ao5" || r.format === "mo3") || !Array.isArray(r.ats)) return null;
  return { startAt: r.startAt, format: r.format, cutoff: num(r.cutoff), limit: num(r.limit), ats: r.ats.filter((x): x is number => typeof x === "number") };
}

export interface RoundStatus {
  attempts: Solve[];
  done: boolean;
  cutoffMissed: boolean;
  result: number | null;  // the average or mean (Infinity for DNF); null if it wasn't completed
  best: number | null;
}

export function roundStatus(r: RoundRecord, solves: Solve[]): RoundStatus {
  const byAt = new Map(solves.map(s => [s.at, s]));
  const attempts = r.ats.map(at => byAt.get(at)).filter((s): s is Solve => !!s);
  const f = FORMATS[r.format];
  // WCA cutoffs are strict: you have to be under it.
  const cutoffMissed = r.cutoff != null && attempts.length >= f.cutoffAfter
    && !attempts.slice(0, f.cutoffAfter).some(s => eff(s) < r.cutoff!);
  const done = cutoffMissed || attempts.length >= f.n;
  const result = attempts.length >= f.n ? f.fn(attempts.slice(0, f.n), f.n) : null;
  const best = attempts.length ? Math.min(...attempts.map(eff)) : null;
  return { attempts, done, cutoffMissed, result, best };
}

// A kept round with where it is and how it went, worked out from its session's solves as they are now.
export interface PastRound { sid: string; session: string; puzzle: PuzzleId; round: RoundRecord; status: RoundStatus }

// Every kept round, newest first.
export function pastRounds(sessions: Session[]): PastRound[] {
  const out: PastRound[] = [];
  for (const s of sessions) {
    for (const round of s.rounds ?? []) {
      out.push({ sid: s.id, session: s.name, puzzle: toPuzzle(s.puzzle), round, status: roundStatus(round, s.solves) });
    }
  }
  return out.sort((a, b) => b.round.startAt - a.round.startAt);
}

// The penalty a solve gets in a round: a DNF when it goes over the time limit (with any +2).
export function limitPenalty(t: number, pen: Penalty, limit: number | null): Penalty {
  if (limit == null || pen === DNF) return pen;
  return t + (pen === 2 ? 2000 : 0) >= limit ? DNF : pen;
}

// "20", "20.5", "1:30" or "1:30.25" as ms; null for an empty box, NaN when it can't be read.
export function parseTime(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return NaN;
  const secs = Number(m[2]);
  if (m[1] && secs >= 60) return NaN;
  const ms = Math.round(((Number(m[1] ?? 0) * 60) + secs) * 1000);
  return ms > 0 ? ms : NaN;
}

// ---------- The round being run (this device only) ----------

const ROUND_KEY = "cubeTimer.mockRound";

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}

export function useMockComp() {
  const [round, setRound] = useState<Round | null>(() => read<Round | null>(ROUND_KEY, null));
  useEffect(() => {
    try { if (round) localStorage.setItem(ROUND_KEY, JSON.stringify(round)); else localStorage.removeItem(ROUND_KEY); } catch { /* ignore */ }
  }, [round]);

  const start = useCallback((sid: string, format: CompFormat, cutoff: number | null, limit: number | null) =>
    setRound({ sid, format, cutoff, limit, startAt: Date.now(), ats: [] }), []);
  const record = useCallback((at: number) => setRound(r => (r ? { ...r, ats: [...r.ats, at] } : r)), []);
  const end = useCallback(() => setRound(null), []);
  return { round, start, record, end };
}

// ---------- Rounds from before they were kept on sessions ----------

// They were a list on this device with the attempt times but not which solves they were. Each is
// matched to the solves it was made of (the first solves from its start with the same times), and
// dropped if they can't be found. Runs once; the old list is removed after.
const OLD_HISTORY_KEY = "cubeTimer.mockRounds";
interface OldRound { startAt: number; format: CompFormat; cutoff: number | null; limit: number | null; times: [number, Penalty][] }

export function moveOldRounds<S extends { solves: Solve[]; rounds?: RoundRecord[] }>(sessions: S[]): S[] {
  const old = read<OldRound[] | null>(OLD_HISTORY_KEY, null);
  if (!old) return sessions;
  try { localStorage.removeItem(OLD_HISTORY_KEY); } catch { /* ignore */ }
  const next = sessions.map(s => ({ ...s }));
  for (const o of old) {
    if (!o?.times?.length || !FORMATS[o.format]) continue;
    for (const s of next) {
      const after = s.solves.filter(x => x.at >= o.startAt).slice(0, o.times.length);
      if (after.length !== o.times.length || after.some((x, i) => x.t !== o.times[i][0])) continue;
      if (s.rounds?.some(r => r.startAt === o.startAt)) break;
      const rec: RoundRecord = { startAt: o.startAt, format: o.format, cutoff: o.cutoff ?? null, limit: o.limit ?? null, ats: after.map(x => x.at) };
      s.rounds = [...(s.rounds ?? []), rec].sort((a, b) => a.startAt - b.startAt);
      break;
    }
  }
  return next;
}
