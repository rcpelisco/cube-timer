// How far along you are with each case. Missing means not started. Stored per device.
export type LearnStatus = "none" | "learning" | "learned";
export type StatusMap = Record<string, Exclude<LearnStatus, "none">>;

export const STATUS_LABEL: Record<LearnStatus, string> = { none: "Not started", learning: "Learning", learned: "Learned" };
export const STATUS_ORDER: LearnStatus[] = ["none", "learning", "learned"];

const KEY = "cubeTimer.algStatus";

export function loadStatuses(): StatusMap {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function saveStatuses(s: StatusMap) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const statusOf = (s: StatusMap, id: string): LearnStatus => s[id] ?? "none";
