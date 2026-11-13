import { memo, useMemo, useState, type FormEvent } from "react";
import { averageWindow, avgOf, bestRolling, bestSingle, DNF, eff, fmt, meanOf, rolling, shortTime, type Solve, type Stat } from "../lib/stats";
import { CubeGlyph } from "./SessionPicker";
import { AverageDetail } from "./AverageDetail";
import { PbHistory } from "./PbHistory";
import { CompareRanges } from "./CompareRanges";
import { SplitBars } from "./SplitsLine";
import { splitMeans } from "../lib/splits";
import type { PuzzleId } from "../lib/puzzles";
import type { Session } from "../lib/sessions";
import { addProblem, MAX_AVG, MIN_AVG, useExtraAverages } from "../lib/extraAverages";

// name, how it's worked out (null: a single), size, and whether you added it (it can be removed).
type Row = [string, Stat | null, number, boolean];
const ROWS: Row[] = [
  ["Single", null, 1, false], ["Mo3", meanOf, 3, false], ["Ao5", avgOf, 5, false], ["Ao12", avgOf, 12, false], ["Ao100", avgOf, 100, false],
];

// el: the tapped value, which the popup's big value flies out of and back into.
type Open = { name: string; which: "current" | "best"; el: HTMLElement };

// memo: the timer re-renders the app every frame while it runs; this only needs to when the solves change.
// sessions: every session, so Compare dates can take in all of this puzzle's.
export const StatsPanel = memo(function StatsPanel({ solves, sessions, cube, puzzle, puzzleId, goal, onGoal }: {
  solves: Solve[]; sessions: Session[]; cube?: string; puzzle: string; puzzleId: PuzzleId; goal?: number; onGoal?: (goal: number | null) => void;
}) {
  const splits = useMemo(() => splitMeans(solves), [solves]);
  const extra = useExtraAverages();
  // Built-in rows plus the averages you added, in order of size.
  const rows = useMemo<Row[]>(
    () => [...ROWS, ...extra.list.map((n): Row => [`Ao${n}`, avgOf, n, true])].sort((a, b) => a[2] - b[2]),
    [extra.list],
  );
  const [open, setOpen] = useState<Open | null>(null);
  const [pbsOpen, setPbsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const { okCount, mean, values } = useMemo(() => {
    let okCount = 0, sum = 0;
    for (const s of solves) if (s.pen !== DNF) { okCount++; sum += eff(s); }
    const values = rows.map(([, fn, n]) => fn
      ? { cur: fn(solves, n), best: bestRolling(solves, fn, n) }
      : { cur: solves.length ? eff(solves[solves.length - 1]) : null, best: bestSingle(solves) });
    return { okCount, mean: okCount ? sum / okCount : null, values };
  }, [solves, rows]);

  // Re-worked out from the solves as they are now, so a penalty or delete updates the open list.
  const openRow = open ? rows.find(r => r[0] === open.name) ?? null : null;
  const win = useMemo(
    () => (openRow && openRow[1] && open ? averageWindow(solves, openRow[1], openRow[2], open.which) : null),
    [solves, openRow, open],
  );

  // Averages are tappable: they open the solves behind them.
  const cell = (row: Row, which: Open["which"], value: number | null, className: string) => {
    const [name, fn] = row;
    if (!fn || value == null) return <td className={className}>{fmt(value)}</td>;
    return (
      <td className={className}>
        <button type="button" className="stat-btn" aria-label={`${name} ${which}: ${fmt(value)}, show solves`}
          onClick={e => setOpen({ name, which, el: e.currentTarget })}>{fmt(value)}</button>
      </td>
    );
  };

  return (
    <div className="panel">
      <h2><span>Statistics · {puzzle}</span>{cube && <span className="stats-cube"><CubeGlyph /> {cube}</span>}</h2>
      <table className="stats">
        <thead><tr><th></th><th>Current</th><th>Best</th></tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const [name, , n, added] = row;
            const { cur, best } = values[i];
            const pb = cur != null && cur === best && isFinite(cur);
            return (
              <tr key={name}>
                <td>
                  {name}
                  {added && <button type="button" className="avg-remove" aria-label={`Remove ${name}`} title={`Remove ${name}`}
                    onClick={() => extra.remove(n)}>✕</button>}
                </td>
                {cell(row, "current", cur, pb ? "best" : "")}{cell(row, "best", best, "")}
              </tr>
            );
          })}
        </tbody>
      </table>
      <AddAverage list={extra.list} onAdd={extra.add} />
      <div className="summary">
        <span>Solves <b>{okCount === solves.length ? solves.length : `${okCount}/${solves.length}`}</b></span>
        <span>Mean <b>{fmt(mean)}</b></span>
      </div>
      {okCount > 0 && (
        <div className="stats-links">
          <button type="button" className="pb-link" onClick={() => setPbsOpen(true)}>PB history ›</button>
          <button type="button" className="pb-link" onClick={() => setCompareOpen(true)}>Compare dates ›</button>
        </div>
      )}
      {splits && (
        <div className="stats-splits">
          <h3>Phases · mean of last {splits.count}</h3>
          <SplitBars times={splits.means} puzzle={puzzleId} label={`Mean phase times of the last ${splits.count} split solves`} />
        </div>
      )}
      {onGoal && <Goal solves={solves} goal={goal} onGoal={onGoal} />}
      {pbsOpen && <PbHistory solves={solves} onClose={() => setPbsOpen(false)} />}
      {compareOpen && <CompareRanges solves={solves} sessions={sessions} puzzle={puzzleId} onClose={() => setCompareOpen(false)} />}
      {open && win && openRow && (
        <AverageDetail label={openRow[0]} which={open.which} win={win} origin={open.el} puzzle={puzzle} cube={cube}
          isBest={(() => { const v = values[rows.indexOf(openRow)]; return v?.best != null && win.value === v.best; })()} onClose={() => setOpen(null)} />
      )}
    </div>
  );
});

