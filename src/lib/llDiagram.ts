import type { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";

// Works out which face color each last-layer sticker shows for a case, by undoing the algorithm on
// a solved cube (cubing.js model). Faces are named in the solver's frame: U is the top color,
// F/R/B/L the side colors; the cross-color setting decides the actual colors.

export type Face = "U" | "F" | "R" | "B" | "L";
export interface LLStickers {
  top: Face[][];                                            // 3×3, row 0 = back, col 0 = left
  sides: { B: Face[]; F: Face[]; L: Face[]; R: Face[] };    // B/F left→right, L/R back→front
}

// cubing.js slot and piece sticker orders (corners: U/D sticker first, then the other two
// counter-clockwise, e.g. UFR is stored U, R, F). A piece in a slot with orientation o shows its
// sticker (k − o) mod 3 on the slot's sticker k (edges: (k + o) mod 2). Calibrated against
// single F and R turns.
const EDGE_FACES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CORNER_FACES = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];

interface Model { solved: KPattern; invert: (alg: string) => Alg }
let model: Promise<Model> | null = null;
async function loadModel(): Promise<Model> {
  const [{ cube3x3x3 }, { Alg }] = await Promise.all([import("cubing/puzzles"), import("cubing/alg")]);
  const kp = await cube3x3x3.kpuzzle();
  return { solved: kp.defaultPattern(), invert: (alg: string) => new Alg(alg).invert() };
}

const cache = new Map<string, LLStickers>();

export async function llStickers(alg: string): Promise<LLStickers> {
  const hit = cache.get(alg);
  if (hit) return hit;
  model ??= loadModel();
  const { solved, invert } = await model;
  const p = solved.applyAlg(invert(alg)).patternData;
  const E = p.EDGES, C = p.CORNERS;

  // Face shown on slot sticker k of a last-layer slot.
  const edge = (slot: number, k: number) =>
    EDGE_FACES[E.pieces[slot]][(k + E.orientation[slot]) % 2] as Face;
  const corner = (slot: number, k: number) =>
    CORNER_FACES[C.pieces[slot]][(k - C.orientation[slot] + 3) % 3] as Face;

  // Slots: edges UF0 UR1 UB2 UL3; corners UFR0 (U,R,F) URB1 (U,B,R) UBL2 (U,L,B) ULF3 (U,F,L).
  const result: LLStickers = {
    top: [
      [corner(2, 0), edge(2, 0), corner(1, 0)],
      [edge(3, 0), "U", edge(1, 0)],
      [corner(3, 0), edge(0, 0), corner(0, 0)],
    ],
    sides: {
      B: [corner(2, 2), edge(2, 1), corner(1, 1)],
      F: [corner(3, 1), edge(0, 1), corner(0, 2)],
      L: [corner(2, 1), edge(3, 1), corner(3, 2)],
      R: [corner(1, 2), edge(1, 1), corner(0, 1)],
    },
  };
  cache.set(alg, result);
  return result;
}

// ---------- 2×2 ----------
// A 2×2 is a 3×3's corners. Undo the algorithm, then turn the whole cube so the centers are home
// (2×2 algorithms often use x/y/z turns that a 3×3 model would otherwise leave the cube turned by).

export type Face2 = Face | "D";
export interface Layer2 {
  face: Face2[][];                                           // 2×2, row 0 = back, col 0 = left
  sides: { B: Face2[]; F: Face2[]; L: Face2[]; R: Face2[] };  // B/F left→right, L/R back→front
}
export interface Stickers2 { top: Layer2; bottom: Layer2 }   // bottom seen from above, through the cube

const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => [a, b].filter(Boolean).join(" ")));
const cache2 = new Map<string, Stickers2>();

export async function stickers2x2(alg: string): Promise<Stickers2> {
  const hit = cache2.get(alg);
  if (hit) return hit;
  model ??= loadModel();
  const { solved, invert } = await model;
  let p = solved.applyAlg(invert(alg));
  const home = (q: KPattern) => q.patternData.CENTERS.pieces.every((v, i) => v === i);
  if (!home(p)) {
    const fix = ROTATIONS.find(r => r && home(p.applyAlg(r)));
    if (fix) p = p.applyAlg(fix);
  }
  const C = p.patternData.CORNERS;
  // Face color on a slot's face: the slot's stickers are listed in CORNER_FACES order.
  const s = (slot: number, face: string) => {
    const k = CORNER_FACES[slot].indexOf(face);
    return CORNER_FACES[C.pieces[slot]][(k - C.orientation[slot] + 3) % 3] as Face2;
  };
  // Slots: URF0 UBR1 ULB2 UFL3, DFR4 DLF5 DBL6 DRB7.
  const result: Stickers2 = {
    top: {
      face: [[s(2, "U"), s(1, "U")], [s(3, "U"), s(0, "U")]],
      sides: { B: [s(2, "B"), s(1, "B")], F: [s(3, "F"), s(0, "F")], L: [s(2, "L"), s(3, "L")], R: [s(1, "R"), s(0, "R")] },
    },
    bottom: {
      face: [[s(6, "D"), s(7, "D")], [s(5, "D"), s(4, "D")]],
      sides: { B: [s(6, "B"), s(7, "B")], F: [s(5, "F"), s(4, "F")], L: [s(6, "L"), s(5, "L")], R: [s(7, "R"), s(4, "R")] },
    },
  };
  cache2.set(alg, result);
  return result;
}
