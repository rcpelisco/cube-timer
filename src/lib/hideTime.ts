// "Hide time while solving": the clock keeps running, but the screen shows "Solving" instead of
// the time until you stop. Stored per device, shared by every control that shows it.
const KEY = "cubeTimer.hideTime";

let current: boolean | null = null;
const listeners = new Set<() => void>();

const load = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

export const hideTimeStore = {
  get: (): boolean => (current ??= load()),
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(v: boolean) {
    current = v;
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
    listeners.forEach(fn => fn());
  },
};
