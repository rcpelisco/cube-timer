import { newSession, type Session } from "./sessions";
import { isPersonalKey } from "./deviceOwner";

const KEY = "cubeTimer.v2";
const LEGACY_KEY = "cubeTimer.v1"; // single list of solves, before sessions existed

export interface Saved { sessions: Session[]; currentId: string; inspection: boolean }

export function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && Array.isArray(raw.sessions) && raw.sessions.length) {
      const currentId = raw.sessions.some((s: Session) => s.id === raw.currentId) ? raw.currentId : raw.sessions[0].id;
      return { sessions: raw.sessions, currentId, inspection: !!raw.inspection };
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
    if (legacy) {
      const first = newSession("Session 1", { solves: Array.isArray(legacy.solves) ? legacy.solves : [] });
      return { sessions: [first], currentId: first.id, inspection: !!legacy.inspection };
    }
  } catch { /* storage unavailable */ }
  const first = newSession("Session 1");
  return { sessions: [first], currentId: first.id, inspection: false };
}

// Writing the whole history takes a while once it's big, so it waits until the browser is idle
// (at most half a second) rather than holding up the frame that shows a finished time. Changes in
// the meantime are folded into one write, and a pending write happens at once when the app is
// hidden or closed.
let pending: Saved | null = null;
let scheduled = false;
let wiped = false;

function flush() {
  scheduled = false;
  if (!pending || wiped) return;
  const data = pending;
  pending = null;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function save(data: Saved) {
  if (wiped) return;
  pending = data;
  if (scheduled) return;
  scheduled = true;
  if (typeof requestIdleCallback === "function") requestIdleCallback(flush, { timeout: 500 });
  else setTimeout(flush, 100);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

// Removes this person's data from the device (see isPersonalKey) and stops any further saves, so
// nothing is written back before the page reloads.
export function wipeDevice() {
  wiped = true;
  pending = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPersonalKey(k)) keys.push(k); }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* storage unavailable */ }
}
