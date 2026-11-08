import { avgOf, bestRolling, DNF, eff, fmt, meanOf, type Solve, type Stat } from "../lib/stats";
import { CubeGlyph } from "./SessionPicker";

const ROWS: [string, Stat | null, number][] = [
  ["Single", null, 1], ["Mo3", meanOf, 3], ["Ao5", avgOf, 5], ["Ao12", avgOf, 12], ["Ao100", avgOf, 100],
];

export function StatsPanel({ solves, cube, puzzle }: { solves: Solve[]; cube?: string; puzzle: string }) {
  const ok = solves.filter(s => s.pen !== DNF);
  const mean = ok.length ? ok.reduce((a, s) => a + eff(s), 0) / ok.length : null;

  return (
    <div className="panel">
      <h2><span>Statistics · {puzzle}</span>{cube && <span className="stats-cube"><CubeGlyph /> {cube}</span>}</h2>
      <table className="stats">
        <thead><tr><th></th><th>Current</th><th>Best</th></tr></thead>
        <tbody>
          {ROWS.map(([name, fn, n]) => {
            const cur = fn ? fn(solves, n) : solves.length ? eff(solves[solves.length - 1]) : null;
            const best = fn ? bestRolling(solves, fn, n) : solves.length ? Math.min(...solves.map(eff)) : null;
            const pb = cur != null && cur === best && isFinite(cur);
            return <tr key={name}><td>{name}</td><td className={pb ? "best" : ""}>{fmt(cur)}</td><td>{fmt(best)}</td></tr>;
          })}
        </tbody>
      </table>
      <div className="summary">
        <span>Solves <b>{ok.length === solves.length ? solves.length : `${ok.length}/${solves.length}`}</b></span>
        <span>Mean <b>{fmt(mean)}</b></span>
      </div>
    </div>
  );
}
