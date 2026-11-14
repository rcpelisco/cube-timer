import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { bestRolling, DNF, eff, fmt, MAX_NOTE, newBests, type Penalty, type Solve } from "./lib/stats";
import { FORMATS, limitPenalty, moveOldRounds, pastRounds, roundStatus, toRecord, useMockComp } from "./lib/mockComp";
import { fireConfetti } from "./lib/confetti";
import { load, save, saveFailure, wipeDevice } from "./lib/storage";
import { firebaseEnabled, loadFirebase, type FirebaseClient } from "./lib/firebase";
import { PUZZLES, toPuzzle } from "./lib/puzzles";
import { importCsTimer } from "./lib/csTimer";
import { useBoolPref } from "./lib/boolPref";
import { callOut, inspectionCallsPref, unlockSpeech } from "./lib/inspectionCalls";
import { useTimer } from "./hooks/useTimer";
import { useSessions } from "./hooks/useSessions";
import { useScramble } from "./hooks/useScramble";
import { scrambleKind } from "./lib/scramble";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useFocusMode } from "./hooks/useFocusMode";
import { useTimerBgLayer } from "./hooks/useTimerBg";
import { useView } from "./hooks/useView";
import { usePageTransition } from "./hooks/usePageTransition";
import { useAlgPrefs } from "./hooks/useAlgPrefs";
import { useTrainerStore } from "./hooks/useTrainerStore";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./hooks/useCloudSync";
import { Header } from "./components/Header";
import { ScramblePreview } from "./components/ScramblePreview";
import { ScrambleThumb } from "./components/ScrambleThumb";
import { TrendChart } from "./components/TrendChart";
import { SplitsLine } from "./components/SplitsLine";
import { usePhases } from "./lib/splits";
import { StatsPanel } from "./components/StatsPanel";
import { PenaltyButtons, SolveList } from "./components/SolveList";
import { SolveDetail } from "./components/SolveDetail";
import { TabBar } from "./components/TabBar";
import { ScrollTop } from "./components/ScrollTop";
import { EmptySolves } from "./components/EmptySolves";
import { StatsHero } from "./components/StatsHero";
import { QuickStats } from "./components/QuickStats";
import { TodayRing } from "./components/TodayRing";
import { SplitsBadge } from "./components/SplitsBadge";
import { TimeDisplay } from "./components/TimeDisplay";
import { InspectRing } from "./components/InspectRing";
import { MockCompBar, MockCompHistory, MockCompResult, MockCompSetup } from "./components/MockComp";
import { SolveActions } from "./components/SolveActions";
import { TypedEntry } from "./components/TypedEntry";
import { typingPref } from "./lib/typedTime";
import "./App.css";

// Pages other than the timer load on demand, so a cold start only downloads the timer. They're
// fetched in the background once the app is idle, so switching to one is still instant.
const loadAlgs = () => import("./components/AlgorithmsPage");
const loadTrainer = () => import("./components/TrainerPage");
const loadSettings = () => import("./components/SettingsPage");
const AlgorithmsPage = lazy(() => loadAlgs().then(m => ({ default: m.AlgorithmsPage })));
const TrainerPage = lazy(() => loadTrainer().then(m => ({ default: m.TrainerPage })));
const SettingsPage = lazy(() => loadSettings().then(m => ({ default: m.SettingsPage })));
if (typeof window !== "undefined") {
  const prefetch = () => { loadAlgs(); loadTrainer(); loadSettings(); };
  window.addEventListener("load", () => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(prefetch, { timeout: 4000 });
    else setTimeout(prefetch, 2000);
  }, { once: true });
}

// Removes this person's data from the device, including Firestore's offline copy, and reloads.
async function clearDevice(fb: FirebaseClient) {
  await wipeDevice();
  try {
    await fb.terminate(fb.db);
    await fb.clearIndexedDbPersistence(fb.db);
  } catch { /* another tab still has it open; the cache only holds what the account could read */ }
  location.reload();
}

