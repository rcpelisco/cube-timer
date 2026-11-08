import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { SYNC_LABEL, type SyncStatus } from "../hooks/useCloudSync";

export interface AccountProps {
  enabled: boolean;
  user: User | null;
  sync: SyncStatus;
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}


export function AccountButton({ enabled, user, sync, error, onSignIn, onSignOut, onSettings }: AccountProps & { onSettings?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!enabled) return null;

  if (!user) {
    return (
      <div className="account">
        <button type="button" className="google" onClick={onSignIn}>
          <GoogleMark /> Sign in
        </button>
        {error && <span className="account-error" role="alert">{error}</span>}
      </div>
    );
  }

  const name = user.displayName || user.email || "Signed in";
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar-btn" aria-expanded={open} aria-label={`Account: ${name}`} onClick={() => setOpen(o => !o)}>
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span className="avatar-fallback">{name[0].toUpperCase()}</span>}
        <span className={`sync-dot ${sync}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-name">{name}</div>
          {user.email && user.email !== name && <div className="account-email">{user.email}</div>}
          <div className={`account-sync ${sync}`}>{SYNC_LABEL[sync]}</div>
          {onSettings && <button type="button" role="menuitem" onClick={() => { setOpen(false); onSettings(); }}>Settings</button>}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
