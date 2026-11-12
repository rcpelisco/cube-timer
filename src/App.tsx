import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { eff, fmt, MAX_NOTE, newBests, type Penalty } from "./lib/stats";
import { fireConfetti } from "./lib/confetti";
import { load, save } from "./lib/storage";
import { firebaseEnabled } from "./lib/firebase";
import { PUZZLES, toPuzzle } from "./lib/puzzles";
import { importCsTimer } from "./lib/csTimer";
import { useTimer } from "./hooks/useTimer";
import { useSessions } from "./hooks/useSessions";
import { useScramble } from "./hooks/useScramble";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useFocusMode } from "./hooks/useFocusMode";
import { useTimerBgLayer } from "./hooks/useTimerBg";
import { useView } from "./hooks/useView";
import { useAlgPrefs } from "./hooks/useAlgPrefs";
import { AlgorithmsPage } from "./components/AlgorithmsPage";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./hooks/useCloudSync";
import { Header } from "./components/Header";
import { ScramblePreview } from "./components/ScramblePreview";
import { ScrambleThumb } from "./components/ScrambleThumb";
import { TrendChart } from "./components/TrendChart";
import { StatsPanel } from "./components/StatsPanel";
import { PenaltyButtons, SolveList } from "./components/SolveList";
import { SolveDetail } from "./components/SolveDetail";
import { TabBar } from "./components/TabBar";
import { QuickStats } from "./components/QuickStats";
import { TrainerPage } from "./components/TrainerPage";
import { TimeDisplay } from "./components/TimeDisplay";
import { SettingsPage } from "./components/SettingsPage";
import { SolveActions } from "./components/SolveActions";
import "./App.css";

