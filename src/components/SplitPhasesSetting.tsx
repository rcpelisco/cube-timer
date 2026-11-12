import { useState } from "react";
import { MAX_NAME, MAX_PHASES, MIN_PHASES, PHASE_PRESETS, setPhases, usePhases, useSplitPuzzles } from "../lib/splits";
import { PUZZLE_ORDER, PUZZLES, type PuzzleId } from "../lib/puzzles";

// Split timing, set per puzzle: on or off, and the phases, which you name and add or remove
// (2 to 6), or fill from a preset such as CFOP or Roux. Opens on the current session's puzzle;
// the switcher reaches the others (a dot marks the ones with split timing on).
export function SplitPhasesSetting({ puzzle: sessionPuzzle }: { puzzle: PuzzleId }) {
  const [puzzle, setPuzzle] = useState(sessionPuzzle);
  const withSplits = useSplitPuzzles();
  const names = usePhases(puzzle);
  const on = names.length > 0;
  const presets = PHASE_PRESETS[puzzle];
  const label = PUZZLES[puzzle].label;
  const set = (next: string[]) => setPhases(puzzle, next);
  const same = (a: string[]) => a.length === names.length && a.every((n, i) => n === names[i]);

  return (
    <div className="setting-row stacked split-setting">
      <span>
        <b>Split timing</b>
        <small>Press during a solve to end each phase; the last press stops the timer. Each puzzle has its own phases.</small>
      </span>
      <div className="view-tabs split-puzzles" role="tablist" aria-label="Puzzle">
        {PUZZLE_ORDER.map(p => (
          <button key={p} type="button" role="tab" aria-selected={puzzle === p} className={puzzle === p ? "on" : ""}
            aria-label={`${PUZZLES[p].label}${withSplits.includes(p) ? ", split timing on" : ""}`} onClick={() => setPuzzle(p)}>
            {PUZZLES[p].label}{withSplits.includes(p) && <i className="split-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <label className="split-setting-head" htmlFor="opt-splits">
        <span>
          <b>Split {label} solves{puzzle === sessionPuzzle ? " (this session)" : ""}</b>
          <small>{on ? `On: each solve is timed in ${names.length} phases.` : `Off: ${label} solves are timed in one piece.`}</small>
        </span>
        <input type="checkbox" className="switch" id="opt-splits" checked={on}
          onChange={e => set(e.target.checked ? (presets[0]?.names ?? ["Part 1", "Part 2"]) : [])} />
      </label>
      {on && (
        <div className="split-editor">
          <ol className="split-names">
            {names.map((n, i) => (
              <li key={i}>
                <i className={`ph-${i}`} aria-hidden="true" />
                <input value={n} maxLength={MAX_NAME} placeholder={`Part ${i + 1}`} aria-label={`Phase ${i + 1} name`}
                  onChange={e => set(names.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="split-remove" aria-label={`Remove ${n.trim() || `phase ${i + 1}`}`}
                  disabled={names.length <= MIN_PHASES} onClick={() => set(names.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ol>
          <div className="split-tools">
            <button type="button" className="link-btn" disabled={names.length >= MAX_PHASES}
              onClick={() => set([...names, ""])}>+ Add phase</button>
            {presets.length > 0 && (
              <span className="split-presets">
                Use
                {presets.map(p => (
                  <button key={p.label} type="button" className={same(p.names) ? "on" : ""} onClick={() => set(p.names)}>{p.label}</button>
                ))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
