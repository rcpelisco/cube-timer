import { fmt } from "../lib/stats";
import { namesFor, phaseTimes, usePhases } from "../lib/splits";
import type { PuzzleId } from "../lib/puzzles";
import { useHideTime } from "../hooks/useHideTime";

// The phases of a solve under the timer: "Cross 1.52 · F2L 6.10 · OLL 1.80 · PLL 2.01".
// live: while solving, the finished phases and then the one you're on (times left out when the
// running clock is hidden).
export function SplitsLine({ marks, t, phases, puzzle, live = false }: {
  marks: number[]; t?: number; phases: number; puzzle: PuzzleId; live?: boolean;
}) {
  const [hide] = useHideTime();
  const names = namesFor(phases, usePhases(puzzle));
  const times = t == null ? marks.map((m, i) => m - (i ? marks[i - 1] : 0)) : phaseTimes(marks, t);
  return (
    <div className={`splits-line${live ? " live" : ""}`} aria-live={live ? "off" : undefined}>
      {names.map((name, i) => {
        const done = i < times.length;
        if (live && i > times.length) return null;
        return (
          <span key={i} className={done ? "" : "now"}>
            {name}{done && !(live && hide) && <b>{fmt(times[i])}</b>}
          </span>
        );
      })}
    </div>
  );
}

// Phase times as one bar split by share of the solve, with each phase's time below.
export function SplitBars({ times, puzzle, label }: { times: number[]; puzzle: PuzzleId; label: string }) {
  const names = namesFor(times.length, usePhases(puzzle));
  const total = times.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="split-bars">
      <div className="split-bar" role="img" aria-label={`${label}: ${names.map((n, i) => `${n} ${fmt(times[i])}`).join(", ")}`}>
        {times.map((v, i) => <span key={i} className={`ph-${i}`} style={{ flexGrow: v / total }} />)}
      </div>
      <div className="split-legend">
        {names.map((n, i) => (
          <span key={i}><i className={`ph-${i}`} />{n} <b>{fmt(times[i])}</b> <small>{Math.round((times[i] / total) * 100)}%</small></span>
        ))}
      </div>
    </div>
  );
}
