import { memo, useMemo, useState } from "react";
import { averageWindow, avgOf, bestRolling, bestSingle, DNF, eff, fmt, meanOf, type Solve, type Stat } from "../lib/stats";
import { CubeGlyph } from "./SessionPicker";
import { AverageDetail } from "./AverageDetail";

const ROWS: [string, Stat | null, number][] = [
  ["Single", null, 1], ["Mo3", meanOf, 3], ["Ao5", avgOf, 5], ["Ao12", avgOf, 12], ["Ao100", avgOf, 100],
];

// el: the tapped value, which the popup's big value flies out of and back into.
type Open = { row: number; which: "current" | "best"; el: HTMLElement };

// memo: the timer re-renders the app every frame while it runs; this only needs to when the solves change.
export const StatsPanel = memo(function StatsPanel({ solves, cube, puzzle }: { solves: Solve[]; cube?: string; puzzle: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const { okCount, mean, values } = useMemo(() => {
    let okCount = 0, sum = 0;
    for (const s of solves) if (s.pen !== DNF) { okCount++; sum += eff(s); }
    const values = ROWS.map(([, fn, n]) => fn
      ? { cur: fn(solves, n), best: bestRolling(solves, fn, n) }
      : { cur: solves.length ? eff(solves[solves.length - 1]) : null, best: bestSingle(solves) });
    return { okCount, mean: okCount ? sum / okCount : null, values };
  }, [solves]);

  // Re-worked out from the solves as they are now, so a penalty or delete updates the open list.
  const openRow = open && ROWS[open.row];
  const win = useMemo(
    () => (openRow && openRow[1] && open ? averageWindow(solves, openRow[1], openRow[2], open.which) : null),
    [solves, openRow, open],
  );

  // Averages are tappable: they open the solves behind them.
  const cell = (row: number, which: Open["which"], value: number | null, className: string) => {
    const fn = ROWS[row][1];
    if (!fn || value == null) return <td className={className}>{fmt(value)}</td>;
    return (
      <td className={className}>
        <button type="button" className="stat-btn" aria-label={`${ROWS[row][0]} ${which}: ${fmt(value)}, show solves`}
          onClick={e => setOpen({ row, which, el: e.currentTarget })}>{fmt(value)}</button>
      </td>
    );
  };

  return (
    <div className="panel">
      <h2><span>Statistics · {puzzle}</span>{cube && <span className="stats-cube"><CubeGlyph /> {cube}</span>}</h2>
      <table className="stats">
        <thead><tr><th></th><th>Current</th><th>Best</th></tr></thead>
        <tbody>
          {ROWS.map(([name], row) => {
            const { cur, best } = values[row];
            const pb = cur != null && cur === best && isFinite(cur);
            return <tr key={name}><td>{name}</td>{cell(row, "current", cur, pb ? "best" : "")}{cell(row, "best", best, "")}</tr>;
          })}
        </tbody>
      </table>
      <div className="summary">
        <span>Solves <b>{okCount === solves.length ? solves.length : `${okCount}/${solves.length}`}</b></span>
        <span>Mean <b>{fmt(mean)}</b></span>
      </div>
      {open && win && openRow && (
        <AverageDetail label={openRow[0]} which={open.which} win={win} origin={open.el} onClose={() => setOpen(null)} />
      )}
    </div>
  );
});
