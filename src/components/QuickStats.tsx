import { memo, useMemo } from "react";
import { avgOf, DNF, eff, fmt, type Solve } from "../lib/stats";

// Compact stats card under the timer on phones: current Ao5, Ao12, Ao100 and the session mean.
export const QuickStats = memo(function QuickStats({ solves }: { solves: Solve[] }) {
  const items = useMemo((): [string, number | null][] => {
    let ok = 0, sum = 0;
    for (const s of solves) if (s.pen !== DNF) { ok++; sum += eff(s); }
    return [["Ao5", avgOf(solves, 5)], ["Ao12", avgOf(solves, 12)], ["Ao100", avgOf(solves, 100)], ["Mean", ok ? sum / ok : null]];
  }, [solves]);
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
});
