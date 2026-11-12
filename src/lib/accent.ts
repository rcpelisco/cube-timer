import { useSyncExternalStore } from "react";
import { boolPref } from "./boolPref";

// The app's accent colour (tabs, links, inspection, the logo, charts, share cards) and the pure
// black option for dark mode. Kept per device. index.html applies both before first paint, from
// the colours saved under VARS_KEY and the black flag, so the page doesn't flash blue or grey.

export type AccentId = "blue" | "teal" | "orange" | "purple" | "pink" | "mono";

// light: on the light theme; dark: on the dark themes (and the share cards, which are dark).
export const ACCENTS: Record<AccentId, { label: string; light: string; dark: string }> = {
  blue: { label: "Blue", light: "#0b57d0", dark: "#7aaeff" },
  teal: { label: "Teal", light: "#0b7a6d", dark: "#4fd1b8" },
  orange: { label: "Orange", light: "#c2410c", dark: "#ff9a5c" },
  purple: { label: "Purple", light: "#6b3fd1", dark: "#b49cff" },
  pink: { label: "Pink", light: "#c0266d", dark: "#ff86b8" },
  mono: { label: "Mono", light: "#3b4654", dark: "#c9d2de" },
};
export const ACCENT_ORDER = Object.keys(ACCENTS) as AccentId[];

const KEY = "cubeTimer.accent";
const VARS_KEY = "cubeTimer.accentVars"; // "light dark", read by index.html

function load(): AccentId {
  try {
    const v = localStorage.getItem(KEY);
    return v && v in ACCENTS ? (v as AccentId) : "blue";
  } catch { return "blue"; }
}

export function applyAccent(id: AccentId) {
  const { light, dark } = ACCENTS[id];
  const root = document.documentElement.style;
  root.setProperty("--accent-l", light);
  root.setProperty("--accent-d", dark);
}

let current: AccentId | null = null;
const listeners = new Set<() => void>();
export const accentStore = {
  get: (): AccentId => (current ??= load()),
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(id: AccentId) {
    current = id;
    applyAccent(id);
    try {
      localStorage.setItem(KEY, id);
      localStorage.setItem(VARS_KEY, `${ACCENTS[id].light} ${ACCENTS[id].dark}`);
    } catch { /* ignore */ }
    listeners.forEach(fn => fn());
  },
};

export const useAccent = () => useSyncExternalStore(accentStore.subscribe, accentStore.get);

// Pure black backgrounds in dark mode (saves power on OLED phones).
export const blackPref = boolPref("cubeTimer.black", false);
