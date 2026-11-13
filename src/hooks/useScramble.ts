import { useCallback, useEffect, useRef, useState } from "react";
import { takeScramble, type Scramble } from "../lib/scramble";
import type { PuzzleId } from "../lib/puzzles";

// How many earlier scrambles are kept (across puzzles) for "Previous".
const MAX_HISTORY = 50;

// Current scramble for the session's puzzle; null while the next one is still being generated.
// Every scramble that's replaced (by a solve or "New scramble") is kept, so `back` can bring the
// last one back: to redo a solve, or after skipping one by mistake. Only this puzzle's count.
export function useScramble(puzzle: PuzzleId) {
  const [scramble, setScramble] = useState<Scramble | null>(null);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<Scramble[]>([]);
  const request = useRef(0);
  const current = useRef(scramble);
  current.current = scramble;

  const next = useCallback(() => {
    const id = ++request.current;
    const old = current.current;
    if (old) setHistory(h => [...h.slice(-(MAX_HISTORY - 1)), old]);
    setScramble(null);
    setFailed(false);
    takeScramble(puzzle).then(
      s => { if (id === request.current) setScramble(s); },
      e => { if (id === request.current) { console.error(e); setFailed(true); } },
    );
  }, [puzzle]);

  const back = useCallback(() => {
    let i = history.length - 1;
    while (i >= 0 && history[i].puzzle !== puzzle) i--;
    if (i < 0) return;
    ++request.current; // drop a scramble still being generated
    setHistory(h => h.filter((_, j) => j !== i));
    setScramble(history[i]);
    setFailed(false);
  }, [history, puzzle]);

  // New scramble whenever the puzzle changes (switching to a session for another puzzle).
  useEffect(() => { next(); }, [next]);

  const canGoBack = history.some(s => s.puzzle === puzzle);
  return { scramble, failed, next, back, canGoBack };
}
