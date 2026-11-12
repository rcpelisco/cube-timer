import { memo, useState } from "react";
import { avgOf, eff, fmt, type Solve } from "../lib/stats";
import type { Session } from "../lib/sessions";
import { Spread } from "./Spread";
import { Days } from "./Days";

const W = 400, H = 120, L = 44, R = 8, T = 8, B = 10;

type Tab = "trend" | "spread" | "days";
const TABS: { id: Tab; label: string }[] = [{ id: "trend", label: "Trend" }, { id: "spread", label: "Spread" }, { id: "days", label: "Days" }];
const TAB_KEY = "cubeTimer.chartTab";
const loadTab = (): Tab => {
  try { const v = localStorage.getItem(TAB_KEY); return v === "spread" || v === "days" ? v : "trend"; } catch { return "trend"; }
};

// The chart card: the recent trend, how the session's times spread out, or the days you practised.
// sessions: every session, for the practice days (which count solves in all of them).
export const TrendChart = memo(function TrendChart({ solves, goal, sessions }: { solves: Solve[]; goal?: number; sessions: Session[] }) {
  const [tab, setTab] = useState<Tab>(loadTab);
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  return (
    <div className="panel trend">
      <div className="chart-tabs view-tabs" role="tablist" aria-label="Chart">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => pick(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "trend" ? <Trend solves={solves} /> : tab === "spread" ? <Spread solves={solves} goal={goal} /> : <Days sessions={sessions} />}
    </div>
  );
});

function Trend({ solves }: { solves: Solve[] }) {
  const start = Math.max(0, solves.length - 50);
  const pts: [number, number][] = [], aoPts: [number, number][] = [];
  for (let i = start; i < solves.length; i++) {
    const v = eff(solves[i]);
    if (isFinite(v)) pts.push([i, v]);
    const a = avgOf(solves.slice(Math.max(0, i - 4), i + 1), 5);
    if (a != null && isFinite(a)) aoPts.push([i, a]);
  }

  return (
    <>
      <h2><span>Trend · last 50</span><span>{pts.length >= 2 ? `${solves.length - start} solves` : ""}</span></h2>
      {pts.length < 2 ? <div className="empty">The chart appears after two solves.</div> : <Chart {...{ pts, aoPts, start, end: solves.length - 1 }} />}
      <div className="legend"><span className="l-single">Single</span><span className="l-ao5">Ao5</span></div>
    </>
  );
}

function Chart({ pts, aoPts, start, end }: { pts: [number, number][]; aoPts: [number, number][]; start: number; end: number }) {
  const all = pts.concat(aoPts).map(p => p[1]);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 200) { const m = (hi + lo) / 2; lo = m - 100; hi = m + 100; }
  const span = Math.max(1, end - start);
  const X = (i: number) => L + ((i - start) / span) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (arr: [number, number][]) => arr.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Solve times trend">
      {[hi, (hi + lo) / 2, lo].map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Chivo Mono, monospace">{fmt(v)}</text>
        </g>
      ))}
      <path d={path(pts)} fill="none" stroke="var(--muted)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={0.7} />
      {aoPts.length > 1 && <path d={path(aoPts)} fill="none" stroke="var(--accent)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />}
      <circle cx={X(last[0])} cy={Y(last[1])} r={3} fill="var(--ink)" />
    </svg>
  );
}
