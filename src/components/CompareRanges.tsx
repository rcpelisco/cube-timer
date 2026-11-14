import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { avgOf, bestRolling, bestSingle, DNF, eff, fmt, type Solve } from "../lib/stats";
import { useLeave } from "../hooks/useLeave";
import type { Session } from "../lib/sessions";
import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { ScopeToggle } from "./SolveScope";
import { useSolveScope } from "../hooks/useSolveScope";

// Two stretches of time side by side, e.g. this month against last month: how many solves, the
// mean, best single and averages in each, and the change. This session's solves, or every
// session's for the puzzle (the same choice as the Progress chart).

type Preset = "week" | "month" | "30d" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "30d", label: "30 days" }, { id: "custom", label: "Custom" },
];

// A range is local midnight `from` up to (not including) local midnight after `to`.
interface Range { from: Date; to: Date; label: string }

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayText = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const spanText = (r: Range) => (r.from.getTime() === r.to.getTime() ? dayText(r.from) : `${dayText(r.from)} – ${dayText(r.to)}`);
// For <input type="date">: "2026-11-13" in local time.
const inputText = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromInput = (v: string): Date | null => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// [earlier, later] for a preset, as of today.
function presetRanges(p: Exclude<Preset, "custom">, now = new Date()): [Range, Range] {
  const today = midnight(now);
  if (p === "week") {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    return [
      { from: addDays(monday, -7), to: addDays(monday, -1), label: "Last week" },
      { from: monday, to: today, label: "This week" },
    ];
  }
  if (p === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return [
      { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: addDays(first, -1), label: "Last month" },
      { from: first, to: today, label: "This month" },
    ];
  }
  return [
    { from: addDays(today, -59), to: addDays(today, -30), label: "30 days before" },
    { from: addDays(today, -29), to: today, label: "Last 30 days" },
  ];
}

interface Summary { count: number; ok: number; mean: number | null; trimmed: number | null; single: number | null; ao5: number | null; ao12: number | null; dnf: number | null }

function summarise(solves: Solve[], r: Range): Summary {
  const lo = r.from.getTime(), hi = addDays(r.to, 1).getTime();
  const list = solves.filter(s => s.at >= lo && s.at < hi);
  const times = list.filter(s => s.pen !== DNF).map(eff).sort((a, b) => a - b);
  const cut = Math.floor(times.length * 0.05);
  const kept = times.slice(cut, times.length - cut);
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  return {
    count: list.length, ok: times.length,
    mean: times.length ? sum(times) / times.length : null,
    trimmed: kept.length ? sum(kept) / kept.length : null,
    single: bestSingle(list), ao5: bestRolling(list, avgOf, 5), ao12: bestRolling(list, avgOf, 12),
    dnf: list.length ? ((list.length - times.length) / list.length) * 100 : null,
  };
}

type RowDef = { name: string; hint?: string; value: (s: Summary) => number | null; show: (v: number) => string; lowerBetter: boolean | null; diff: (d: number) => string };
const timeRow = (name: string, value: RowDef["value"], hint?: string): RowDef =>
  ({ name, hint, value, show: v => fmt(v), lowerBetter: true, diff: d => fmt(Math.abs(d)) });
const ROWS: RowDef[] = [
  // More or fewer solves isn't better or worse, so the change isn't coloured.
  { name: "Solves", value: s => s.count, show: v => String(v), lowerBetter: null, diff: d => String(Math.abs(d)) },
  timeRow("Mean", s => s.mean),
  timeRow("Average", s => s.trimmed, "Fastest and slowest 5% left out"),
  timeRow("Best single", s => s.single),
  timeRow("Best Ao5", s => s.ao5),
  timeRow("Best Ao12", s => s.ao12),
  // Whole percents, so the change matches the two numbers shown.
  { name: "DNF rate", value: s => (s.dnf == null ? null : Math.round(s.dnf)), show: v => `${v}%`, lowerBetter: true, diff: d => `${Math.abs(d)} pts` },
];

