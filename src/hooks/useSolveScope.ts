import { useMemo, useSyncExternalStore } from "react";
import type { Solve } from "../lib/stats";
import type { Session } from "../lib/sessions";
import { toPuzzle, type PuzzleId } from "../lib/puzzles";

// Whether Progress and Compare dates look at this session or every session for its puzzle (e.g.
// all 3×3 sessions together, so a new session for a new cube doesn't start your history over).
// Stored per device and shared by both, so switching one switches the other.
export type Scope = "session" | "all";
const KEY = "cubeTimer.progressScope";
const listeners = new Set<() => void>();
const read = (): Scope => { try { return localStorage.getItem(KEY) === "all" ? "all" : "session"; } catch { return "session"; } };
let value = read();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const set = (v: Scope) => { value = v; try { localStorage.setItem(KEY, v); } catch { /* ignore */ } listeners.forEach(fn => fn()); };

export interface SolveScope { scope: Scope; sessions: number; solves: Solve[]; set: (v: Scope) => void }

// `own`: the current session's solves. The toggle only matters with more than one session for the puzzle.
export function useSolveScope(own: Solve[], sessions: Session[], puzzle: PuzzleId): SolveScope {
  const pref = useSyncExternalStore(subscribe, () => value);
  const same = useMemo(() => sessions.filter(s => toPuzzle(s.puzzle) === puzzle), [sessions, puzzle]);
  const scope: Scope = same.length > 1 ? pref : "session";
  const solves = useMemo(
    () => (scope === "all" ? same.flatMap(s => s.solves).sort((a, b) => a.at - b.at) : own),
    [scope, same, own],
  );
  return { scope, sessions: same.length, solves, set };
}
