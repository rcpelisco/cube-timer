import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import type { SolveScope } from "../hooks/useSolveScope";

// "This session" / "All 3×3 · 2" above Progress and Compare dates (see hooks/useSolveScope.ts).
export function ScopeToggle({ scope, puzzle }: { scope: SolveScope; puzzle: PuzzleId }) {
  if (scope.sessions < 2) return null;
  return (
    <div className="segmented progress-scope" role="radiogroup" aria-label="Solves shown">
      <button type="button" role="radio" aria-checked={scope.scope === "session"} className={scope.scope === "session" ? "on" : ""}
        onClick={() => scope.set("session")}>This session</button>
      <button type="button" role="radio" aria-checked={scope.scope === "all"} className={scope.scope === "all" ? "on" : ""}
        onClick={() => scope.set("all")}>All {PUZZLES[puzzle].label} · {scope.sessions}</button>
    </div>
  );
}
