import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DNF, eff, fmt, type Penalty, type Solve } from "../lib/stats";
import { FORMATS, parseTime, pastRounds, type CompFormat, type PastRound, type Round, type RoundRecord, type RoundStatus } from "../lib/mockComp";
import { PUZZLE_ORDER, PUZZLES, type PuzzleId } from "../lib/puzzles";
import type { Session } from "../lib/sessions";
import { useLeave } from "../hooks/useLeave";
import { ShareCard } from "./ShareCard";
import type { CardData } from "../lib/shareCard";

const dateText = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The result as a results page shows it: the average, DNF, or the cutoff it missed; "–" when some
// of its solves have since been deleted.
const pastResult = ({ status }: PastRound) =>
  status.cutoffMissed ? "Cut" : status.result == null ? "–" : isFinite(status.result) ? fmt(status.result) : "DNF";

// Which attempts an Ao5 drops (the best and the worst), shown in brackets.
function trimmedOf(format: CompFormat, attempts: Solve[]): Set<number> {
  const trimmed = new Set<number>();
  if (format === "ao5" && attempts.length >= 5) {
    const order = attempts.slice(0, 5).map((s, i) => [eff(s), i] as const).sort((a, b) => a[0] - b[0]);
    trimmed.add(order[0][1]);
    trimmed.add(order[4][1]);
  }
  return trimmed;
}

const timesText = (p: PastRound) => {
  const trimmed = trimmedOf(p.round.format, p.status.attempts);
  return p.status.attempts.map((s, i) => (trimmed.has(i) ? `(${attemptText(s.t, s.pen)})` : attemptText(s.t, s.pen))).join("  ");
};

