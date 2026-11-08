import { newSession, type Session } from "./sessions";

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

export function save(data: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