export function CompareRanges({ solves: own, sessions, puzzle, onClose }: { solves: Solve[]; sessions: Session[]; puzzle: PuzzleId; onClose: () => void }) {
  const { leaving, close, sheet } = useLeave(onClose);
  const scope = useSolveScope(own, sessions, puzzle);
  const { solves } = scope;
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<[Range, Range]>(() => {
    const [a, b] = presetRanges("month");
    return [{ ...a, label: "First" }, { ...b, label: "Second" }];
  });
  const ranges = useMemo(() => (preset === "custom" ? custom : presetRanges(preset)), [preset, custom]);
  const [a, b] = ranges;
  const sa = useMemo(() => summarise(solves, a), [solves, a]);
  const sb = useMemo(() => summarise(solves, b), [solves, b]);

  // Esc closes. Space is swallowed so it doesn't arm the timer behind this view.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space" && !(e.target as Element | null)?.matches?.("input")) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close]);

  const setDay = (which: 0 | 1, end: "from" | "to", v: string) => {
    const d = fromInput(v);
    if (!d) return;
    setCustom(cur => {
      const next: [Range, Range] = [{ ...cur[0] }, { ...cur[1] }];
      const r = next[which];
      r[end] = d;
      // Keep from ≤ to: moving one end past the other moves both.
      if (r.from > r.to) { if (end === "from") r.to = d; else r.from = d; }
      return next;
    });
  };

  return createPortal(
    <div ref={sheet} className={`avg-detail compare${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Compare two date ranges">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Compare · {PUZZLES[puzzle].label}</span>
            <div className="compare-title">{a.label} <span>vs</span> {b.label}</div>
            <small className="avg-detail-when">{spanText(a)} · {spanText(b)}</small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        <div className="view-tabs" role="tablist" aria-label="Ranges">
          {PRESETS.map(p => (
            <button key={p.id} type="button" role="tab" aria-selected={preset === p.id} className={preset === p.id ? "on" : ""} onClick={() => setPreset(p.id)}>{p.label}</button>
          ))}
        </div>

        <ScopeToggle scope={scope} puzzle={puzzle} />

        {preset === "custom" && (
          <div className="compare-custom">
            {([0, 1] as const).map(i => (
              <fieldset key={i}>
                <legend>{custom[i].label}</legend>
                <label><span>From</span><input type="date" value={inputText(custom[i].from)} onChange={e => setDay(i, "from", e.target.value)} /></label>
                <label><span>To</span><input type="date" value={inputText(custom[i].to)} onChange={e => setDay(i, "to", e.target.value)} /></label>
              </fieldset>
            ))}
          </div>
        )}

        <table className="stats compare-table">
          <thead><tr><th></th><th>{a.label}</th><th>{b.label}</th><th>Change</th></tr></thead>
          <tbody>
            {ROWS.map(r => {
              const va = r.value(sa), vb = r.value(sb);
              const d = va != null && vb != null && isFinite(va) && isFinite(vb) ? vb - va : null;
              const better = d != null && d !== 0 && (r.lowerBetter ? d < 0 : d > 0);
              const cls = d == null || d === 0 || r.lowerBetter == null ? "" : better ? "better" : "worse";
              return (
                <tr key={r.name}>
                  <td title={r.hint}>{r.name}</td>
                  <td>{va == null ? "–" : r.show(va)}</td>
                  <td>{vb == null ? "–" : r.show(vb)}</td>
                  <td className={cls}>{d == null ? "–" : d === 0 ? "=" : `${d < 0 ? "−" : "+"}${r.diff(d)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <small className="compare-note">
          {sa.count === 0 && sb.count === 0 ? "No solves in either range." : "Average leaves out the fastest and slowest 5% of each range's times. Best Ao5 and Ao12 only count solves inside the range."}
        </small>
      </div>
    </div>,
    document.body,
  );
}
