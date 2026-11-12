import { useCallback, useEffect, useState } from "react";
import { avgOf, DNF, eff, meanOf, type Penalty, type Solve, type Stat } from "./stats";

// Mock competition: a round run the way a WCA round is. Ao5 (or Mo3), inspection on, one scramble
// per attempt, an optional cutoff (beat it in the first two attempts, or the first one for Mo3, to
// get the rest) and time limit (a solve over it is a DNF). The round's solves are ordinary solves
// in the session; the round only keeps which ones they are, so a +2 or DNF given later counts.

export type CompFormat = "ao5" | "mo3";
export const FORMATS: Record<CompFormat, { label: string; n: number; cutoffAfter: number; fn: Stat }> = {
  ao5: { label: "Ao5", n: 5, cutoffAfter: 2, fn: avgOf },
  mo3: { label: "Mo3", n: 3, cutoffAfter: 1, fn: meanOf },
};

export interface Round {
  sid: string;            // the session it runs in
  format: CompFormat;
  cutoff: number | null;  // ms
  limit: number | null;   // ms
  startAt: number;
  ats: number[];          // the attempts' solve time stamps, in order
}

export interface RoundStatus {
  attempts: Solve[];
  done: boolean;
  cutoffMissed: boolean;
  result: number | null;  // the average or mean (Infinity for DNF); null if it wasn't completed
  best: number | null;
}

export function roundStatus(r: Round, solves: Solve[]): RoundStatus {
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

// ---------- Kept on this device ----------

export interface PastRound {
  startAt: number;
  puzzle: string;
  format: CompFormat;
  cutoff: number | null;
  limit: number | null;
  times: [number, Penalty][];
  result: number | null;   // -1 for DNF (JSON has no Infinity)
  cutoffMissed: boolean;
}

const ROUND_KEY = "cubeTimer.mockRound", HISTORY_KEY = "cubeTimer.mockRounds";
const KEEP = 30;

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) {
  try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export function useMockComp() {
  const [round, setRound] = useState<Round | null>(() => read<Round | null>(ROUND_KEY, null));
  const [history, setHistory] = useState<PastRound[]>(() => read<PastRound[]>(HISTORY_KEY, []));
  useEffect(() => write(ROUND_KEY, round), [round]);
  useEffect(() => write(HISTORY_KEY, history), [history]);

  const start = useCallback((sid: string, format: CompFormat, cutoff: number | null, limit: number | null) =>
    setRound({ sid, format, cutoff, limit, startAt: Date.now(), ats: [] }), []);
  const record = useCallback((at: number) => setRound(r => (r ? { ...r, ats: [...r.ats, at] } : r)), []);
  const end = useCallback(() => setRound(null), []);
  // Adds or updates the finished round's entry (a penalty given afterwards changes the result).
  const keep = useCallback((r: Round, status: RoundStatus, puzzle: string) => {
    const entry: PastRound = {
      startAt: r.startAt, puzzle, format: r.format, cutoff: r.cutoff, limit: r.limit,
      times: status.attempts.map(s => [s.t, s.pen]),
      result: status.result == null ? null : isFinite(status.result) ? status.result : -1,
      cutoffMissed: status.cutoffMissed,
    };
    setHistory(h => {
      const prev = h.find(p => p.startAt === r.startAt);
      if (prev && JSON.stringify(prev) === JSON.stringify(entry)) return h;
      return [entry, ...h.filter(p => p.startAt !== r.startAt)].slice(0, KEEP);
    });
  }, []);

  return { round, history, start, record, end, keep };
}