// A round as a share card: the result (or the cutoff it missed) and every attempt.
function roundCard(round: RoundRecord, status: RoundStatus, puzzle: PuzzleId, cube?: string): CardData {
  const f = FORMATS[round.format];
  const trimmed = trimmedOf(round.format, status.attempts);
  const rules = [round.cutoff != null && `Cutoff ${fmt(round.cutoff)}`, round.limit != null && `time limit ${fmt(round.limit)}`].filter(Boolean).join(" · ");
  return {
    kind: `${PUZZLES[puzzle].label} · ${f.label}`,
    value: status.cutoffMissed ? "Cut" : status.result == null ? "–" : isFinite(status.result) ? fmt(status.result) : "DNF",
    badge: "Mock round",
    times: status.attempts.map((s, i) => ({ text: attemptText(s.t, s.pen), dim: trimmed.has(i) })),
    note: status.cutoffMissed ? `Missed the cutoff of ${fmt(round.cutoff)}` : rules || undefined,
    date: new Date(round.startAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
    cube,
  };
}

// Swallows Space (so the timer behind doesn't arm) and closes on Escape, while an overlay is open.
function useOverlayKeys(close: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space" && !(e.target as Element | null)?.matches?.("input")) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close]);
}
const attemptText = (t: number, pen: Penalty) => (pen === DNF ? "DNF" : `${fmt(t + (pen === 2 ? 2000 : 0))}${pen === 2 ? "+" : ""}`);
const resultText = (v: number | null) => (v == null ? "–" : fmt(v));

// Setting up a round: format, optional cutoff and time limit, and the rounds you've done before.
export function MockCompSetup({ puzzle, past, onStart, onHistory, onClose }: {
  puzzle: PuzzleId; past: PastRound[];
  onStart: (format: CompFormat, cutoff: number | null, limit: number | null) => void; onHistory: () => void; onClose: () => void;
}) {
  const { leaving, close } = useLeave(onClose);
  const here = past.filter(p => p.puzzle === puzzle);
  // Starts from the settings of your last round on this puzzle.
  const lastHere = here[0]?.round;
  const [format, setFormat] = useState<CompFormat>(lastHere?.format ?? (PUZZLES[puzzle].mo3 ? "mo3" : "ao5"));
  const [cutoff, setCutoff] = useState(lastHere?.cutoff ? fmt(lastHere.cutoff) : "");
  const [limit, setLimit] = useState(lastHere?.limit ? fmt(lastHere.limit) : "");
  const c = parseTime(cutoff), l = parseTime(limit);
  const problem = Number.isNaN(c) || Number.isNaN(l) ? "Write times like 20, 20.5 or 1:30."
    : c != null && l != null && c > l ? "The cutoff can't be longer than the time limit." : null;
  useOverlayKeys(close);

  return createPortal(
    <div className={`avg-detail comp-setup${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Mock competition">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Mock competition · {PUZZLES[puzzle].label}</span>
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
            <div className="comp-past-head">
              <h2>{here.length ? "Recent rounds" : "No rounds on this puzzle yet"}</h2>
              <button type="button" className="link-btn" onClick={onHistory}>All rounds ({past.length})</button>
            </div>
            {here.length > 0 && (
              <ol className="avg-detail-list comp-past">
                {here.slice(0, 3).map(p => (
                  <li key={p.round.startAt}>
                    <span className="avg-time">{pastResult(p)}</span>
                    <span className="comp-past-times">{timesText(p)}</span>
                    <span className="avg-date">{FORMATS[p.round.format].label} · {dateText(p.round.startAt)}</span>
                  </li>
                ))}
              </ol>
            )}
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
export function MockCompResult({ round, status, sessionBest, puzzle, cube, onAgain, onHistory, onDone }: {
  round: Round; status: RoundStatus; sessionBest: number | null; puzzle: PuzzleId; cube?: string;
  onAgain: () => void; onHistory: () => void; onDone: () => void;
}) {
  const [sharing, setSharing] = useState<CardData | null>(null);
  const f = FORMATS[round.format];
  const trimmed = trimmedOf(round.format, status.attempts);
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
        <button type="button" onClick={() => setSharing(roundCard(round, status, puzzle, cube))}>Share</button>
        <button type="button" className="link-btn" onClick={onHistory}>All rounds</button>
      </div>
      {sharing && <ShareCard data={sharing} onClose={() => setSharing(null)} />}
    </div>
  );
}

// Every round you've kept, by puzzle and format: your best result, how the recent ones went, and
// each round's attempts. Deleting a round keeps its solves in the session.
export function MockCompHistory({ sessions, puzzle: startPuzzle, onDelete, onClose }: {
  sessions: Session[]; puzzle: PuzzleId; onDelete: (sid: string, startAt: number) => void; onClose: () => void;
}) {
  const { leaving, close } = useLeave(onClose);
  useOverlayKeys(close);
  const all = useMemo(() => pastRounds(sessions), [sessions]);
  const puzzles = PUZZLE_ORDER.filter(p => all.some(r => r.puzzle === p));
  const [pick, setPuzzle] = useState(startPuzzle);
  const puzzle = puzzles.includes(pick) ? pick : puzzles[0] ?? pick;
  const here = all.filter(r => r.puzzle === puzzle);
  const formats = (Object.keys(FORMATS) as CompFormat[]).filter(f => here.some(r => r.round.format === f));
  const [pickFormat, setFormat] = useState<CompFormat>("ao5");
  const format = formats.includes(pickFormat) ? pickFormat : formats[0] ?? pickFormat;
  const list = here.filter(r => r.round.format === format);
  const [confirm, setConfirm] = useState<number | null>(null);

  const results = list.filter(r => !r.status.cutoffMissed && r.status.result != null && isFinite(r.status.result)).map(r => r.status.result!);
  const best = results.length ? Math.min(...results) : null;
  const bestRound = best == null ? null : list.find(r => r.status.result === best) ?? null;
  const recent = results.slice(0, 5);
  const recentMean = recent.length >= 2 ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const cuts = list.filter(r => r.status.cutoffMissed).length;
  const label = FORMATS[format].label;

  return createPortal(
    <div className={`avg-detail comp-history${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Mock competition history">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Mock comp history{list.length ? ` · ${PUZZLES[puzzle].label} · best ${label}` : ""}</span>
            <div className="avg-detail-value">{best != null ? fmt(best) : "–"}</div>
            <small className="avg-detail-when">
              {!all.length ? "No rounds yet. Finish a mock round and it shows up here."
                : <>
                    {list.length} {list.length === 1 ? "round" : "rounds"}
                    {bestRound && <> · best on {dateText(bestRound.round.startAt)}</>}
                    {recentMean != null && <> · last {recent.length} average {fmt(recentMean)}</>}
                    {cuts > 0 && <> · missed the cutoff {cuts === 1 ? "once" : `${cuts} times`}</>}
                  </>}
            </small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        {all.length > 0 && (
          <div className="comp-history-tabs">
            {puzzles.length > 1 && (
              <div className="view-tabs" role="tablist" aria-label="Puzzle">
                {puzzles.map(p => (
                  <button key={p} type="button" role="tab" aria-selected={puzzle === p} className={puzzle === p ? "on" : ""}
                    onClick={() => { setPuzzle(p); setConfirm(null); }}>{PUZZLES[p].short}</button>
                ))}
              </div>
            )}
            {formats.length > 1 && (
              <div className="view-tabs" role="tablist" aria-label="Format">
                {formats.map(f => (
                  <button key={f} type="button" role="tab" aria-selected={format === f} className={format === f ? "on" : ""}
                    onClick={() => { setFormat(f); setConfirm(null); }}>
                    {FORMATS[f].label} <span>{here.filter(r => r.round.format === f).length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {list.length > 0 && (
          <ol className="avg-detail-list comp-past comp-history-list">
            {list.map(p => {
              const { round } = p;
              const rules = [round.cutoff != null && `cutoff ${fmt(round.cutoff)}`, round.limit != null && `limit ${fmt(round.limit)}`].filter(Boolean).join(", ");
              const isBest = p === bestRound;
              return (
                <li key={round.startAt} className={confirm === round.startAt ? "confirming" : ""}>
                  <span className={`avg-time${isBest ? " comp-best" : ""}${p.status.cutoffMissed ? " comp-cut" : ""}`}>{pastResult(p)}</span>
                  <span className="comp-past-times">{timesText(p) || "No solves left"}</span>
                  <span className="avg-date">
                    {dateText(round.startAt)} · {p.session}{rules && ` · ${rules}`}
                    {p.status.result == null && !p.status.cutoffMissed && " · some solves were deleted"}
                  </span>
                  {confirm === round.startAt
                    ? <span className="comp-delete-confirm">
                        Delete this round? Its solves stay in the session.
                        <button type="button" className="link-btn danger" onClick={() => { onDelete(p.sid, round.startAt); setConfirm(null); }}>Delete</button>
                        <button type="button" className="link-btn" onClick={() => setConfirm(null)}>Keep</button>
                      </span>
                    : <button type="button" className="comp-delete" aria-label={`Delete the round on ${dateText(round.startAt)}`}
                        onClick={() => setConfirm(round.startAt)}>✕</button>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