// "+ Average" under the table: type a size (e.g. 50) to add an AoN row.
function AddAverage({ list, onAdd }: { list: number[]; onAdd: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const n = Number(draft.trim().replace(/^ao/i, ""));
  const problem = draft.trim() ? addProblem(n, list) : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || problem) return;
    onAdd(n); setDraft(""); setEditing(false);
  };
  if (!editing) return <button type="button" className="avg-add" onClick={() => setEditing(true)}>+ Average</button>;
  return (
    <form className="avg-add-form" onSubmit={submit}>
      <label>
        <span>Ao</span>
        <input type="text" inputMode="numeric" value={draft} autoFocus placeholder="50" aria-label="Number of solves in the average"
          aria-invalid={!!problem} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(""); } }} />
      </label>
      <button type="button" onClick={() => { setEditing(false); setDraft(""); }}>Cancel</button>
      <button type="submit" className="on" disabled={!draft.trim() || !!problem}>Add</button>
      <small className={problem ? "avg-add-problem" : ""}>{problem ?? `${MIN_AVG}–${MAX_AVG} solves, 5% trimmed each end above 12.`}</small>
    </form>
  );
}

const goalText = shortTime;

// Seconds ("12", "12.5") or minutes and seconds ("1:05") to ms; null if it isn't a usable time.
function parseGoal(text: string): number | null {
  const m = text.trim().replace(",", ".").match(/^(?:(\d+):)?(\d+(?:\.\d*)?)$/);
  if (!m) return null;
  const ms = Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000);
  return ms > 0 && ms < 3_600_000 ? ms : null;
}

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

// A sub-X target for the session: how often solves and Ao5s beat it, with the last 100 solves
// as a bar so progress shows.
function Goal({ solves, goal, onGoal }: { solves: Solve[]; goal?: number; onGoal: (goal: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const parsed = parseGoal(draft);

  const stats = useMemo(() => {
    if (!goal) return null;
    const under = (v: number | null) => v != null && v < goal;
    const recent = solves.slice(-100);
    const ao5s = rolling(solves, avgOf, 5).filter(v => v != null);
    return {
      recent: pct(recent.filter(s => under(eff(s))).length, recent.length), recentCount: recent.length,
      all: pct(solves.filter(s => under(eff(s))).length, solves.length),
      ao5: ao5s.length ? pct(ao5s.filter(under).length, ao5s.length) : null,
    };
  }, [solves, goal]);

  const startEdit = () => { setDraft(goal ? goalText(goal) : ""); setEditing(true); };
  const save = (e: FormEvent) => { e.preventDefault(); if (parsed) { onGoal(parsed); setEditing(false); } };

  if (editing) {
    return (
      <form className="goal goal-edit" onSubmit={save}>
        <label>
          <span>Sub</span>
          <input type="text" inputMode="decimal" value={draft} autoFocus placeholder="12" aria-label="Goal time in seconds"
            onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); } }} />
          <span>s</span>
        </label>
        <div className="goal-actions">
          {goal && <button type="button" className="danger" onClick={() => { onGoal(null); setEditing(false); }}>Remove</button>}
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="on" disabled={!parsed}>Save</button>
        </div>
      </form>
    );
  }
  if (!goal || !stats) {
    return <button type="button" className="goal-set" onClick={startEdit}>+ Set a goal, like sub-12</button>;
  }
  return (
    <div className="goal">
      <div className="goal-head">
        <span>Goal · <b>sub-{goalText(goal)}</b></span>
        <button type="button" className="goal-edit-btn" onClick={startEdit}>Edit</button>
      </div>
      <div className="goal-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.recent}
        aria-label={`Last ${stats.recentCount} solves under the goal`}>
        <span style={{ width: `${stats.recent}%` }} />
      </div>
      <div className="goal-stats">
        <span>Last {stats.recentCount} <b>{stats.recent}%</b></span>
        <span>All solves <b>{stats.all}%</b></span>
        {stats.ao5 != null && <span>Ao5s <b>{stats.ao5}%</b></span>}
      </div>
    </div>
  );
}
