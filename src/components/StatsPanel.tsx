import { useState } from "react";
import { averageWindow, avgOf, bestRolling, DNF, eff, fmt, meanOf, type Solve, type Stat } from "../lib/stats";
import { CubeGlyph } from "./SessionPicker";
import { AverageDetail } from "./AverageDetail";

const ROWS: [string, Stat | null, number][] = [
  ["Single", null, 1], ["Mo3", meanOf, 3], ["Ao5", avgOf, 5], ["Ao12", avgOf, 12], ["Ao100", avgOf, 100],
];

type Open = { row: number; which: "current" | "best" };

export function StatsPanel({ solves, cube, puzzle }: { solves: Solve[]; cube?: string; puzzle: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const ok = solves.filter(s => s.pen !== DNF);
  const mean = ok.length ? ok.reduce((a, s) => a + eff(s), 0) / ok.length : null;

  // Re-worked out from the solves as they are now, so a penalty or delete updates the open list.
  const openRow = open && ROWS[open.row];
  const win = openRow && openRow[1] ? averageWindow(solves, openRow[1], openRow[2], open.which) : null;

  // Averages are tappable: they open the solves behind them.
  const cell = (row: number, which: Open["which"], value: number | null, className: string) => {
    const fn = ROWS[row][1];
    if (!fn || value == null) return <td className={className}>{fmt(value)}</td>;
    return (
      <td className={className}>
        <button type="button" className="stat-btn" aria-label={`${ROWS[row][0]} ${which}: ${fmt(value)}, show solves`}
          onClick={() => setOpen({ row, which })}>{fmt(value)}</button>
      </td>
    );
  };

  return (
    <div className="panel">
      <h2><span>Statistics · {puzzle}</span>{cube && <span className="stats-cube"><CubeGlyph /> {cube}</span>}</h2>
      <table className="stats">
        <thead><tr><th></th><th>Current</th><th>Best</th></tr></thead>
        <tbody>
          {ROWS.map(([name, fn, n], row) => {
            const cur = fn ? fn(solves, n) : solves.length ? eff(solves[solves.length - 1]) : null;
            const best = fn ? bestRolling(solves, fn, n) : solves.length ? Math.min(...solves.map(eff)) : null;
            const pb = cur != null && cur === best && isFinite(cur);
            return <tr key={name}><td>{name}</td>{cell(row, "current", cur, pb ? "best" : "")}{cell(row, "best", best, "")}</tr>;
          })}
        </tbody>
      </table>
      <div className="summary">
        <span>Solves <b>{ok.length === solves.length ? solves.length : `${ok.length}/${solves.length}`}</b></span>
        <span>Mean <b>{fmt(mean)}</b></span>
      </div>
      {open && win && openRow && (
        <AverageDetail label={openRow[0]} which={open.which} win={win} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
