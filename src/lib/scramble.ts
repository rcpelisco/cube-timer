import { PUZZLES, type PuzzleId } from "./puzzles";

// Scrambles from cubing.js, made the way the WCA's TNoodle makes them: for most puzzles, pick a
// uniformly random state, then solve it to get a short move sequence (5×5 and up and Megaminx get
// random moves instead, as at the WCA). cubing.js runs the search in a web worker,
// so the timer stays smooth while it works. One scramble per puzzle is always prepared ahead, so a new
// one is usually ready instantly.

export interface Scramble { puzzle: PuzzleId; moves: string; randomState: boolean }

// Fallbacks if cubing.js ever fails. Other puzzles have none: an error is shown instead.
const FALLBACK: Partial<Record<PuzzleId, { faces: string[]; length: number }>> = {
  "222": { faces: ["R", "U", "F"], length: 11 },
  "333": { faces: ["U", "D", "R", "L", "F", "B"], length: 20 },
  "444": { faces: ["U", "D", "R", "L", "F", "B", "Uw", "Rw", "Fw"], length: 40 },
};
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

function randomMoves(faces: string[], length: number): string {
  const out: string[] = [];
  let last = "", prev = "";
  while (out.length < length) {
    const f = faces[(Math.random() * faces.length) | 0];
    if (f === last) continue;
    if (last && AXIS[f[0]] === AXIS[last[0]] && f === prev) continue; // avoid R L R
    out.push(f + ["", "'", "2"][(Math.random() * 3) | 0]);
    prev = last; last = f;
  }
  return out.join(" ");
}

async function generate(puzzle: PuzzleId): Promise<Scramble> {
  try {
    const { randomScrambleForEvent } = await import("cubing/scramble");
    const alg = await randomScrambleForEvent(puzzle);
    return { puzzle, moves: alg.toString(), randomState: PUZZLES[puzzle].randomState };
  } catch (e) {
    const fb = FALLBACK[puzzle];
    if (!fb) throw e;
    console.warn(`Random-state ${puzzle} scramble failed, using random moves instead`, e);
    return { puzzle, moves: randomMoves(fb.faces, fb.length), randomState: false };
  }
}

const prepared = new Map<PuzzleId, Promise<Scramble>>();

export function takeScramble(puzzle: PuzzleId): Promise<Scramble> {
  const current = prepared.get(puzzle) ?? generate(puzzle);
  // Start the next one once this one is done, so they don't compete for the worker.
  const next = current.then(() => generate(puzzle), () => generate(puzzle));
  next.catch(() => prepared.delete(puzzle)); // a failed prefetch is retried on the next take
  prepared.set(puzzle, next);
  return current;
}

// How the scramble was made, for its label: "WCA random-state", "WCA random-move", or "random-move"
// for the stand-in used when cubing.js fails.
export function scrambleKind(puzzle: PuzzleId, scramble: Scramble | null): string {
  const p = PUZZLES[puzzle];
  if (scramble && scramble.randomState !== p.randomState) return "random-move";
  return `${p.wca ? "WCA " : ""}${p.randomState ? "random-state" : "random-move"}`;
}
