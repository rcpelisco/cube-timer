// "Show triggers": mark the named triggers inside algorithms (on by default). Stored per device,
// shared by every algorithm on screen.
const KEY = "cubeTimer.showTriggers";

let current: boolean | null = null;
const listeners = new Set<() => void>();

const load = () => {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
};

export const showTriggersStore = {
  get: (): boolean => (current ??= load()),
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(v: boolean) {
    current = v;
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
    listeners.forEach(fn => fn());
  },
};