const initial = load();
const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export default function App() {
  const sessions = useSessions(initial);
  const { current, setSolves } = sessions;
  const solves = current.solves;
  const [inspection, setInspection] = useState(initial.inspection);
  const puzzle = toPuzzle(current.puzzle);
  const { scramble, failed: scrambleFailed, next: nextScramble } = useScramble(puzzle);
  // Same breakpoint as the stacked layout in App.css.
  const isPhone = useMediaQuery("(max-width: 620px)");
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => save({ sessions: sessions.sessions, currentId: current.id, inspection }), [sessions.sessions, current.id, inspection]);

  const algPrefs = useAlgPrefs();
  const auth = useAuth();
  const sync = useCloudSync({
    user: auth.user, sessions: sessions.sessions, inspection, algPrefs: algPrefs.prefs,
    setSessions: sessions.setSessions, setInspection, setAlgPrefs: algPrefs.replace,
  });

  // The session's solves as of the last render, so a finished solve can be compared with them.
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);
  // The solve that last set a personal best (its badge shows while it's the latest solve).
  const [pbAt, setPbAt] = useState<number | null>(null);

  const onFinish = useCallback((t: number, pen: Penalty) => {
    const scr = scrambleRef.current?.moves ?? "";
    const solve = { t, pen, scr, at: Date.now() };
    if (newBests(solvesRef.current, solve).length) { setPbAt(solve.at); fireConfetti(); }
    setSolves(list => [...list, solve]);
    nextScramble();
  }, [setSolves, nextScramble]);

  const [view, setView] = useView();
  // Computers show solves and stats beside the timer, so "solves" is the timer page there.
  const showTimer = view === "timer" || (!isPhone && view === "solves");
  // The timer only listens for keys and taps while its page is showing.
  const timer = useTimer({ stageRef, inspection, onFinish, enabled: showTimer });
  const active = timer.phase !== "idle";
  useFocusMode(active);
  const hasBg = useTimerBgLayer(showTimer || view === "train");

  // Buttons keep focus after a click; drop it so Space only drives the timer. Text fields keep focus.
  useEffect(() => {
    const blur = () => { if (document.activeElement instanceof HTMLElement && document.activeElement.matches("button, input[type=checkbox]")) document.activeElement.blur(); };
    window.addEventListener("click", blur);
    return () => window.removeEventListener("click", blur);
  }, []);

  // Stable callbacks, so the memoised stats and solve list skip the timer's per-frame re-renders.
  const setPenalty = useCallback((i: number, pen: Penalty) =>
    setSolves(list => list.map((s, j) => (j === i ? { ...s, pen: s.pen === pen ? 0 : pen } : s))), [setSolves]);
  const deleteSolve = useCallback((i: number) => setSolves(list => list.filter((_, j) => j !== i)), [setSolves]);
  // The last solve's detail, opened from the Note button under the time.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteAt, setNoteAt] = useState<number | null>(null);
  const closeNote = useCallback(() => { setNoteOpen(false); setNoteAt(null); }, []);
  const setNote = useCallback((i: number, note: string) => setSolves(list => list.map((s, j) => {
    if (j !== i) return s;
    const rest = { ...s };
    delete rest.note;
    const trimmed = note.slice(0, MAX_NOTE);
    return trimmed.trim() ? { ...rest, note: trimmed } : rest;
  })), [setSolves]);
  const importFile = (text: string) => {
    const result = importCsTimer(text, sessions.sessions);
    if (result.added.length) sessions.setSessions(result.sessions);
    return result;
  };

  const last = solves[solves.length - 1];
  // Re-checked against the solve as it is now, so a +2, DNF or delete takes the badge away.
  const pbKinds = useMemo(
    () => (last && last.at === pbAt ? newBests(solves.slice(0, -1), last) : []),
    [solves, last, pbAt],
  );
  const shown = timer.display ?? (last ? fmt(eff(last)) : "0.00");
  const act = isTouch ? "Touch and hold" : <>Hold <kbd>Space</kbd></>;
  const hint =
    timer.phase === "running" ? (isTouch ? "Tap to stop" : "Any key to stop")
    : timer.phase === "inspect" || !inspection ? <>{act} until green, release to start</>
    : isTouch ? "Tap to start inspection" : <>Press <kbd>Space</kbd> to start inspection</>;

  const stageClass = [
    "stage",
    timer.holding && !timer.ready && "holding",
    timer.ready && "ready",
    timer.phase === "inspect" && !timer.holding && "inspect",
    timer.warn === 8 && "warn8",
    timer.warn === 12 && "warn12",
  ].filter(Boolean).join(" ");

  const account = { enabled: firebaseEnabled, user: auth.user, sync, error: auth.error, onSignIn: auth.signIn, onSignOut: auth.signOut };
  const statsPanel = <StatsPanel solves={solves} cube={current.cube} puzzle={PUZZLES[puzzle].label} />;
  const solveList = <SolveList key={current.id} solves={solves} puzzle={puzzle} onPenalty={setPenalty} onDelete={deleteSolve} onNote={setNote} />;

  const sessionProps = {
    list: sessions.sessions, currentId: current.id, onSelect: sessions.select,
    onCreate: sessions.create, onUpdate: sessions.update, onDelete: sessions.remove,
  };

  const page = (
    <div className={`app${isPhone ? " phone" : ""}`}>
      <Header
        phone={isPhone}
        sessions={sessionProps}
        account={account}
        view={view}
        onView={setView}
      />

      {view === "algs" && <AlgorithmsPage prefs={algPrefs} onTrain={() => setView("train")} />}
      {view === "train" && <TrainerPage prefs={algPrefs} />}
      {view === "settings" && (
        <SettingsPage inspection={inspection} onInspection={setInspection} account={account} sessions={sessionProps} onImport={importFile}
          solveActions={{ solves, onClear: () => setSolves(() => []) }} />
      )}

      {/* The timer page stays mounted (hidden) on other pages so its state and scramble keep. */}
      <section className="main" hidden={!showTimer}>
        <div className="scramble dimmable">
          <div className="scramble-text">
            <span className="label">
              Scramble · {PUZZLES[puzzle].label}
              {" · "}{scramble && !scramble.randomState ? "random-move" : PUZZLES[puzzle].wca ? "WCA random-state" : "random-state"}
              {puzzle !== "fto" && " · white top, green front"}
            </span>
            {scramble
              ? <span className={`moves moves-${puzzle}`}>{scramble.moves}</span>
              : scrambleFailed
                ? <span className="moves pending" role="alert">Couldn't generate a scramble. Try again.</span>
                : <span className="moves pending" aria-live="polite">Generating scramble…</span>}
          </div>
          <button type="button" onClick={nextScramble} disabled={!scramble && !scrambleFailed}>
            {scrambleFailed ? "Try again" : "New scramble"}
          </button>
        </div>

        <div className={stageClass} ref={stageRef}>
          <TimeDisplay shown={shown} running={timer.phase === "running"} />
          {pbKinds.length > 0 && !active && (
            <div className="pb-badge" role="status">New PB · {pbKinds.join(", ")}</div>
          )}
          <div className="hint dimmable">{hint}</div>
          <div className="last-actions dimmable">
            {last && !active && <>
              <PenaltyButtons i={solves.length - 1} solve={last} onPenalty={setPenalty} onDelete={deleteSolve} />
              <button type="button" className="note-btn" aria-label={last.note ? "Edit note on this solve" : "Add a note to this solve"}
                title={last.note || undefined} onClick={() => setNoteOpen(true)}>
                {last.note ? "✎ Note" : "+ Note"}
              </button>
            </>}
          </div>
          {noteOpen && solves.length > 0 && (
            <SolveDetail solves={solves} i={Math.min(noteAt ?? solves.length - 1, solves.length - 1)} puzzle={puzzle}
              focusNote={noteAt == null} onPenalty={setPenalty} onNote={setNote}
              onDelete={j => { deleteSolve(j); closeNote(); }} onNavigate={setNoteAt} onClose={closeNote} />
          )}
        </div>

        {/* Phones: a scrambled-state thumbnail (tap for full screen) beside the averages,
            instead of the trend chart and preview card. */}
        {isPhone ? (
          <div className="phone-lower">
            <ScrambleThumb puzzle={puzzle} moves={scramble?.moves ?? null} />
            <QuickStats solves={solves} />
          </div>
        ) : (
          <div className="lower dimmable">
            <TrendChart solves={solves} />
            <div className="panel net">
              <h2>Scrambled state</h2>
              <ScramblePreview puzzle={puzzle} moves={scramble?.moves ?? null} />
            </div>
          </div>
        )}
      </section>

      {isPhone ? (
        view === "solves" && (
          <section className="solves-page">
            <div className="solves-actions"><SolveActions solves={solves} onClear={() => setSolves(() => [])} /></div>
            {statsPanel}
            <TrendChart solves={solves} />
            {solveList}
          </section>
        )
      ) : (
        <aside className="side dimmable" hidden={!showTimer}>
          {statsPanel}
          {solveList}
        </aside>
      )}
    </div>
  );
  // Phones: the page scrolls inside the shell and the tab bar is pinned below it (see App.css).
  // The chosen background photo, behind everything on the timer pages.
  const bg = hasBg && <div className="timer-bg-layer" aria-hidden="true" />;
  return isPhone ? (
    <div className="phone-shell">
      {bg}
      <div className="page-scroll">{page}</div>
      <TabBar view={view} onView={setView} />
    </div>
  ) : <>{bg}{page}</>;
}
