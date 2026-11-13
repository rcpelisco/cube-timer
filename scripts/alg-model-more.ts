// Cube-model checks for F2L and COLL algorithms (cubing.js), used by find-algs.ts and check-algs.ts.
// A case state is built by undoing the algorithm on a solved cube, as for OLL/PLL (alg-model.ts).
//
// F2L: one front-right pair (corner DFR, edge FR). The algorithm must leave the cube held the same
// way (no net rotation, so the slot is front-right as you hold it), keep the cross and the other
// three slots solved, and solve the pair; the last layer can end up anything.
// COLL: the first two layers solved and the last layer's edges oriented; the algorithm orients and
// places the corners, keeps edges oriented, and may leave the edges in any order (an edge-only PLL).
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { KTransformation } from "cubing/kpuzzle";
import { normalizing, solved, type Pattern } from "./alg-model.ts";

const kp = await cube3x3x3.kpuzzle();
const auf = (n: number) => ["", "U", "U2", "U'"][n];
const centresHome = (p: Pattern) => p.patternData.CENTERS.pieces.every((v, i) => v === i);
const caseOf = (alg: string): Pattern => solved.applyAlg(new Alg(alg).invert());

// cubing.js slots. EDGES: UF UR UB UL DF DR DB DL FR FL BR BL. CORNERS: UFR URB UBL ULF DRF DFL DLB DBR.
const PAIR_CORNER = 4, PAIR_EDGE = 8;

// ---------- F2L ----------

export function f2lProblems(alg: string): string[] {
  let p: Pattern;
  try { p = caseOf(alg); } catch (e) { return [`can't parse (${(e as Error).message})`]; }
  if (!centresHome(p)) return ["leaves the cube turned (the slot wouldn't be front-right)"];
  const E = p.patternData.EDGES, C = p.patternData.CORNERS;
  for (const i of [4, 5, 6, 7, 9, 10, 11]) if (E.pieces[i] !== i || E.orientation[i] !== 0) return ["breaks the cross or another slot (edges)"];
  for (const i of [5, 6, 7]) if (C.pieces[i] !== i || C.orientation[i] !== 0) return ["breaks another slot (corners)"];
  if (C.pieces[4] === 4 && C.orientation[4] === 0 && E.pieces[8] === 8 && E.orientation[8] === 0) return ["the pair is already solved"];
  return [];
}

// Where the pair's corner and edge are, as slot + orientation, up to a U turn first (which only
// moves pieces in the top layer). Call only on algorithms with no problems.
export interface PairPlace { cs: number; co: number; es: number; eo: number }
function pairPlace(p: Pattern): PairPlace {
  const E = p.patternData.EDGES, C = p.patternData.CORNERS;
  const cs = C.pieces.indexOf(PAIR_CORNER), es = E.pieces.indexOf(PAIR_EDGE);
  return { cs, co: C.orientation[cs], es, eo: E.orientation[es] };
}
export function f2lCanonical(p: Pattern): PairPlace {
  const all = [0, 1, 2, 3].map(a => pairPlace(a ? p.applyAlg(new Alg(auf(a))) : p));
  const key = (x: PairPlace) => `${x.cs < 4 ? 0 : 1}${x.cs}${x.co}${x.es}${x.eo}`;
  // Corner on top: turn it to UFR (slot 0); corner in its slot: edge to UF if it's on top.
  return all.sort((a, b) => (key(a) < key(b) ? -1 : 1))[0];
}
export const f2lPlaceOf = (alg: string) => f2lCanonical(caseOf(alg));
export const f2lKey = (alg: string) => JSON.stringify(f2lPlaceOf(alg));

// Groups, from where the pieces are (corner orientation 0 = cross color facing up or down).
export function f2lGroup(x: PairPlace): string {
  const cornerTop = x.cs < 4, edgeTop = x.es < 4;
  if (cornerTop && edgeTop) return x.co === 0 ? "Cross color up" : "Both on top";
  if (cornerTop) return "Edge in slot";
  if (edgeTop) return "Corner in slot";
  return "Both in slot";
}

// ---------- COLL ----------

const ll = (p: Pattern) => ({
  eo: p.patternData.EDGES.orientation.slice(0, 4),
  cp: p.patternData.CORNERS.pieces.slice(0, 4), co: p.patternData.CORNERS.orientation.slice(0, 4),
});

export function collProblems(alg: string): string[] {
  let p0: Pattern;
  try { p0 = caseOf(alg); } catch (e) { return [`can't parse (${(e as Error).message})`]; }
  const r = normalizing(p0);
  if (r === null) return ["turns the cube so the top isn't on top"];
  const p = r ? p0.applyAlg(new Alg(r)) : p0;
  const E = p.patternData.EDGES, C = p.patternData.CORNERS;
  for (let i = 4; i < 12; i++) if (E.pieces[i] !== i || E.orientation[i] !== 0) return ["breaks the first two layers (edges)"];
  for (let i = 4; i < 8; i++) if (C.pieces[i] !== i || C.orientation[i] !== 0) return ["breaks the first two layers (corners)"];
  const { eo, co } = ll(p);
  if (eo.some(o => o !== 0)) return ["changes edge orientation (not a COLL)"];
  if (co.every(o => o === 0)) return ["corners are already oriented (a PLL, not a COLL case)"];
  return [];
}

// Corners only (edges may end up anywhere), up to a U turn before and after. `p` is the case
// with the centers home.
export function collKeyOf(p: Pattern): string {
  const t = new KTransformation(kp, Object.fromEntries(Object.entries(p.patternData).map(
    ([name, o]) => [name, { permutation: o.pieces, orientationDelta: o.orientation }])));
  const keys: string[] = [];
  for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) {
    // Look at the case from each side (b) and relabel by a U turn after (a).
    const q = solved.applyAlg(new Alg(auf(b))).applyTransformation(t).applyAlg(new Alg(auf(a)));
    const s = ll(q);
    keys.push(`${s.cp.join("")}|${s.co.join("")}`);
  }
  return keys.sort()[0];
}
export function collCase(alg: string): Pattern {
  const p0 = caseOf(alg);
  const r = normalizing(p0)!;
  return r ? p0.applyAlg(new Alg(r)) : p0;
}
export const collKey = (alg: string) => collKeyOf(collCase(alg));

// The OCLL shape (what the top looks like), from the corner twists going round the top.
const SHAPES: Record<string, string> = {
  "0222": "Sune", "0111": "Antisune", "1212": "H", "1122": "Pi", "0012": "U", "0021": "T", "0102": "L",
};
export function collShapeOf(p: Pattern): string {
  const o = p.patternData.CORNERS.orientation.slice(0, 4);
  const k = [0, 1, 2, 3].map(s => [0, 1, 2, 3].map(i => o[(i + s) % 4]).join("")).sort()[0];
  return SHAPES[k] ?? `?${k}`;
}
export const collShape = (alg: string) => collShapeOf(collCase(alg));
