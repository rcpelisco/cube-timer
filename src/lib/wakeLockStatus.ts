import { useSyncExternalStore } from "react";

// What the screen wake lock is doing, for the diagnostics line in Settings.
export interface WakeLockStatus {
  state: "unsupported" | "idle" | "requesting" | "held" | "released" | "refused";
  detail: string; // error name and message when refused
  at: number; // when the state last changed
  requests: number;
}

let status: WakeLockStatus = { state: "idle", detail: "", at: Date.now(), requests: 0 };
const listeners = new Set<() => void>();

export function setWakeLockStatus(patch: Partial<WakeLockStatus>) {
  status = { ...status, ...patch, at: Date.now() };
  listeners.forEach(l => l());
}

export function useWakeLockStatus() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => status,
  );
}
