import { GoogleMark, type AccountProps } from "./AccountButton";
import { SYNC_LABEL } from "../hooks/useCloudSync";
import { ThemeChoice } from "./ThemeButton";
import { TimerBgSetting } from "./TimerBgSetting";
import { useHideTime } from "../hooks/useHideTime";
import { useShowTriggers } from "../hooks/useShowTriggers";
import { SolveActions } from "./SolveActions";
import type { Solve } from "../lib/stats";
import { exportCsTimer, type ImportResult } from "../lib/csTimer";
import { exportFileName, saveTextFile } from "../lib/saveFile";
import { ImportCsTimer } from "./ImportCsTimer";
import { useBoolPref } from "../lib/boolPref";
import { inspectionCallsPref } from "../lib/inspectionCalls";
import { canVibrate, hapticsPref } from "../lib/haptics";
import { SplitPhasesSetting } from "./SplitPhasesSetting";
import { AccentSetting } from "./AccentSetting";
import { toPuzzle } from "../lib/puzzles";
import { TARGET_OPTIONS, useDailyTarget } from "../lib/dailyTarget";
import { SessionManager, type SessionPickerProps } from "./SessionPicker";
import { appCheckSiteKey } from "../lib/firebase";

// Settings: timer options, algorithms, sessions (with Copy times / Clear solves on the current
// one), import & export, appearance, and your Google account / sync. Phones reach it from the tab
// bar (and also have Copy / Clear on the Solves tab); computers from the account menu (or the cog
// when signed out).
export function SettingsPage({ inspection, onInspection, account, sessions, solveActions, onImport }: {
  inspection: boolean; onInspection: (v: boolean) => void; account: AccountProps; sessions: SessionPickerProps;
  solveActions?: { solves: Solve[]; onClear: () => void };
  onImport: (text: string) => ImportResult;
}) {
  const { enabled, user, sync, error, onSignIn, onSignOut } = account;
  const name = user?.displayName || user?.email || "Signed in";
  const [hideTime, setHideTime] = useHideTime();
  const [showTriggers, setShowTriggers] = useShowTriggers();
  const [calls, setCalls] = useBoolPref(inspectionCallsPref);
  const [haptics, setHaptics] = useBoolPref(hapticsPref);
  const puzzle = toPuzzle(sessions.list.find(x => x.id === sessions.currentId)?.puzzle);
  const [target, setTarget] = useDailyTarget();

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
        <label className={`setting-row${inspection ? "" : " off"}`} htmlFor="opt-calls">
          <span>
            <b>Inspection calls</b>
            <small>Says "eight seconds" and "twelve seconds" during inspection, like a WCA judge.{!inspection && " Turn on 15 s inspection to use it."}</small>
          </span>
          <input type="checkbox" className="switch" id="opt-calls" checked={calls} disabled={!inspection}
            onChange={e => setCalls(e.target.checked)} />
        </label>
        <label className="setting-row" htmlFor="opt-hide-time">
          <span>
            <b>Hide time while solving</b>
            <small>Shows "Solving" instead of the running clock; your time appears when you stop.</small>
          </span>
          <input type="checkbox" className="switch" id="opt-hide-time" checked={hideTime}
            onChange={e => setHideTime(e.target.checked)} />
        </label>
        {canVibrate && (
          <label className="setting-row" htmlFor="opt-haptics">
            <span>
              <b>Vibrate</b>
              <small>A short buzz when the timer turns green, at each split and when you stop.</small>
            </span>
            <input type="checkbox" className="switch" id="opt-haptics" checked={haptics}
              onChange={e => setHaptics(e.target.checked)} />
          </label>
        )}
        <SplitPhasesSetting puzzle={puzzle} />
        <div className="setting-row stacked">
          <span>
            <b>Daily target</b>
            <small>Solves to aim for each day, in any session. A ring on the timer fills as you go, and the Days chart marks the days you reached it.</small>
          </span>
          <div className="segmented phases targets" role="radiogroup" aria-label="Daily target">
            {TARGET_OPTIONS.map(n => (
              <button key={n} type="button" role="radio" aria-checked={target === n} className={target === n ? "on" : ""}
                onClick={() => setTarget(n)}>{n || "Off"}</button>
            ))}
          </div>
        </div>
        <div className="setting-row shortcuts">
          <span>
            <b>Keyboard shortcuts</b>
            <small>For your last solve: <kbd>2</kbd> +2 · <kbd>D</kbd> DNF · <kbd>N</kbd> note · <kbd>Backspace</kbd> delete, then <kbd>Enter</kbd> to confirm.</small>
          </span>
        </div>
      </div>

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

      <div className="panel settings-group session-settings">
        <h2>Sessions</h2>
        <SessionManager {...sessions}
          currentActions={solveActions && <SolveActions solves={solveActions.solves} onClear={solveActions.onClear} />}
          onExport={s => { saveTextFile(exportFileName(s.name), exportCsTimer([s])).catch(() => {}); }} />
      </div>

      <ImportCsTimer sessions={sessions.list} onImport={onImport} />

      <div className="panel settings-group">
        <h2>Appearance</h2>
        <div className="setting-row stacked theme-setting">
          <span><b>Theme</b><small>System follows your phone's setting.</small></span>
          <ThemeChoice />
        </div>
        <AccentSetting />
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
        {enabled && appCheckSiteKey && (
          <p className="setting-note recaptcha-note">
            Sync is protected by reCAPTCHA; the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.
          </p>
        )}
      </div>
    </section>
  );
}
