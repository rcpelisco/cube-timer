import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mainAlg, type AlgPicks } from "../lib/algChoice";
import { CROSS_COLORS, type CrossColor } from "../lib/crossColor";
import { CROSS_LEVELS, crossScramble, drillKey, llScramble, type CrossLevel, type CrossResult, type Drill, type LLResult, type LLStep } from "../lib/drills";
import { DNF, fmt, type Penalty } from "../lib/stats";
import { addTime, caseStats, type TrainerState } from "../lib/trainer";
import { callOut, inspectionCallsPref, unlockSpeech } from "../lib/inspectionCalls";
import { useBoolPref } from "../lib/boolPref";
import { useTimer } from "../hooks/useTimer";
import { useFocusMode } from "../hooks/useFocusMode";
import { CaseDiagram } from "./CaseDiagram";
import { AlgText } from "./AlgText";
import { TimeDisplay } from "./TimeDisplay";
import { InspectRing } from "./InspectRing";

const isTouch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const COLOR_NAME: Record<string, string> = Object.fromEntries(CROSS_COLORS.map(c => [c.swatch, c.id]));

type Info = { drill: "LL"; ll: LLResult } | { drill: "cross"; cross: CrossResult; level: CrossLevel };
interface Attempt { info: Info | null; failed?: boolean }
interface Last { info: Info; t: number; pen: Penalty; key: string }

const stepName = (s: LLStep, what: string) => (s === "skip" ? `${what} skip` : s ? s.name : `${what} ?`);

