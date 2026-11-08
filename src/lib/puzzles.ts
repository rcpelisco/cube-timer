// Puzzles a session can be for. The id is the cubing.js event id used for scrambles;
// `viewer` is the cubing.js puzzle name used to draw the scrambled state.

export type PuzzleId = "222" | "333" | "444" | "fto";

export const PUZZLES: Record<PuzzleId, { label: string; viewer: string; wca: boolean }> = {
  "222": { label: "2×2", viewer: "2x2x2", wca: true },
  "333": { label: "3×3", viewer: "3x3x3", wca: true },
  "444": { label: "4×4", viewer: "4x4x4", wca: true },
  fto: { label: "FTO", viewer: "fto", wca: false },
};

export const PUZZLE_ORDER: PuzzleId[] = ["222", "333", "444", "fto"];

// Sessions made before puzzles existed have no puzzle and are 3×3.
export function toPuzzle(value: unknown): PuzzleId {
  return typeof value === "string" && value in PUZZLES ? (value as PuzzleId) : "333";
}
