import { memo, useMemo } from "react";
import { avgOf, bestRolling, bestSingle, eff, fmt, rolling, type Solve } from "../lib/stats";

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

  // Under five solves there's no Ao5 yet: lead with the last solve instead.
  const lead = s.ao5 != null;
  const pb = lead && s.ao5 === s.best5 && isFinite(s.ao5!) && solves.length > 5;
  return (
    <div className="panel stats-hero">
      <div className="hero-main">
        <span className="hero-label">{lead ? "Current Ao5" : "Last solve"}{pb && <span className="hero-pb">PB</span>}</span>
        <b className="hero-value">{fmt(lead ? s.ao5 : s.last)}</b>
        {s.delta != null && Math.round(s.delta / 10) !== 0 ? (
          <span className={`hero-delta ${s.delta < 0 ? "down" : "up"}`}>
            {s.delta < 0 ? "▼" : "▲"} {fmt(Math.abs(s.delta))} <span>since last solve</span>
          </span>
        ) : s.delta != null ? <span className="hero-delta">No change since last solve</span>
          : !lead ? <span className="hero-delta">Ao5 in {5 - solves.length} more {solves.length === 4 ? "solve" : "solves"}</span> : null}
      </div>
      <dl className="hero-side">
        <div><dt>Ao12</dt><dd>{fmt(s.ao12)}</dd></div>
        <div><dt>Best</dt><dd>{fmt(s.single)}</dd></div>
        <div><dt>Solves</dt><dd>{solves.length}</dd></div>
      </dl>
    </div>
  );
});
