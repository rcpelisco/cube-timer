import { memo, useMemo } from "react";
import { avgOf, DNF, eff, fmt, type Solve } from "../lib/stats";
import { CountUp } from "./CountUp";
import { pbAo5Key, useFirstPb } from "../lib/pbCountUp";

// Compact stats card under the timer on phones: current Ao5, Ao12, Ao100 and the session mean.
// When a solve sets a new PB Ao5, the Ao5 counts up from the old one to it (the first time only).
export const QuickStats = memo(function QuickStats({ solves }: { solves: Solve[] }) {
  const items = useMemo((): [string, number | null][] => {
    let ok = 0, sum = 0;
    for (const s of solves) if (s.pen !== DNF) { ok++; sum += eff(s); }
    return [["Ao5", avgOf(solves, 5)], ["Ao12", avgOf(solves, 12)], ["Ao100", avgOf(solves, 100)], ["Mean", ok ? sum / ok : null]];
  }, [solves]);
  const counting = useFirstPb("timer", pbAo5Key(solves));
  return (
    <div className="quick-stats panel dimmable" aria-label="Session averages">
      {items.map(([label, v]) => (
        <div key={label} className="quick-stat">
          <span>{label}</span>
          {label === "Ao5" ? <CountUp value={v} format={fmt} animate={counting} fromZero={false} /> : <b>{fmt(v)}</b>}
        </div>
      ))}
    </div>
  );
});