// Last layer and cross practice: a fresh scramble each time, timed, with what it was shown after.
export function DrillRun({ drill, level, plan, cross, picks, times, setStore }: {
  drill: Drill; level: CrossLevel; plan: boolean; cross: CrossColor; picks: AlgPicks;
  times: TrainerState["times"]; setStore: Dispatch<SetStateAction<TrainerState>>;
}) {
  const crossInfo = CROSS_COLORS.find(c => c.id === cross)!;
  const [attempt, setAttempt] = useState<Attempt>({ info: null });
  const [last, setLast] = useState<Last | null>(null);
  const request = useRef(0);
  const inspection = drill === "cross" && plan;

  const load = useCallback(() => {
    const id = ++request.current;
    setAttempt({ info: null });
    const made: Promise<Info> = drill === "LL"
      ? llScramble(cross, c => mainAlg(c, picks)).then(ll => ({ drill, ll }))
      : crossScramble(cross, level).then(r => ({ drill: "cross", cross: r, level }));
    made.then(
      info => { if (id === request.current) setAttempt({ info }); },
      () => { if (id === request.current) setAttempt({ info: null, failed: true }); },
    );
  }, [drill, level, cross, picks]);

  // A new scramble when the drill, level or cross color changes (not when your algorithm picks do:
  // they only change how the case is named).
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { setLast(null); loadRef.current(); }, [drill, level, cross]);

  const attemptRef = useRef(attempt);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  const onFinish = useCallback((t: number, pen: Penalty) => {
    const info = attemptRef.current.info;
    if (!info) return;
    const key = drillKey(info.drill, info.drill === "cross" ? info.level : "any");
    // A DNF (more than 17 s planning) isn't a time, so it's shown but not kept.
    if (pen !== DNF) setStore(s => ({ ...s, times: { ...s.times, [key]: addTime(s.times[key], t + (pen === 2 ? 2000 : 0)) } }));
    setLast({ info, t, pen, key });
    loadRef.current();
  }, [setStore]);

  const stageRef = useRef<HTMLDivElement>(null);
  const timer = useTimer({ stageRef, inspection, onFinish, enabled: !!attempt.info });
  const active = timer.phase !== "idle";
  useFocusMode(active);

  // "Eight seconds", "Twelve seconds" while planning, as on the timer.
  const [calls] = useBoolPref(inspectionCallsPref);
  useEffect(() => {
    if (calls && inspection && timer.phase === "inspect" && timer.warn) callOut(timer.warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.warn]);
  useEffect(() => {
    if (!calls || !inspection) return;
    const opts = { capture: true, passive: true };
    window.addEventListener("pointerdown", unlockSpeech, opts);
    window.addEventListener("keydown", unlockSpeech, opts);
    return () => { window.removeEventListener("pointerdown", unlockSpeech, opts); window.removeEventListener("keydown", unlockSpeech, opts); };
  }, [calls, inspection]);

  const deleteLast = () => {
    if (!last) return;
    if (last.pen !== DNF) setStore(s => ({ ...s, times: { ...s.times, [last.key]: (s.times[last.key] ?? []).slice(0, -1) } }));
    setLast(null);
  };

  const lastText = last ? (last.pen === DNF ? "DNF" : `${fmt(last.t + (last.pen === 2 ? 2000 : 0))}${last.pen === 2 ? "+" : ""}`) : "0.00";
  const shown = timer.display ?? lastText;
  const act = isTouch ? "Touch and hold" : <>Hold <kbd>Space</kbd></>;
  const hint = timer.phase === "running" ? (isTouch ? "Tap to stop" : "Any key to stop")
    : timer.phase === "inspect" || !inspection ? <>{act} until green, release to start</>
    : isTouch ? "Tap to start planning" : <>Press <kbd>Space</kbd> to start planning</>;
  const stageClass = [
    "stage", timer.holding && !timer.ready && "holding", timer.ready && "ready",
    timer.phase === "inspect" && !timer.holding && "inspect", timer.warn === 8 && "warn8", timer.warn === 12 && "warn12",
  ].filter(Boolean).join(" ");

  const front = COLOR_NAME[crossInfo.faces.F];
  // How to hold the cube for the cross solution: it's worked out with the cross on the bottom and
  // this front (crossColor.ts), so both faces are named.
  const holding = `${crossInfo.top} on top, ${front} in front`;
  const hold = `then hold ${holding}`;
  const lvl = CROSS_LEVELS.find(l => l.id === level)!;
  const title = drill === "LL" ? "Last layer" : `${crossInfo.label} cross · ${lvl.label.toLowerCase()} (${lvl.note})`;

  const rows = drill === "LL"
    ? [{ id: "LL", label: "Last layer", ...caseStats(times[drillKey("LL", level)]) }]
    : CROSS_LEVELS.map(l => ({ id: l.id, label: `${l.label} cross`, ...caseStats(times[drillKey("cross", l.id)]) }));
  const current = drill === "LL" ? "LL" : level;

  return (
    <>
      <div className="scramble dimmable">
        <div className="scramble-text">
          <span className="label">{title} · scramble white top, green front, {hold}</span>
          {attempt.info
            ? <span className="moves">{attempt.info.drill === "LL" ? attempt.info.ll.scramble : attempt.info.cross.scramble}</span>
            : attempt.failed
              ? <span className="moves pending" role="alert">Couldn't make a scramble.</span>
              : <span className="moves pending" aria-live="polite">Generating scramble…</span>}
        </div>
        <button type="button" onClick={load}>New scramble</button>
      </div>

      <div className={stageClass} ref={stageRef}>
        {timer.phase === "inspect" && <InspectRing />}
        <TimeDisplay shown={shown} running={timer.phase === "running"} />
        <div className="hint dimmable">{hint}</div>
        <div className="last-actions dimmable">
          {last && !active && <button type="button" className="danger" onClick={deleteLast}>Delete</button>}
        </div>
      </div>

      {last && (
        <div className="panel trainer-last dimmable">
          {last.info.drill === "LL" ? <LastLL ll={last.info.ll} t={lastText} picks={picks} cross={cross} />
            : <div className="trainer-cross">
                <h2>Last cross</h2>
                <b className="trainer-case">{last.info.cross.moves} {last.info.cross.moves === 1 ? "move" : "moves"} <span>{lastText}</span></b>
                <small>Scramble, white top, green front:</small>
                <code className="trainer-alg">{last.info.cross.scramble}</code>
                {last.info.cross.moves > 0 && <>
                  <small>Shortest, holding {holding}:</small>
                  <code className="trainer-alg">{last.info.cross.solution}</code>
                </>}
              </div>}
        </div>
      )}

      <div className="panel trainer-stats dimmable">
        <h2>Your times</h2>
        <table>
          <thead><tr><th>{drill === "LL" ? "Drill" : "Cross"}</th><th>Avg 5</th><th>Best</th><th>Times</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={`${r.reps ? "" : "untried"}${r.id === current ? " current" : ""}`}>
                <td>{r.label}</td><td>{fmt(r.avg)}</td><td>{fmt(r.best)}</td><td>{r.reps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LastLL({ ll, t, picks, cross }: { ll: LLResult; t: string; picks: AlgPicks; cross: CrossColor }) {
  return (
    <div className="trainer-ll">
      <h2>Last layer <span>{t}</span></h2>
      {([[ll.oll, "OLL"], [ll.pll, "PLL"]] as const).map(([step, what]) => (
        <div key={what} className="trainer-ll-step">
          {step && step !== "skip" && <CaseDiagram c={step} alg={mainAlg(step, picks)} cross={cross} className="trainer-diagram" />}
          <div>
            <b className="trainer-case">{stepName(step, what)}</b>
            {step && step !== "skip" && <code className="trainer-alg"><AlgText alg={mainAlg(step, picks)} labels /></code>}
          </div>
        </div>
      ))}
    </div>
  );
}
