import { useEffect, useState } from "react";
import { GoogleMark, type AccountProps } from "./AccountButton";
import { SYNC_LABEL } from "../hooks/useCloudSync";
import { ThemeChoice } from "./ThemeButton";
import { TimerBgSetting } from "./TimerBgSetting";
import { useHideTime } from "../hooks/useHideTime";
import { useShowTriggers } from "../hooks/useShowTriggers";
import { SolveActions } from "./SolveActions";
import type { Solve } from "../lib/stats";
import { useWakeLockStatus } from "../lib/wakeLockStatus";
import type { ImportResult } from "../lib/csTimer";
import { ImportCsTimer } from "./ImportCsTimer";
import { SessionManager, type SessionPickerProps } from "./SessionPicker";

// SHA-256 of the developer's email, so the debug card shows only for them without the address
// itself being in the code or the public bundle.
const DEV_EMAIL_SHA256 = "7dd4e4d5760fd0a5bfc0933390232211c1601a882323afe945b51fba8ee95678";

function useIsDev(email: string | null | undefined) {
  const [dev, setDev] = useState(false);
  useEffect(() => {
    let live = true;
    if (!email || !crypto.subtle) { setDev(false); return; }
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase())).then(buf => {
      const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
      if (live) setDev(hex === DEV_EMAIL_SHA256);
    });
    return () => { live = false; };
  }, [email]);
  return dev;
}

// Temporary: shows what the screen wake lock is doing, to debug the screen sleeping on iOS.
function WakeLockDiagnostics() {
  const s = useWakeLockStatus();
  const standalone = matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const build = new URL(import.meta.url).pathname.split("/").pop();
  return (
    <div className="panel settings-group">
      <h2>Screen wake lock (debug)</h2>
      <p className="setting-note wakelock-debug">
        State: <b>{s.state}</b>{s.detail && <> · {s.detail}</>}<br />
        Requests: {s.requests} · last change {new Date(s.at).toLocaleTimeString()}<br />
        Home-screen app: {standalone ? "yes" : "no"} · secure: {window.isSecureContext ? "yes" : "no"}<br />
        Build: {build}
      </p>
    </div>
  );
}

// Settings: timer options, algorithms, appearance, and your Google account / sync. Phones reach it
// from the tab bar; computers from the account menu (or the cog when signed out), and there it
// also holds Copy times / Clear solves, which phones have on the Solves tab.
export function SettingsPage({ inspection, onInspection, account, sessions, solveActions, onImport }: {
  inspection: boolean; onInspection: (v: boolean) => void; account: AccountProps; sessions: SessionPickerProps;
  solveActions?: { solves: Solve[]; onClear: () => void; session: string };
  onImport: (text: string) => ImportResult;
}) {
  const { enabled, user, sync, error, onSignIn, onSignOut } = account;
  const name = user?.displayName || user?.email || "Signed in";
  const [hideTime, setHideTime] = useHideTime();
  const [showTriggers, setShowTriggers] = useShowTriggers();
  const isDev = useIsDev(user?.email);

  return (
    <section className="settings">
      <h1 className="settings-title">Settings</h1>
      <div className="panel settings-group">
        <h2>Timer</h2>
        <label className="setting-row" htmlFor="opt-inspect-settings">
          <span>
            <b>15 s inspection</b>
            <small>Countdown before each solve; +2 after 15 s, DNF after 17 s.</small>
          </span>
          <input type="checkbox" className="switch" id="opt-inspect-settings" checked={inspection}
            onChange={e => onInspection(e.target.checked)} />
        </label>
        <label className="setting-row" htmlFor="opt-hide-time">
          <span>
            <b>Hide time while solving</b>
            <small>Shows "Solving" instead of the running clock; your time appears when you stop.</small>
          </span>
          <input type="checkbox" className="switch" id="opt-hide-time" checked={hideTime}
            onChange={e => setHideTime(e.target.checked)} />
        </label>
      </div>

      <div className="panel settings-group session-settings">
        <h2>Sessions</h2>
        <SessionManager {...sessions} />
      </div>

      {solveActions && (
        <div className="panel settings-group">
          <h2>Solves</h2>
          <div className="setting-row">
            <span>
              <b>{solveActions.session}</b>
              <small>{solveActions.solves.length} {solveActions.solves.length === 1 ? "solve" : "solves"} in this session. Copy them with their scrambles, or clear the session.</small>
            </span>
          </div>
          <div className="settings-actions"><SolveActions solves={solveActions.solves} onClear={solveActions.onClear} /></div>
        </div>
      )}

      <ImportCsTimer onImport={onImport} />

      <div className="panel settings-group">
        <h2>Algorithms</h2>
        <label className="setting-row" htmlFor="opt-triggers">
          <span>
            <b>Show triggers</b>
            <small>Marks named move groups like Sexy (R U R' U') and Sledgehammer (R' F R F') inside algorithms.</small>
          </span>
          <input type="checkbox" className="switch" id="opt-triggers" checked={showTriggers}
            onChange={e => setShowTriggers(e.target.checked)} />
        </label>
      </div>

      <div className="panel settings-group">
        <h2>Appearance</h2>
        <div className="setting-row">
          <span><b>Theme</b><small>System follows your phone's setting.</small></span>
        </div>
        <ThemeChoice />
        <TimerBgSetting />
      </div>

      {isDev && <WakeLockDiagnostics />}

      <div className="panel settings-group">
        <h2>Account</h2>
        {!enabled ? (
          <p className="setting-note">Sign-in isn't set up for this copy of the app.</p>
        ) : !user ? (
          <>
            <p className="setting-note">Sign in to sync your solves, sessions and algorithm progress between devices.</p>
            <button type="button" className="google wide" onClick={onSignIn}><GoogleMark /> Sign in with Google</button>
            {error && <p className="account-error" role="alert">{error}</p>}
          </>
        ) : (
          <>
            <div className="account-card">
              {user.photoURL
                ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                : <span className="avatar-fallback">{name[0].toUpperCase()}</span>}
              <span>
                <b>{name}</b>
                {user.email && user.email !== name && <small>{user.email}</small>}
                <small className={`account-sync ${sync}`}>{SYNC_LABEL[sync]}</small>
              </span>
            </div>
            <button type="button" className="wide" onClick={onSignOut}>Sign out</button>
          </>
        )}
      </div>
    </section>
  );
}
