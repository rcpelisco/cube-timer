import type { CSSProperties } from "react";

// Puzzles a session can be for. The id is the cubing.js event id used for scrambles;
// `viewer` is the cubing.js puzzle name used to draw the scrambled state.

export type PuzzleId = "222" | "333" | "444" | "555" | "666" | "777" | "pyram" | "skewb" | "minx" | "sq1" | "clock" | "fto";

export interface PuzzleInfo {
  label: string;        // "Pyraminx": headings, share cards
  short: string;        // "Pyra": the puzzle picker and badges
  viewer: string;
  wca: boolean;         // a WCA event, scrambled the WCA's way
  randomState: boolean; // cubing.js scrambles it from a random state (big cubes and Megaminx get random moves, as at the WCA)
  cube: boolean;        // an NxN: drawn as our own net, held white top, green front
  aspect: number;       // width / height of its drawing
  mo3?: boolean;        // rounds are a mean of 3 at the WCA
}

const cube = (n: number, randomState: boolean, mo3?: boolean): PuzzleInfo => ({
  label: `${n}×${n}`, short: `${n}×${n}`, viewer: `${n}x${n}x${n}`, wca: true, randomState, cube: true, aspect: 4 / 3, mo3,
});

export const PUZZLES: Record<PuzzleId, PuzzleInfo> = {
  "222": cube(2, true),
  "333": cube(3, true),
  "444": cube(4, true),
  "555": cube(5, false),
  "666": cube(6, false, true),
  "777": cube(7, false, true),
  pyram: { label: "Pyraminx", short: "Pyra", viewer: "pyraminx", wca: true, randomState: true, cube: false, aspect: 546 / 480 },
  skewb: { label: "Skewb", short: "Skewb", viewer: "skewb", wca: true, randomState: true, cube: false, aspect: 1.6 },
  minx: { label: "Megaminx", short: "Mega", viewer: "megaminx", wca: true, randomState: false, cube: false, aspect: 1.6 },
  sq1: { label: "Square-1", short: "Sq-1", viewer: "square1", wca: true, randomState: true, cube: false, aspect: 360 / 552 },
  clock: { label: "Clock", short: "Clock", viewer: "clock", wca: true, randomState: true, cube: false, aspect: 2 },
  fto: { label: "FTO", short: "FTO", viewer: "fto", wca: false, randomState: true, cube: false, aspect: 2368 / 1216 },
};

export const PUZZLE_ORDER: PuzzleId[] = ["222", "333", "444", "555", "666", "777", "pyram", "skewb", "minx", "sq1", "clock", "fto"];

// Sessions made before puzzles existed have no puzzle and are 3×3.
export function toPuzzle(value: unknown): PuzzleId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PUZZLES, value) ? (value as PuzzleId) : "333";
}

// The puzzle's drawing shape for CSS (--aspect, width / height).
export const aspectStyle = (puzzle: PuzzleId) => ({ "--aspect": PUZZLES[puzzle].aspect }) as CSSProperties;
