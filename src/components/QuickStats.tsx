import { avgOf, DNF, eff, fmt, type Solve } from "../lib/stats";

// Compact stats card under the timer on phones: current Ao5, Ao12, Ao100 and the session mean.
export function QuickStats({ solves }: { solves: Solve[] }) {
  const ok = solves.filter(s => s.pen !== DNF);
  const mean = ok.length ? ok.reduce((a, s) => a + eff(s), 0) / ok.length : null;
  const items: [string, number | null][] = [
    ["Ao5", avgOf(solves, 5)], ["Ao12", avgOf(solves, 12)], ["Ao100", avgOf(solves, 100)], ["Mean", mean],
  ];
  return (
    <div className="quick-stats panel dimmable" aria-label="Session averages">
      {items.map(([label, v]) => (
        <div key={label} className="quick-stat">
          <span>{label}</span>
          <b>{fmt(v)}</b>
        </div>
      ))}
    </div>
  );
}
