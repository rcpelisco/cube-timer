import { useMemo } from "react";
import { useChartWidth } from "../hooks/useChartWidth";
import { DNF, eff, fmt, shortTime, type Solve } from "../lib/stats";

const H = 120, L = 8, R = 8, T = 8, B = 18;
// Bucket widths to choose from (ms): the smallest that gives at most MAX_BARS bars.
const WIDTHS = [100, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000];
const MAX_BARS = 16;

// How the session's times are spread: a bar per time range (e.g. 11–12 s), with the slowest and
// fastest 2% folded into the end bars so one bad solve doesn't flatten the chart. Bars under the
// goal are in the accent color.
export function Spread({ solves, goal }: { solves: Solve[]; goal?: number }) {
  const data = useMemo(() => {
    const vals = solves.filter(s => s.pen !== DNF).map(eff).sort((a, b) => a - b);
    const dnf = solves.length - vals.length;
    if (vals.length < 5) return { dnf, count: vals.length, bars: null };
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
    const lo = q(0.02), hi = q(0.98);
    const w = WIDTHS.find(w => Math.floor(hi / w) - Math.floor(lo / w) + 1 <= MAX_BARS) ?? WIDTHS[WIDTHS.length - 1];
    const first = Math.floor(lo / w);
    const n = Math.floor(hi / w) - first + 1;
    const counts = new Array(n).fill(0);
    for (const v of vals) counts[Math.min(n - 1, Math.max(0, Math.floor(v / w) - first))]++;
    const peak = counts.indexOf(Math.max(...counts));
    return {
      dnf, count: vals.length, w, start: first * w, counts, peak,
      cutLow: vals[0] < first * w, cutHigh: vals[vals.length - 1] >= (first + n) * w,
      middle: [q(0.25), q(0.75)] as const,
      bars: true,
    };
  }, [solves]);

  return (
    <>
      <h2><span>Spread · this session</span><span>{data.count} {data.count === 1 ? "solve" : "solves"}{data.dnf ? ` · ${data.dnf} DNF` : ""}</span></h2>
      {!data.bars || data.counts == null || data.w == null || data.start == null ? (
        <div className="empty">The chart appears after five solves.</div>
      ) : (
        <>
          <Bars counts={data.counts} w={data.w} start={data.start} goal={goal} cutLow={data.cutLow} cutHigh={data.cutHigh} />
          <div className="legend spread-legend">
            <span>Most often <b>{shortTime(data.start + data.peak * data.w)}–{shortTime(data.start + (data.peak + 1) * data.w)}</b></span>
            <span>Middle half <b>{fmt(data.middle[0])}–{fmt(data.middle[1])}</b></span>
          </div>
        </>
      )}
    </>
  );
}

function Bars({ counts, w, start, goal, cutLow, cutHigh }: {
  counts: number[]; w: number; start: number; goal?: number; cutLow: boolean; cutHigh: boolean;
}) {
  const [svgRef, W] = useChartWidth();
  const n = counts.length, max = Math.max(...counts);
  const bw = (W - L - R) / n;
  const X = (ms: number) => L + ((ms - start) / w) * bw;
  // Label every bar when they fit, else every other or every fourth.
  const step = n <= 8 ? 1 : n <= 12 ? 2 : 4;
  const label = (i: number) => {
    const t = shortTime(start + i * w);
    return i === 0 && cutLow ? `≤${t}` : t;
  };
  const goalX = goal != null && goal > start && goal < start + n * w ? X(goal) : null;
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Times by range: ${counts.map((c, i) => `${shortTime(start + i * w)} to ${shortTime(start + (i + 1) * w)}: ${c}`).join(", ")}`}>
      {counts.map((c, i) => {
        const h = max ? (c / max) * (H - T - B) : 0;
        const under = goal != null && start + (i + 1) * w <= goal;
        return (
          <rect key={i} x={L + i * bw + 1} y={H - B - h} width={Math.max(1, bw - 2)} height={h} rx={2}
            fill={under ? "var(--accent)" : "var(--muted)"} opacity={under ? 1 : 0.55}>
            <title>{`${shortTime(start + i * w)}–${shortTime(start + (i + 1) * w)}: ${c}`}</title>
          </rect>
        );
      })}
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {counts.map((_, i) => i % step === 0 && (
        <text key={i} x={L + i * bw + 1} y={H - 4} fontSize={10} fill="var(--muted)" fontFamily="Chivo Mono, monospace">{label(i)}</text>
      ))}
      {cutHigh && <text x={W - R} y={H - 4} fontSize={10} textAnchor="end" fill="var(--muted)" fontFamily="Chivo Mono, monospace">+</text>}
      {goalX != null && (
        <line x1={goalX} x2={goalX} y1={T - 4} y2={H - B} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
