import { useMemo } from "react";
import { useChartWidth } from "../hooks/useChartWidth";
import { DNF, eff, fmt, type Solve } from "../lib/stats";

const H = 120, L = 44, R = 8, T = 8, B = 18;
const DAY_MS = 86_400_000;

type Period = "day" | "week" | "month";

// A local calendar day as a whole number (see Days.tsx), and back.
const dayOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
const dateOf = (day: number) => { const u = new Date(day * DAY_MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };

// Each period as a whole number, so periods can be counted and gaps left where you didn't practise.
// Weeks start on Monday.
function periodOf(at: number, p: Period): number {
  const d = new Date(at);
  if (p === "month") return d.getFullYear() * 12 + d.getMonth();
  const day = dayOf(d);
  return p === "day" ? day : (day - ((d.getDay() + 6) % 7)) / 7;
}
function periodStart(k: number, p: Period): Date {
  if (p === "month") return new Date(Math.floor(k / 12), k % 12, 1);
  return dateOf(p === "day" ? k : k * 7);
}
const periodText = (k: number, p: Period) => {
  const d = periodStart(k, p);
  return p === "month" ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : p === "week" ? `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
const axisText = (k: number, p: Period) =>
  periodStart(k, p).toLocaleDateString(undefined, p === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });

interface Point { k: number; avg: number; best: number; count: number }

// The session over its whole life rather than the last 50 solves: your average and best single
// for each day, week or month (whichever fits how long you've been at it). The average drops the
// fastest and slowest 5% of the period's times, so one bad solve doesn't swing it; DNFs are left out.
export function Progress({ solves, goal }: { solves: Solve[]; goal?: number }) {
  const data = useMemo(() => {
    if (solves.length === 0) return null;
    let lo = Infinity, hi = -Infinity;
    for (const s of solves) { lo = Math.min(lo, s.at); hi = Math.max(hi, s.at); }
    const days = dayOf(new Date(hi)) - dayOf(new Date(lo));
    const period: Period = days <= 21 ? "day" : days <= 182 ? "week" : "month";

    const groups = new Map<number, number[]>();
    for (const s of solves) {
      if (s.pen === DNF) continue;
      const k = periodOf(s.at, period);
      const g = groups.get(k);
      if (g) g.push(eff(s)); else groups.set(k, [eff(s)]);
    }
    const points: Point[] = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, vals]) => {
      vals.sort((a, b) => a - b);
      const cut = Math.floor(vals.length * 0.05);
      const kept = vals.slice(cut, vals.length - cut);
      return { k, avg: kept.reduce((a, b) => a + b, 0) / kept.length, best: vals[0], count: vals.length };
    });
    return { period, points };
  }, [solves]);

  const unit = data?.period ?? "day";
  const enough = data != null && data.points.length >= 2;
  const first = data?.points[0], last = data?.points[data.points.length - 1];

  return (
    <>
      <h2>
        <span>Progress · by {unit}</span>
        <span>{enough ? `${data.points.length} ${unit}s` : ""}</span>
      </h2>
      {!enough || !first || !last ? (
        <div className="empty">The chart appears once you've solved on two different days.</div>
      ) : (
        <>
          <Chart points={data.points} period={data.period} goal={goal} />
          <div className="legend"><span className="l-ao5">Average</span><span className="l-single">Best</span></div>
          <div className="legend spread-legend">
            <span>First {unit} <b>{fmt(first.avg)}</b></span>
            <span>Latest <b>{fmt(last.avg)}</b></span>
            <span>Change <b>{last.avg <= first.avg ? "−" : "+"}{fmt(Math.abs(first.avg - last.avg))}</b></span>
          </div>
        </>
      )}
    </>
  );
}

function Chart({ points, period, goal }: { points: Point[]; period: Period; goal?: number }) {
  const [svgRef, W] = useChartWidth();
  const k0 = points[0].k, k1 = points[points.length - 1].k;
  let lo = Math.min(...points.map(p => p.best)), hi = Math.max(...points.map(p => p.avg));
  if (hi - lo < 200) { const m = (hi + lo) / 2; lo = m - 100; hi = m + 100; }
  const pad = (hi - lo) * 0.06;
  lo -= pad; hi += pad;
  const X = (k: number) => L + ((k - k0) / (k1 - k0)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (v: (p: Point) => number) => points.map((p, i) => `${i ? "L" : "M"}${X(p.k).toFixed(1)},${Y(v(p)).toFixed(1)}`).join("");
  const goalY = goal != null && goal > lo && goal < hi ? Y(goal) : null;
  const dots = points.length <= 40;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Average and best single by ${period}: ${points.map(p => `${periodText(p.k, period)}: average ${fmt(p.avg)}, best ${fmt(p.best)}`).join("; ")}`}>
      {[hi - pad, (hi + lo) / 2, lo + pad].map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">{fmt(v)}</text>
        </g>
      ))}
      {goalY != null && (
        <line x1={L} x2={W - R} y1={goalY} y2={goalY} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity={0.6} />
      )}
      <path d={path(p => p.best)} fill="none" stroke="var(--muted)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.7} />
      <path d={path(p => p.avg)} fill="none" stroke="var(--accent)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      {points.map(p => (
        <g key={p.k}>
          {/* A wide invisible target per period, so the tooltip is easy to find. */}
          <rect x={X(p.k) - 6} y={T} width={12} height={H - T - B} fill="transparent">
            <title>{`${periodText(p.k, period)}\nAverage ${fmt(p.avg)} · best ${fmt(p.best)}\n${p.count} ${p.count === 1 ? "solve" : "solves"}`}</title>
          </rect>
          {dots && <circle cx={X(p.k)} cy={Y(p.avg)} r={2.5} fill="var(--accent)" pointerEvents="none" />}
        </g>
      ))}
      <text x={L} y={H - 4} fontSize={10} fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">{axisText(k0, period)}</text>
      <text x={W - R} y={H - 4} fontSize={10} textAnchor="end" fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">{axisText(k1, period)}</text>
    </svg>
  );
}
