import type { MouseEvent } from "react";
import { switchTheme, THEME_LABEL, THEME_ORDER, type ThemePref } from "../lib/theme";
import { useThemePref } from "../hooks/useThemePref";

const centre = (e: MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2] as const;
};

// Header button (computers) that cycles System → Light → Dark.
export function ThemeButton() {
  const pref = useThemePref();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
  return (
    <button type="button" className="theme-btn" title={`Theme: ${THEME_LABEL[pref]} (tap for ${THEME_LABEL[next]})`}
      aria-label={`Theme: ${THEME_LABEL[pref]}. Switch to ${THEME_LABEL[next]}`} onClick={e => switchTheme(next, ...centre(e))}>
      <ThemeIcon pref={pref} />
    </button>
  );
}

// Settings page: System / Light / Dark side by side.
export function ThemeChoice() {
  const pref = useThemePref();
  return (
    <div className="segmented" role="radiogroup" aria-label="Theme">
      {THEME_ORDER.map(p => (
        <button key={p} type="button" role="radio" aria-checked={pref === p} className={pref === p ? "on" : ""}
          onClick={e => { if (p !== pref) switchTheme(p, ...centre(e)); }}>
          <ThemeIcon pref={p} /> {THEME_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

export function ThemeIcon({ pref }: { pref: ThemePref }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true } as const;
  if (pref === "light") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (pref === "dark") {
    return (
      <svg {...common}>
        <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  // System: half-filled circle.
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
    </svg>
  );
}
