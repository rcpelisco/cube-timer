import { useCallback, useEffect, useRef, useState } from "react";
import { takeScramble, type Scramble } from "../lib/scramble";
import type { PuzzleId } from "../lib/puzzles";

// Current scramble for the session's puzzle; null while the next one is still being generated.
export function useScramble(puzzle: PuzzleId) {
  const [scramble, setScramble] = useState<Scramble | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const next = useCallback(() => {
    const id = ++request.current;
    setScramble(null);
    setFailed(false);
    takeScramble(puzzle).then(
      s => { if (id === request.current) setScramble(s); },
      e => { if (id === request.current) { console.error(e); setFailed(true); } },
    );
  }, [puzzle]);

  // New scramble whenever the puzzle changes (switching to a session for another puzzle).
  useEffect(() => { next(); }, [next]);

  return { scramble, failed, next };
}