// The saved state, read once (main.tsx loads it from storage before the app renders).
// Mock rounds used to be kept apart from the sessions; they move onto them once.
let initialState: ReturnType<typeof load> | null = null;
const getInitial = () => {
  if (!initialState) { const loaded = load(); initialState = { ...loaded, sessions: moveOldRounds(loaded.sessions) }; }
  return initialState;
};
const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export default function App() {
  const initial = getInitial();
  const sessions = useSessions(initial);
  const { current, setSolves } = sessions;
  const solves = current.solves;
  const [inspection, setInspection] = useState(initial.inspection);
  const puzzle = toPuzzle(current.puzzle);
  const { scramble, failed: scrambleFailed, next: nextScramble, back: prevScramble, canGoBack } = useScramble(puzzle);
  const [copied, setCopied] = useState<"" | "Copied" | "Copy blocked">("");
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(""), 1600);
    return () => clearTimeout(id);
  }, [copied]);
  const copyScramble = () => {
    if (!scramble) return;
    if (navigator.clipboard) navigator.clipboard.writeText(scramble.moves).then(() => setCopied("Copied"), () => setCopied("Copy blocked"));
    else setCopied("Copy blocked");
  };
  // Same breakpoint as the stacked layout in App.css.
  const isPhone = useMediaQuery("(max-width: 620px)");
  const scrambleRef = useRef(scramble);
  scrambleRef.current = scramble;
  const stageRef = useRef<HTMLDivElement>(null);

  // Mock competition round (lib/mockComp.ts). It belongs to one session; while it's going,
  // inspection is on and each solve is one of its attempts.
  const comp = useMockComp();
  const [compSetup, setCompSetup] = useState(false);
  const [compHistory, setCompHistory] = useState(false);
  const compRound = comp.round && comp.round.sid === current.id ? comp.round : null;
  const compStatus = useMemo(() => (compRound ? roundStatus(compRound, solves) : null), [compRound, solves]);
  const compLive = !!compRound && !!compStatus && !compStatus.done;
  const compRef = useRef({ live: compLive, limit: compRound?.limit ?? null });
  compRef.current = { live: compLive, limit: compRound?.limit ?? null };

  useEffect(() => save({ sessions: sessions.sessions, currentId: current.id, inspection }), [sessions.sessions, current.id, inspection]);

  const algPrefs = useAlgPrefs();
  const trainer = useTrainerStore();
  const { times: trainerTimes, timesAt: trainerTimesAt } = trainer.store;
  const trainerSync = useMemo(() => ({ times: trainerTimes, timesAt: trainerTimesAt }), [trainerTimes, trainerTimesAt]);
  const auth = useAuth();
  const { status: sync, deleteCloud } = useCloudSync({
    user: auth.user, sessions: sessions.sessions, inspection, algPrefs: algPrefs.prefs,
    trainer: trainerSync, setTrainer: trainer.replaceTimes,
    setSessions: sessions.setSessions, setInspection, setAlgPrefs: algPrefs.replace,
  });

  // The session's solves as of the last render, so a finished solve can be compared with them.
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);
  // The solve that last set a personal best (its badge shows while it's the latest solve).
  // `prev` is the session's solves before it, kept so the badge check below reuses the averages
  // already worked out for that list instead of going through the whole session again.
  const [pb, setPb] = useState<{ at: number; prev: Solve[] } | null>(null);

  // Just stopped: the time lands with a short accent flash (see .stage.landed), green instead
  // when it beats the session's sub-X goal (.stage.landed.goal).
  const [landed, setLanded] = useState(0);
  const [landedGoal, setLandedGoal] = useState(false);
  const goalRef = useRef(current.goal);
  goalRef.current = current.goal;
  useEffect(() => {
    if (!landed) return;
    const id = setTimeout(() => setLanded(0), 1000);
    return () => clearTimeout(id);
  }, [landed]);

  const recordAttempt = comp.record;
  const onFinish = useCallback((t: number, pen: Penalty, marks: number[]) => {
    const scr = scrambleRef.current?.moves ?? "";
    const round = compRef.current;
    const solve: Solve = { t, pen: round.live ? limitPenalty(t, pen, round.limit) : pen, scr, at: Date.now() };
    if (marks.length) solve.sp = marks;
    const prev = solvesRef.current;
    if (newBests(prev, solve).length) { setPb({ at: solve.at, prev }); fireConfetti(); }
    setSolves(list => [...list, solve]);
    setLanded(solve.at);
    setLandedGoal(!!goalRef.current && eff(solve) < goalRef.current);
    if (round.live) recordAttempt(solve.at);
    nextScramble();
  }, [setSolves, nextScramble, recordAttempt]);

  const [view, setView] = useView();
  usePageTransition(view, isPhone);
  // Computers show solves and stats beside the timer, so "solves" is the timer page there.
  const showTimer = view === "timer" || (!isPhone && view === "solves");
  // The timer only listens for keys and taps while its page is showing.
  const phaseNames = usePhases(puzzle);
  const phases = phaseNames.length || 1;
  const timerInspection = inspection || compLive;
  // A save to this device failed (storage full or blocked): warned about above the scramble.
  const saveFailed = useSyncExternalStore(saveFailure.subscribe, saveFailure.get);
  // Typing mode: times are typed in, so the page's timer doesn't listen for keys and taps.
  const [typing] = useBoolPref(typingPref);
  const timer = useTimer({ stageRef, inspection: timerInspection, onFinish, enabled: showTimer && !typing, phases });
  const addTyped = useCallback((t: number, pen: Penalty) => onFinish(t, pen, []), [onFinish]);
  const active = timer.phase !== "idle";
  const phaseRef = useRef(timer.phase);
  useEffect(() => { phaseRef.current = timer.phase; }, [timer.phase]);

  // "Eight seconds", "Twelve seconds" during inspection. Speech is unlocked on the first tap or key.
  const [calls] = useBoolPref(inspectionCallsPref);
  useEffect(() => {
    if (calls && timerInspection && timer.phase === "inspect" && timer.warn) callOut(timer.warn);
    // Only when the warning steps up, not on every frame of the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.warn]);
  useEffect(() => {
    if (!calls || !timerInspection) return;
    const opts = { capture: true, passive: true };
    window.addEventListener("pointerdown", unlockSpeech, opts);
    window.addEventListener("keydown", unlockSpeech, opts);
    return () => { window.removeEventListener("pointerdown", unlockSpeech, opts); window.removeEventListener("keydown", unlockSpeech, opts); };
  }, [calls, timerInspection]);
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
  // Deleting the last solve from under the timer asks first. Which solve the question is for (by
  // its time stamp), so it lapses when another solve comes in.
  const [confirmAt, setConfirmAt] = useState<number | null>(null);
  const confirming = !!last && confirmAt === last.at;
  const confirmingRef = useRef(confirming);
  useEffect(() => { confirmingRef.current = confirming; }, [confirming]);
  const askDelete = useCallback(() => setConfirmAt(solvesRef.current[solvesRef.current.length - 1]?.at ?? null), []);
  const keepSolve = useCallback(() => setConfirmAt(null), []);
  const confirmDelete = useCallback(() => {
    const i = solvesRef.current.length - 1;
    if (i >= 0) deleteSolve(i);
    setConfirmAt(null);
  }, [deleteSolve]);

  // Keyboard shortcuts for the last solve, while the timer is idle on its page:
  // 2 or + toggles +2, D toggles DNF, N opens its note, Backspace or Delete asks to delete it
  // (Enter deletes, Esc or any other key keeps it).
  useEffect(() => {
    if (!showTimer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || phaseRef.current !== "idle") return;
      if ((e.target as Element | null)?.matches?.("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const i = solvesRef.current.length - 1;
      if (i < 0) return;
      const key = e.key.toLowerCase();
      if (confirmingRef.current) {
        if (key === "enter") { e.preventDefault(); confirmDelete(); }
        else { if (key === "escape" || key === "backspace" || key === "delete") e.preventDefault(); keepSolve(); }
        return;
      }
      if (key === "2" || key === "+") setPenalty(i, 2);
      else if (key === "d") setPenalty(i, DNF);
      else if (key === "n") { setNoteAt(null); setNoteOpen(true); }
      else if (key === "backspace" || key === "delete") askDelete();
      else return;
      e.preventDefault(); // N mustn't also type an "n" into the note it opens
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTimer, setPenalty, askDelete, confirmDelete, keepSolve]);
  // Re-checked against the solve as it is now, so a +2, DNF or delete takes the badge away.
  const pbKinds = useMemo(
    () => {
      if (!last || last.at !== pb?.at) return [];
      const same = pb.prev.length === solves.length - 1 && pb.prev.every((s, i) => s === solves[i]);
      return newBests(same ? pb.prev : solves.slice(0, -1), last);
    },
    [solves, last, pb],
  );
  const shown = timer.display ?? (last ? fmt(eff(last)) : "0.00");
  const act = isTouch ? "Touch and hold" : <>Hold <kbd>Space</kbd></>;
  const hint =
    timer.phase === "running" ? (isTouch ? "Tap to stop" : "Any key to stop")
    : timer.phase === "inspect" || !timerInspection ? <>{act} until green, release to start</>
    : isTouch ? "Tap to start inspection" : <>Press <kbd>Space</kbd> to start inspection</>;

  // A finished round is kept on its session; its result is worked out from the solves whenever
  // it's shown, so a penalty given later still counts.
  const keepRound = sessions.keepRound;
  const compDone = !!compStatus?.done;
  useEffect(() => {
    if (compRound && compDone) keepRound(compRound.sid, toRecord(compRound));
  }, [compRound, compDone, keepRound]);
  const compBest = useMemo(() => {
    if (!compRound || !compStatus?.done) return null;
    const f = FORMATS[compRound.format];
    return bestRolling(solves.filter(s => s.at < compRound.startAt), f.fn, f.n);
  }, [compRound, compStatus?.done, solves]);
  const startRound = (format: Parameters<typeof comp.start>[1], cutoff: number | null, limit: number | null) => {
    comp.start(current.id, format, cutoff, limit);
    nextScramble();
  };

  const stageClass = [
    "stage",
    timer.holding && !timer.ready && "holding",
    timer.ready && "ready",
    timer.phase === "running" && "running",
    timer.phase === "inspect" && !timer.holding && "inspect",
    timer.warn === 8 && "warn8",
    timer.warn === 12 && "warn12",
    landed && !active && "landed",
    landed && !active && landedGoal && "goal",
  ].filter(Boolean).join(" ");

  // For a shared device: signs out, then removes this person's solves, sessions and algorithm
  // progress from it, along with Firestore's offline copy, and starts the app afresh. Only offered
  // once everything is synced, so nothing is lost.
  const onSignOutAndClear = useCallback(async () => {
    const fb = await loadFirebase();
    await fb.signOut(fb.auth);
    await clearDevice(fb);
  }, []);
  // Deletes the account's cloud data and its sign-in record (useAuth), which signs out; this
  // device keeps its copy unless `alsoDevice`.
  const deleteAccount = auth.deleteAccount;
  const onDeleteAccount = useCallback(async (alsoDevice: boolean) => {
    await deleteAccount(deleteCloud);
    if (alsoDevice) await clearDevice(await loadFirebase());
  }, [deleteAccount, deleteCloud]);
  const account = {
    enabled: firebaseEnabled, user: auth.user, sync, error: auth.error,
    onSignIn: auth.signIn, onSignOut: auth.signOut, onSignOutAndClear, onDeleteAccount,
  };
  const setSessionGoal = sessions.setGoal;
  const setGoal = useCallback((goal: number | null) => setSessionGoal(current.id, goal), [setSessionGoal, current.id]);
  const statsPanel = <StatsPanel solves={solves} sessions={sessions.sessions} cube={current.cube} puzzle={PUZZLES[puzzle].label} puzzleId={puzzle} goal={current.goal} onGoal={setGoal} />;
  const solveList = <SolveList key={current.id} solves={solves} puzzle={puzzle} cube={current.cube} onPenalty={setPenalty} onDelete={deleteSolve} onNote={setNote} />;

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

      <Suspense fallback={null}>
        {view === "algs" && <AlgorithmsPage prefs={algPrefs} />}
        {view === "train" && <TrainerPage prefs={algPrefs} trainer={trainer} />}
        {view === "settings" && (
          <SettingsPage inspection={inspection} onInspection={setInspection} account={account} sessions={sessionProps} onImport={importFile}
            solveActions={{ solves, onClear: () => setSolves(() => []) }} />
        )}
      </Suspense>

      {/* The timer page stays mounted (hidden) on other pages so its state and scramble keep. */}
      <section className="main" hidden={!showTimer}>
        {saveFailed && (
          <div className="panel save-failed" role="alert">
            <b>Your latest solves couldn't be saved on this device.</b>{" "}
            {auth.user
              ? "They're still synced to your account, but the device's storage may be full."
              : "The device's storage may be full. Sign in to sync them, or export them from Settings."}
          </div>
        )}
        {compRound && compStatus && (compStatus.done
          ? <MockCompResult round={compRound} status={compStatus} sessionBest={compBest} puzzle={puzzle} cube={current.cube}
              onAgain={() => startRound(compRound.format, compRound.cutoff, compRound.limit)}
              onHistory={() => setCompHistory(true)} onDone={comp.end} />
          : <MockCompBar round={compRound} status={compStatus} onEnd={comp.end} />)}
        {comp.round && !compRound && (
          <div className="panel comp-bar comp-elsewhere dimmable">
            <span>A mock round is going in another session.</span>
            <button type="button" className="link-btn" onClick={comp.end}>End it</button>
          </div>
        )}
        {compSetup && <MockCompSetup puzzle={puzzle} past={pastRounds(sessions.sessions)} onStart={startRound}
          onHistory={() => { setCompSetup(false); setCompHistory(true); }} onClose={() => setCompSetup(false)} />}
        {compHistory && <MockCompHistory sessions={sessions.sessions} puzzle={puzzle} onDelete={sessions.removeRound} onClose={() => setCompHistory(false)} />}
        <div className="scramble dimmable">
          <div className="scramble-text">
            <span className="label">
              Scramble · {PUZZLES[puzzle].label}
              {" · "}{scrambleKind(puzzle, scramble)}
              {PUZZLES[puzzle].cube && " · white top, green front"}
            </span>
            {scramble
              ? <span className={`moves moves-${puzzle}`}>{scramble.moves}</span>
              : scrambleFailed
                ? <span className="moves pending" role="alert">Couldn't generate a scramble. Try again.</span>
                : <span className="moves pending" aria-live="polite">Generating scramble…</span>}
          </div>
          <div className="scramble-actions">
            {/* No new scrambles mid-round, as at a competition (unless one couldn't be made). */}
            {!compLive && canGoBack && (
              <button type="button" onClick={prevScramble} aria-label="Previous scramble" title="Bring back the previous scramble">
                ↶ Previous
              </button>
            )}
            {(!compLive || scrambleFailed) && (
              <button type="button" onClick={nextScramble} disabled={!scramble && !scrambleFailed}>
                {scrambleFailed ? "Try again" : "New scramble"}
              </button>
            )}
            <button type="button" onClick={copyScramble} disabled={!scramble} aria-live="polite">{copied || "Copy"}</button>
            {!comp.round && <button type="button" className="comp-open" onClick={() => setCompSetup(true)}>Mock comp</button>}
          </div>
        </div>

        <div className={stageClass} ref={stageRef}>
          <TodayRing sessions={sessions.sessions} />
          <SplitsBadge names={phaseNames} />
          {timer.phase === "inspect" && <InspectRing />}
          <TimeDisplay shown={shown} running={timer.phase === "running"} />
          {timer.phase === "running" && phases > 1 && <SplitsLine marks={timer.marks} phases={phases} puzzle={puzzle} live />}
          {!active && last?.sp && <SplitsLine marks={last.sp} t={last.t} phases={last.sp.length + 1} puzzle={puzzle} />}
          {pbKinds.length > 0 && !active && (
            <div className="pb-badge" role="status">New PB · {pbKinds.join(", ")}</div>
          )}
          {typing ? <TypedEntry onAdd={addTyped} isTouch={isTouch} /> : <div className="hint dimmable">{hint}</div>}
          <div className="last-actions dimmable">
            {last && !active && confirming && (
              <div className="delete-confirm" role="alertdialog" aria-label="Delete this solve?">
                <span>Delete {last.pen === DNF ? "this DNF" : fmt(eff(last))}?</span>
                <button type="button" onClick={keepSolve}>Keep{!isTouch && <kbd>Esc</kbd>}</button>
                <button type="button" className="danger on" onClick={confirmDelete}>Delete{!isTouch && <kbd>Enter</kbd>}</button>
              </div>
            )}
            {last && !active && !confirming && <>
              <PenaltyButtons i={solves.length - 1} solve={last} onPenalty={setPenalty} onDelete={askDelete} />
              <button type="button" className="note-btn" aria-label={last.note ? "Edit note on this solve" : "Add a note to this solve"}
                title={last.note || undefined} onClick={() => setNoteOpen(true)}>
                {last.note ? "✎ Note" : "+ Note"}
              </button>
            </>}
          </div>
          {noteOpen && solves.length > 0 && (
            <SolveDetail solves={solves} i={Math.min(noteAt ?? solves.length - 1, solves.length - 1)} puzzle={puzzle} cube={current.cube}
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
            <TrendChart solves={solves} goal={current.goal} sessions={sessions.sessions} puzzle={puzzle} />
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
            {solves.length ? <>
              <div className="solves-actions"><SolveActions solves={solves} onClear={() => setSolves(() => [])} /></div>
              <StatsHero solves={solves} />
              {statsPanel}
              <TrendChart solves={solves} goal={current.goal} sessions={sessions.sessions} puzzle={puzzle} />
              {solveList}
            </> : <EmptySolves puzzle={puzzle} session={current.name} touch={isTouch} onTimer={() => setView("timer")} />}
          </section>
        )
      ) : (
        <aside className="side dimmable" hidden={!showTimer}>
          {solves.length ? <>{statsPanel}{solveList}</> : <EmptySolves puzzle={puzzle} session={current.name} touch={isTouch} />}
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
      <div className="page-area">
        <div className="page-scroll">{page}</div>
        <ScrollTop phone />
      </div>
      <TabBar view={view} onView={setView} />
    </div>
  ) : <>{bg}{page}<ScrollTop phone={false} /></>;
}
