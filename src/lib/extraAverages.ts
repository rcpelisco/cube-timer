import { useSyncExternalStore } from "react";

// Averages you've added to Statistics beyond the built-in ones (e.g. Ao50, Ao1000), as their
// sizes, smallest first. Kept on this device.
export const BUILT_IN = [1, 3, 5, 12, 100];
export const MIN_AVG = 3, MAX_AVG = 10000, MAX_EXTRA = 6;

const KEY = "cubeTimer.extraAverages";
const listeners = new Set<() => void>();
let current: number[] | null = null;

const valid = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= MIN_AVG && (n as number) <= MAX_AVG && !BUILT_IN.includes(n as number);

const load = (): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? [...new Set(v.filter(valid))].sort((a, b) => a - b).slice(0, MAX_EXTRA) : [];
  } catch { return []; }
};
const get = () => (current ??= load());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function save(next: number[]) {
  current = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}

// Why `n` can't be added, or null if it can.
export function addProblem(n: number, list: number[]): string | null {
  if (!Number.isInteger(n) || n < MIN_AVG || n > MAX_AVG) return `Pick a whole number from ${MIN_AVG} to ${MAX_AVG}.`;
  if (BUILT_IN.includes(n) || list.includes(n)) return n === 3 ? "Mo3 is already there." : `Ao${n} is already there.`;
  if (list.length >= MAX_EXTRA) return `Up to ${MAX_EXTRA} extra averages.`;
  return null;
}

export function useExtraAverages() {
  const list = useSyncExternalStore(subscribe, get);
  return {
    list,
    add: (n: number) => { if (!addProblem(n, get())) save([...get(), n].sort((a, b) => a - b)); },
    remove: (n: number) => save(get().filter(x => x !== n)),
  };
}
