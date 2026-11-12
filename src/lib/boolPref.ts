import { useSyncExternalStore } from "react";

// An on/off preference kept in localStorage on this device, shared by every component using it.
export function boolPref(key: string, fallback: boolean) {
  let current: boolean | null = null;
  const listeners = new Set<() => void>();
  const load = () => {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v === "1"; } catch { return fallback; }
  };
  return {
    get: (): boolean => (current ??= load()),
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    set(v: boolean) {
      current = v;
      try { localStorage.setItem(key, v ? "1" : "0"); } catch { /* ignore */ }
      listeners.forEach(fn => fn());
    },
  };
}

export function useBoolPref(store: ReturnType<typeof boolPref>): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(store.subscribe, store.get), store.set];
}
