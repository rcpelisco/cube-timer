import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { PuzzleArt } from "./PuzzleArt";

// Shown in place of the stats and solve list while a session has no solves yet.
export function EmptySolves({ puzzle, session, touch, onTimer }: {
  puzzle: PuzzleId; session: string; touch: boolean; onTimer?: () => void;
}) {
  return (
    <div className="panel empty-solves">
      <PuzzleArt puzzle={puzzle} />
      <h2>No {PUZZLES[puzzle].label} solves yet</h2>
      <p>
        {touch ? "Touch and hold the timer" : <>Hold <kbd>Space</kbd></>} until it turns green, then let go to start.
        Times, averages and charts for <b>{session}</b> will show up here.
      </p>
      {onTimer && <button type="button" className="on" onClick={onTimer}>Go to timer</button>}
    </div>
  );
}
