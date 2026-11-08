import { AccountButton, type AccountProps } from "./AccountButton";
import { SessionPicker, type SessionPickerProps } from "./SessionPicker";
import { ThemeButton } from "./ThemeButton";
import type { View } from "../hooks/useView";

const LOGO = ["#0a9a4a", "#f4f4f4", "#c8102e", "#ffd500", "#0051ba", "#ff5800", "#c8102e", "#0a9a4a", "#ffd500"];
const TITLE: Partial<Record<View, string>> = { algs: "Algorithms", train: "Trainer", settings: "Settings" };

interface Props {
  phone: boolean;
  account: AccountProps;
  sessions: SessionPickerProps;
  view: View;
  onView: (v: View) => void;
}

export function Header({ phone, account, sessions, view, onView }: Props) {
  // Phones: just the session (timer pages) or the page title; everything else is in the tab bar
  // and the Solves / Settings tabs.
  if (phone) {
    return (
      <header className="bar phone-bar dimmable">
        {TITLE[view] ? <h1 className="page-title">{TITLE[view]}</h1> : <SessionPicker {...sessions} />}
      </header>
    );
  }

  const onTimer = view === "timer" || view === "solves";
  return (
    <header className="bar dimmable">
      <div className="brand-row">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {LOGO.map((c, i) => <i key={i} style={{ background: c }} />)}
          </span>
          Cube Timer
        </div>
        <nav className="view-tabs" aria-label="Pages">
          <button type="button" className={onTimer ? "on" : ""} aria-current={onTimer ? "page" : undefined} onClick={() => onView("timer")}>Timer</button>
          <button type="button" className={view === "algs" ? "on" : ""} aria-current={view === "algs" ? "page" : undefined} onClick={() => onView("algs")}>Algorithms</button>
          <button type="button" className={view === "train" ? "on" : ""} aria-current={view === "train" ? "page" : undefined} onClick={() => onView("train")}>Trainer</button>
        </nav>
        {onTimer && <SessionPicker {...sessions} />}
      </div>
      <div className="controls">
        <ThemeButton />
        {/* Settings (inspection, hide time, copy / clear solves, …): in the account menu when
            signed in, otherwise behind a cog. */}
        {!account.user && (
          <button type="button" className={`icon-btn settings-btn${view === "settings" ? " on" : ""}`} aria-label="Settings"
            aria-current={view === "settings" ? "page" : undefined} onClick={() => onView("settings")}>
            <CogIcon />
          </button>
        )}
        <AccountButton {...account} onSettings={() => onView("settings")} />
      </div>
    </header>
  );
}

function CogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
