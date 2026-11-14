// 2×2 algorithms on a cube model: a 2×2 is a 3×3's corners, so cubing.js's 3×3 model is used and
// only corners are read. A case state is built by undoing the algorithm on a solved cube and then
// turning the whole cube so the centers are home again (a 2×2 has no centers, so x/y/z turns and
// pairs like R L' only change how it's held).
import { Alg } from "cubing/alg";
import { cube2x2x2, cube3x3x3 } from "cubing/puzzles";

const kp = await cube3x3x3.kpuzzle();
const kp2 = await cube2x2x2.kpuzzle();
// Only moves a real 2×2 has (no slice or wide moves).
export const validOn2x2 = (alg: string) => { try { kp2.defaultPattern().applyAlg(alg); return true; } catch { return false; } };
const solved = kp.defaultPattern();
type Pattern = ReturnType<typeof solved.applyAlg>;

const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => [a, b].filter(Boolean).join(" ")));
// Corner slots in cubing.js, with each slot's stickers in stored order.
const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];

// Turn the whole cube so the centers are home (same 2×2, held the standard way).
export function held(p: Pattern): Pattern {
  const home = (q: Pattern) => q.patternData.CENTERS.pieces.every((v, i) => v === i);
  if (home(p)) return p;
  const fix = ROTATIONS.find(r => r && home(p.applyAlg(new Alg(r))));
  return fix ? p.applyAlg(new Alg(fix)) : p;
}
export const caseState2 = (alg: string): Pattern => held(solved.applyAlg(new Alg(alg).invert()));
export const fromSolved2 = (moves: string): Pattern => held(solved.applyAlg(new Alg(moves)));
// Corners only: what a 2×2 shows.
export const corners = (p: Pattern) => JSON.stringify(p.patternData.CORNERS);

// Face color shown on a slot's face.
function sticker(p: Pattern, slot: number, face: string): string {
  const C = p.patternData.CORNERS;
  const k = CORNERS[slot].indexOf(face);
  return CORNERS[C.pieces[slot]][(k - C.orientation[slot] + 3) % 3];
}

// Bottom layer solved (every bottom corner in place and oriented).
export const bottomSolved = (p: Pattern) =>
  [4, 5, 6, 7].every(s => p.patternData.CORNERS.pieces[s] === s && p.patternData.CORNERS.orientation[s] === 0);
// Both faces one color each: every corner oriented, and the top four all from one layer (the top,
// or the bottom when the algorithm leaves the cube turned over, which is fine on a 2×2).
export const allOriented = (p: Pattern) => {
  const { pieces, orientation } = p.patternData.CORNERS;
  const top = pieces.slice(0, 4);
  return orientation.every(o => o === 0) && (top.every(v => v < 4) || top.every(v => v >= 4));
};

// Top-layer twist pattern up to U turns (slots 0–3 go round the top).
export function ollKey(p: Pattern): string {
  const o = p.patternData.CORNERS.orientation.slice(0, 4);
  return [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(i => o[(i + r) % 4]).join("")).sort()[0];
}

// Permutation type of an oriented layer: S (solved), A (adjacent swap: one side has a matching
// pair), D (diagonal swap: none).
const SIDES = {
  top: [["F", 3, 0], ["R", 0, 1], ["B", 1, 2], ["L", 2, 3]],
  bottom: [["F", 5, 4], ["R", 4, 7], ["B", 7, 6], ["L", 6, 5]],
} as const;
export function layerType(p: Pattern, layer: "top" | "bottom"): "S" | "A" | "D" | "?" {
  const bars = SIDES[layer].filter(([f, a, b]) => sticker(p, a, f) === sticker(p, b, f)).length;
  return bars === 4 ? "S" : bars === 1 ? "A" : bars === 0 ? "D" : "?";
}
export const pblKey = (p: Pattern) => `${layerType(p, "top")}/${layerType(p, "bottom")}`;
