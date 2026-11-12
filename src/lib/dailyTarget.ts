import { useSyncExternalStore } from "react";

// How many solves a day you're aiming for (0 = no target). Kept on this device.
export const TARGET_OPTIONS = [0, 25, 50, 100, 200];

const KEY = "cubeTimer.dailyTarget";
const listeners = new Set<() => void>();
let current: number | null = null;
const load = (): number => {
  try { const v = Number(localStorage.getItem(KEY)); return TARGET_OPTIONS.includes(v) ? v : 0; } catch { return 0; }
};
const get = () => (current ??= load());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function set(n: number) {
  current = n;
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
  listeners.forEach(fn => fn());
}
export function useDailyTarget(): [number, (n: number) => void] {
  return [useSyncExternalStore(subscribe, get), set];
}
