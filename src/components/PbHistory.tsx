import { useEffect, useMemo, useState } from "react";
import { useChartWidth } from "../hooks/useChartWidth";
import { createPortal } from "react-dom";
import { fmt, PB_HISTORY_KINDS, pbHistory, type PbEvent, type PbHistoryKind, type Solve } from "../lib/stats";
import { useLeave } from "../hooks/useLeave";

const SIZE: Record<PbHistoryKind, number> = { Single: 1, Ao5: 5, Ao12: 12, Ao100: 100 };

const dateText = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Full-screen history of the session's personal bests: when each best single and average was
// set and by how much, as a step chart and a list (newest first).
export function PbHistory({ solves, onClose }: { solves: Solve[]; onClose: () => void }) {
  const { leaving, close } = useLeave(onClose);
  const history = useMemo(() => pbHistory(solves), [solves]);
  const [kind, setKind] = useState<PbHistoryKind>("Single");
  const events = history[kind];
  const now = events[events.length - 1];

  // Esc closes. Space is swallowed so it doesn't arm the timer behind this view.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === "keydown") close(); }
      else if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [close]);

  const which = (e: PbEvent) => (SIZE[kind] === 1 ? `Solve ${e.i + 1}` : `Solves ${e.i - SIZE[kind] + 2}–${e.i + 1}`);

  return createPortal(
    <div className={`avg-detail pb-history${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Personal best history">
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">PB history · {kind}</span>
            <div className="avg-detail-value">{now ? fmt(now.value) : "–"}</div>
            <small className="avg-detail-when">
              {now
                ? <>Set {events.length} {events.length === 1 ? "time" : "times"} · {events.length > 1
                    ? <>from {fmt(events[0].value)} on {dateText(events[0].at)}, {fmt(events[0].value - now.value)} faster</>
                    : <>on {dateText(now.at)}</>}</>
                : `Needs ${SIZE[kind]} solves without too many DNFs.`}
            </small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        <div className="view-tabs pb-kinds" role="tablist" aria-label="Best">
          {PB_HISTORY_KINDS.map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
              {k} <span>{history[k].length}</span>
            </button>
          ))}
        </div>

        {events.length > 1 && <StepChart events={events} total={solves.length} />}

        {events.length > 0 && (
          <ol className="avg-detail-list pb-list">
            {[...events].reverse().map(e => (
              <li key={e.i}>
                <span className="avg-time">{fmt(e.value)}</span>
                <span className="pb-gain">{e.prev != null ? `−${fmt(e.prev - e.value)}` : "First"}</span>
                <span className="avg-date">{which(e)} · {dateText(e.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}

const H = 130, L = 44, R = 10, T = 8, B = 16;

// The best over the session as a staircase: flat until a new PB, then a step down. It runs a
// little past the latest PB rather than to the latest solve, so PBs long ago don't get squashed.
function StepChart({ events, total }: { events: PbEvent[]; total: number }) {
  const [svgRef, W] = useChartWidth();
  const hi = events[0].value, lo = events[events.length - 1].value;
  const pad = Math.max(50, (hi - lo) * 0.08);
  const first = events[0].i, lastPb = events[events.length - 1].i;
  const last = Math.max(first + 1, Math.min(total - 1, lastPb + Math.max(10, Math.round((lastPb - first) * 0.15))));
  const X = (i: number) => L + ((i - first) / (last - first)) * (W - L - R);
  const Y = (v: number) => T + ((hi + pad - v) / (hi - lo + 2 * pad)) * (H - T - B);
  let d = `M${X(events[0].i)},${Y(events[0].value)}`;
  for (let k = 1; k < events.length; k++) d += `H${X(events[k].i)}V${Y(events[k].value)}`;
  d += `H${X(last)}`;
  return (
    <div className="panel pb-chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Personal best over the session">
        {[hi, (hi + lo) / 2, lo].map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">{fmt(v)}</text>
          </g>
        ))}
        <text x={L} y={H - 3} fontSize={10} fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">#{first + 1}</text>
        <text x={W - R} y={H - 3} fontSize={10} textAnchor="end" fill="var(--muted)" fontFamily="Chivo Mono Variable, monospace">#{last + 1}</text>
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
