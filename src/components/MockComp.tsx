import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DNF, eff, fmt, type Penalty, type Solve } from "../lib/stats";
import { FORMATS, parseTime, type CompFormat, type PastRound, type Round, type RoundStatus } from "../lib/mockComp";
import { useLeave } from "../hooks/useLeave";

const dateText = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const attemptText = (t: number, pen: Penalty) => (pen === DNF ? "DNF" : `${fmt(t + (pen === 2 ? 2000 : 0))}${pen === 2 ? "+" : ""}`);
const resultText = (v: number | null) => (v == null ? "–" : fmt(v));

// Setting up a round: format, optional cutoff and time limit, and the rounds you've done before.
export function MockCompSetup({ puzzle, history, onStart, onClose }: {
  puzzle: string; history: PastRound[];
  onStart: (format: CompFormat, cutoff: number | null, limit: number | null) => void; onClose: () => void;
}) {
  const { leaving, close } = useLeave(onClose);
  // Starts from the settings of your last round on this puzzle.
  const lastHere = history.find(h => h.puzzle === puzzle);
  const [format, setFormat] = useState<CompFormat>(lastHere?.format ?? "ao5");
  const [cutoff, setCutoff] = useState(lastHere?.cutoff ? fmt(lastHere.cutoff) : "");
  const [limit, setLimit] = useState(lastHere?.limit ? fmt(lastHere.limit) : "");
  const c = parseTime(cutoff), l = parseTime(limit);
  const problem = Number.isNaN(c) || Number.isNaN(l) ? "Write times like 20, 20.5 or 1:30."
    : c != null && l != null && c > l ? "The cutoff can't be longer than the time limit." : null;
  const past = history.filter(h => h.puzzle === puzzle);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space" && !(e.target as Element | null)?.matches?.("input")) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close]);

  return createPortal(
    <div className={`avg-detail comp-setup${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Mock competition">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Mock competition · {puzzle}</span>
            <div className="comp-title">A round, WCA style</div>
            <small className="avg-detail-when">15 s inspection, one scramble per attempt, and the result at the end.</small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        <form className="panel comp-form" onSubmit={e => { e.preventDefault(); if (!problem) { onStart(format, c, l); close(); } }}>
          <div className="comp-field">
            <b>Format</b>
            <div className="segmented" role="radiogroup" aria-label="Format">
              {(Object.keys(FORMATS) as CompFormat[]).map(f => (
                <button key={f} type="button" role="radio" aria-checked={format === f} className={format === f ? "on" : ""}
                  onClick={() => setFormat(f)}>{FORMATS[f].label}</button>
              ))}
            </div>
          </div>
          <label className="comp-field">
            <span><b>Cutoff</b><small>Optional. Beat it in the first {FORMATS[format].cutoffAfter === 1 ? "attempt" : `${FORMATS[format].cutoffAfter} attempts`} to get the rest.</small></span>
            <input inputMode="decimal" placeholder="20" value={cutoff} onChange={e => setCutoff(e.target.value)} />
          </label>
          <label className="comp-field">
            <span><b>Time limit</b><small>Optional. A solve that reaches it is a DNF.</small></span>
            <input inputMode="decimal" placeholder="1:00" value={limit} onChange={e => setLimit(e.target.value)} />
          </label>
          {problem && <p className="comp-problem" role="alert">{problem}</p>}
          <button type="submit" className="comp-start" disabled={!!problem}>Start round</button>
          <small className="comp-note">The solves go into this session like any other.</small>
        </form>

        {past.length > 0 && (
          <>
            <h2 className="comp-past-head">Past rounds</h2>
            <ol className="avg-detail-list comp-past">
              {past.map(p => (
                <li key={p.startAt}>
                  <span className="avg-time">{p.cutoffMissed ? "Cut" : p.result == null ? "–" : p.result < 0 ? "DNF" : fmt(p.result)}</span>
                  <span className="comp-past-times">{p.times.map(([t, pen]) => attemptText(t, pen)).join("  ")}</span>
                  <span className="avg-date">{FORMATS[p.format].label} · {dateText(p.startAt)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// During a round: which attempt is next, the rules, and the times so far.
export function MockCompBar({ round, status, onEnd }: { round: Round; status: RoundStatus; onEnd: () => void }) {
  const f = FORMATS[round.format];
  const [confirm, setConfirm] = useState(false);
  const rules = [round.cutoff != null && `cutoff ${fmt(round.cutoff)}`, round.limit != null && `limit ${fmt(round.limit)}`].filter(Boolean).join(" · ");
  return (
    <div className="panel comp-bar dimmable" role="status">
      <div className="comp-bar-head">
        <b>Mock {f.label} · attempt {Math.min(status.attempts.length + 1, f.n)} of {f.n}</b>
        {confirm
          ? <span className="comp-end-confirm">End the round? <button type="button" className="link-btn" onClick={onEnd}>End</button> <button type="button" className="link-btn" onClick={() => setConfirm(false)}>Keep going</button></span>
          : <button type="button" className="link-btn" onClick={() => setConfirm(true)}>End round</button>}
      </div>
      {rules && <small className="comp-rules">{rules[0].toUpperCase() + rules.slice(1)}</small>}
      <Attempts round={round} attempts={status.attempts} />
    </div>
  );
}

function Attempts({ round, attempts, trimmed }: { round: Round; attempts: Solve[]; trimmed?: Set<number> }) {
  const n = FORMATS[round.format].n;
  return (
    <ol className="comp-attempts">
      {Array.from({ length: n }, (_, i) => {
        const s = attempts[i];
        const text = s ? attemptText(s.t, s.pen) : "–";
        return (
          <li key={i} className={s ? (s.pen === DNF ? "dnf" : "") : "empty"}>
            <i>{i + 1}</i>
            <span>{trimmed?.has(i) ? `(${text})` : text}</span>
          </li>
        );
      })}
    </ol>
  );
}

// The round's result: the average (with the best and worst in brackets, as on a results page), or
// the cutoff it missed.
export function MockCompResult({ round, status, sessionBest, onAgain, onDone }: {
  round: Round; status: RoundStatus; sessionBest: number | null; onAgain: () => void; onDone: () => void;
}) {
  const f = FORMATS[round.format];
  const trimmed = new Set<number>();
  if (round.format === "ao5" && status.attempts.length >= 5) {
    const order = status.attempts.slice(0, 5).map((s, i) => [eff(s), i] as const).sort((a, b) => a[0] - b[0]);
    trimmed.add(order[0][1]);
    trimmed.add(order[4][1]);
  }
  const better = status.result != null && isFinite(status.result) && (sessionBest == null || status.result < sessionBest);
  return (
    <div className="panel comp-result dimmable" role="status">
      <div className="comp-bar-head">
        <span className="label">Mock {f.label} · done</span>
        <button type="button" className="overlay-close" aria-label="Close" onClick={onDone}>✕</button>
      </div>
      <div className="comp-result-main">
        <div>
          <small>{status.cutoffMissed ? "Missed the cutoff" : f.label}</small>
          <b className="comp-result-value">{status.cutoffMissed ? fmt(round.cutoff) : resultText(status.result)}</b>
        </div>
        <div>
          <small>Best single</small>
          <b>{resultText(status.best)}</b>
        </div>
      </div>
      <Attempts round={round} attempts={status.attempts} trimmed={trimmed} />
      <small className="comp-compare">
        {status.cutoffMissed
          ? `You needed a solve under ${fmt(round.cutoff)} in the first ${f.cutoffAfter === 1 ? "attempt" : `${f.cutoffAfter} attempts`}.`
          : better && sessionBest != null ? `Better than your best ${f.label} in this session before the round (${fmt(sessionBest)}).`
          : sessionBest != null ? `Your best ${f.label} in this session before the round: ${fmt(sessionBest)}.`
          : ""}
      </small>
      <div className="comp-result-actions">
        <button type="button" onClick={onAgain}>Another round</button>
        <button type="button" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}
