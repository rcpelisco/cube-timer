import { GoogleMark, type AccountProps } from "./AccountButton";
import { SYNC_LABEL } from "../hooks/useCloudSync";
import { ThemeChoice } from "./ThemeButton";
import { TimerBgSetting } from "./TimerBgSetting";
import { useHideTime } from "../hooks/useHideTime";
import { useShowTriggers } from "../hooks/useShowTriggers";
import { SolveActions } from "./SolveActions";
import type { Solve } from "../lib/stats";

// Settings: timer options, algorithms, appearance, and your Google account / sync. Phones reach it
// from the tab bar; computers from the account menu (or the cog when signed out), and there it
// also holds Copy times / Clear solves, which phones have on the Solves tab.
export function SettingsPage({ inspection, onInspection, account, solveActions }: {
  inspection: boolean; onInspection: (v: boolean) => void; account: AccountProps;
  solveActions?: { solves: Solve[]; onClear: () => void; session: string };
}) {
  const { enabled, user, sync, error, onSignIn, onSignOut } = account;
  const name = user?.displayName || user?.email || "Signed in";
  const [hideTime, setHideTime] = useHideTime();
  const [showTriggers, setShowTriggers] = useShowTriggers();

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
