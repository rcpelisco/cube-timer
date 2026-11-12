import { useSyncExternalStore } from "react";
import { DNF, type Solve } from "./stats";
import type { PuzzleId } from "./puzzles";

// Split timing: while the timer runs, each press marks the end of a phase instead of stopping,
// and the last phase's press stops it. A solve keeps its marks in `sp` (ms from the start, one
// per phase but the last), so the phases are 0 → sp[0] → … → t.
export type PhaseCount = 1 | 2 | 4;
export const PHASE_OPTIONS: { n: PhaseCount; label: string }[] = [
  { n: 1, label: "Off" }, { n: 2, label: "2 phases" }, { n: 4, label: "4 phases" },
];

// Phase names by how many there are. 3×3 uses CFOP's; other puzzles are numbered.
export function phaseNames(n: number, puzzle: PuzzleId): string[] {
  if (puzzle === "333" && n === 2) return ["F2L", "Last layer"];
  if (puzzle === "333" && n === 4) return ["Cross", "F2L", "OLL", "PLL"];
  return Array.from({ length: n }, (_, i) => `Part ${i + 1}`);
}

// Each phase's own time, from the marks and the solve's raw time (penalties aren't a phase).
export const phaseTimes = (marks: number[], t: number) => [...marks, t].map((m, i) => m - (i ? marks[i - 1] : 0));

// Mean of each phase over the latest `n` finished solves split the way the newest split solve is.
export function splitMeans(solves: Solve[], n = 12): { phases: number; count: number; means: number[] } | null {
  let phases = 0;
  const picked: Solve[] = [];
  for (let i = solves.length - 1; i >= 0 && picked.length < n; i--) {
    const s = solves[i];
    if (!s.sp?.length || s.pen === DNF) continue;
    if (!phases) phases = s.sp.length + 1;
    if (s.sp.length + 1 === phases) picked.push(s);
  }
  if (!picked.length) return null;
  const sums = new Array(phases).fill(0);
  for (const s of picked) phaseTimes(s.sp!, s.t).forEach((v, k) => { sums[k] += v; });
  return { phases, count: picked.length, means: sums.map(v => v / picked.length) };
}

// The setting, per device.
const KEY = "cubeTimer.splits";
const listeners = new Set<() => void>();
let current: PhaseCount | null = null;
const load = (): PhaseCount => {
  try { const v = Number(localStorage.getItem(KEY)); return v === 2 || v === 4 ? v : 1; } catch { return 1; }
};
const get = () => (current ??= load());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function set(n: PhaseCount) {
  current = n;
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}
export function usePhaseCount(): [PhaseCount, (n: PhaseCount) => void] {
  return [useSyncExternalStore(subscribe, get), set];
}
