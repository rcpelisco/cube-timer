// Theme choice for this device: follow the system, or force light/dark.
// Stored per device (not synced). index.html applies it before first paint to avoid a flash.

export type ThemePref = "system" | "light" | "dark";
export const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];
export const THEME_LABEL: Record<ThemePref, string> = { system: "System", light: "Light", dark: "Dark" };

const KEY = "cubeTimer.theme";
import { blackPref } from "./accent";

// Page background per palette, also used for the browser/status-bar colour (theme-color).
const BG = { light: "#eceff3", dark: "#0d1116", black: "#000000" };

export function loadTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch { return "system"; }
}

export function saveTheme(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
}

// The current choice, shared by every theme control (header button, Settings page).
let current: ThemePref | null = null;
const listeners = new Set<() => void>();
export const themeStore = {
  get: (): ThemePref => (current ??= loadTheme()),
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(pref: ThemePref) {
    current = pref;
    applyTheme(pref);
    saveTheme(pref);
    listeners.forEach(fn => fn());
  },
};

// Switch theme with a transition: with view transitions, the new theme grows in a circle from
// (x, y); without them, colors fade briefly; with reduced motion, it just switches.
export function switchTheme(next: ThemePref, x: number, y: number) {
  const update = () => themeStore.set(next);
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }

  const startViewTransition = (document as Partial<Document>).startViewTransition?.bind(document);
  if (!startViewTransition) {
    root.classList.add("theme-fade");
    update();
    setTimeout(() => root.classList.remove("theme-fade"), 300);
    return;
  }

  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theme-vt");
  const vt = startViewTransition(update);
  vt.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => {});
  vt.finished.finally(() => root.classList.remove("theme-vt"));
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const black = blackPref.get();
  root.toggleAttribute("data-black", black);
  // index.html has one theme-color tag per system scheme; when forced, both use the forced colour.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    const scheme = pref === "system" ? (meta.media.includes("dark") ? "dark" : "light") : pref;
    meta.content = scheme === "dark" && black ? BG.black : BG[scheme];
  });
}

// Pure black on or off, with the same fade as a theme change.
export function setBlack(on: boolean) {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) root.classList.add("theme-fade");
  blackPref.set(on);
  applyTheme(themeStore.get());
  if (!reduce) setTimeout(() => root.classList.remove("theme-fade"), 300);
}
