import { memo, useMemo } from "react";
import { avgOf, bestRolling, bestSingle, eff, fmt, rolling, type Solve } from "../lib/stats";
import { CountUp } from "./CountUp";
import { pbAo5Key, useFirstPb } from "../lib/pbCountUp";

const count = (v: number | null) => (v == null ? "0" : String(Math.round(v)));

// Phones, top of the Solves page: the number you check most (the current Ao5) big, how it moved
// with the last solve, and Ao12, best single and the count beside it. The full table follows.
export const StatsHero = memo(function StatsHero({ solves }: { solves: Solve[] }) {
  const s = useMemo(() => {
    const ao5s = rolling(solves, avgOf, 5);
    const ao5 = ao5s[ao5s.length - 1] ?? null;
    const prev = ao5s[ao5s.length - 2] ?? null;
    const best5 = bestRolling(solves, avgOf, 5);
    const ao12s = rolling(solves, avgOf, 12);
    return {
      ao5, best5,
      delta: ao5 != null && prev != null && isFinite(ao5) && isFinite(prev) ? ao5 - prev : null,
      ao12: ao12s[ao12s.length - 1] ?? null,
      single: bestSingle(solves),
      last: solves.length ? eff(solves[solves.length - 1]) : null,
    };
  }, [solves]);

  // The numbers count up only the first time this card shows a new PB Ao5.
  const counting = useFirstPb("solves", pbAo5Key(solves));

  // Under five solves there's no Ao5 yet: lead with the last solve instead.
  const lead = s.ao5 != null;
  const pb = lead && s.ao5 === s.best5 && isFinite(s.ao5!) && solves.length > 5;
  return (
    <div className="panel stats-hero">
      <div className="hero-main">
        <span className="hero-label">{lead ? "Current Ao5" : "Last solve"}{pb && <span className="hero-pb">PB</span>}</span>
        <CountUp className="hero-value" value={lead ? s.ao5 : s.last} format={fmt} animate={counting} />
        {s.delta != null && Math.round(s.delta / 10) !== 0 ? (
          <span className={`hero-delta ${s.delta < 0 ? "down" : "up"}`}>
            {s.delta < 0 ? "▼" : "▲"} {fmt(Math.abs(s.delta))} <span>since last solve</span>
          </span>
        ) : s.delta != null ? <span className="hero-delta">No change since last solve</span>
          : !lead ? <span className="hero-delta">Ao5 in {5 - solves.length} more {solves.length === 4 ? "solve" : "solves"}</span> : null}
      </div>
      <dl className="hero-side">
        <div><dt>Ao12</dt><dd><CountUp value={s.ao12} format={fmt} animate={counting} /></dd></div>
        <div><dt>Best</dt><dd><CountUp value={s.single} format={fmt} animate={counting} /></dd></div>
        <div><dt>Solves</dt><dd><CountUp value={solves.length} format={count} animate={counting} /></dd></div>
      </dl>
    </div>
  );
});
