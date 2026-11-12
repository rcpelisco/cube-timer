import { useSyncExternalStore } from "react";
import { DNF, type Solve } from "./stats";
import type { PuzzleId } from "./puzzles";

// Split timing: while the timer runs, each press marks the end of a phase instead of stopping,
// and the last phase's press stops it. A solve keeps its marks in `sp` (ms from the start, one
// per phase but the last), so the phases are 0 → sp[0] → … → t.
// Phases are named per puzzle (the setting at the end): CFOP's "Cross, F2L, OLL, PLL", Roux's blocks, a
// 4×4's "Centers, Edges, 3×3", or anything else, from 2 to MAX_PHASES. No names = split timing off.
export const MIN_PHASES = 2, MAX_PHASES = 6, MAX_NAME = 16;

export const PHASE_PRESETS: Record<PuzzleId, { label: string; names: string[] }[]> = {
  "333": [
    { label: "CFOP", names: ["Cross", "F2L", "OLL", "PLL"] },
    { label: "F2L / LL", names: ["F2L", "Last layer"] },
    { label: "Roux", names: ["First block", "Second block", "CMLL", "LSE"] },
  ],
  "222": [{ label: "Face / LL", names: ["First face", "Last layer"] }],
  "444": [{ label: "Reduction", names: ["Centers", "Edges", "3×3"] }],
  fto: [],
};

const numbered = (n: number) => Array.from({ length: n }, (_, i) => `Part ${i + 1}`);

// Names for a solve split into `n` phases: the puzzle's names when it has that many (blank ones
// numbered), otherwise "Part 1", "Part 2", … (an older solve split another way).
export function namesFor(n: number, names: string[]): string[] {
  if (names.length !== n) return numbered(n);
  return names.map((name, i) => name.trim() || `Part ${i + 1}`);
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

// The setting, per device: phase names by puzzle.
const KEY = "cubeTimer.splitPhases", OLD_KEY = "cubeTimer.splits";
type Config = Partial<Record<PuzzleId, string[]>>;
const listeners = new Set<() => void>();
let current: Config | null = null;

const clean = (names: unknown): string[] =>
  Array.isArray(names) && names.length >= MIN_PHASES
    ? names.slice(0, MAX_PHASES).map(n => (typeof n === "string" ? n.slice(0, MAX_NAME) : ""))
    : [];

function load(): Config {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(v ?? {}).map(([k, names]) => [k, clean(names)]).filter(([, n]) => n.length));
    }
    // The old setting was one count (2 or 4) for every puzzle, with CFOP names on 3×3.
    const n = Number(localStorage.getItem(OLD_KEY));
    if (n !== 2 && n !== 4) return {};
    const config: Config = { "222": numbered(n), "444": numbered(n), fto: numbered(n), "333": n === 4 ? ["Cross", "F2L", "OLL", "PLL"] : ["F2L", "Last layer"] };
    localStorage.setItem(KEY, JSON.stringify(config));
    localStorage.removeItem(OLD_KEY);
    return config;
  } catch { return {}; }
}
const get = () => (current ??= load());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const NONE: string[] = [];

export function setPhases(puzzle: PuzzleId, names: string[]) {
  const next = { ...get() };
  const kept = clean(names);
  if (kept.length) next[puzzle] = kept; else delete next[puzzle];
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}

// The puzzle's phase names (an empty list when split timing is off for it).
export function usePhases(puzzle: PuzzleId): string[] {
  return useSyncExternalStore(subscribe, () => get()[puzzle] ?? NONE);
}
