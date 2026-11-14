import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { puzzleOf, type AlgCase } from "./algs";
import { MAX_ALG_LENGTH } from "./algCustom";
import { faces4, parityFixed } from "./parity4x4";

// Checks an algorithm you type in before it's added to a case: it has to solve that case on a cube
// model (cubing.js). The case is set up with the case's standard algorithm, held the usual way.
// Your algorithm may start from any turn of the top (U, U2, U') and may end with a turn of the top
// or the whole cube turned (PBL: the bottom layer may be turned too, and the cube turned over
// first); what has to be solved afterwards depends on the set:
// - F2L: the first two layers.            - OLL: the first two layers, and the top all one color.
// - COLL: as OLL, with the corners placed.  - PLL, PBL: everything.
// - 4×4 parity: the parity gone, with everything below the top solved (see parityFixed).
// - 2×2 OLL: the bottom layer, and the top all one color.

export type CheckResult = { ok: true; alg: string } | { ok: false; reason: string };

const AUF = ["", "U", "U2", "U'"];
const ADF = ["", "D", "D2", "D'"];
const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => join(a, b)));

// Tidy what was typed: curly or back quotes as primes, single spaces, "R2'" as "R2".
export function tidyAlg(text: string): string {
  return text.replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim();
}

interface Kit { kp: KPuzzle; validate: (alg: string) => void; invert: (alg: string) => string; normal: (alg: string) => string }
const kits = new Map<string, Promise<Kit>>();
function kitFor(puzzle: "3x3" | "2x2" | "4x4"): Promise<Kit> {
  let k = kits.get(puzzle);
  if (!k) {
    k = (async () => {
      const [{ cube2x2x2, cube3x3x3, puzzles }, { Alg }] = await Promise.all([import("cubing/puzzles"), import("cubing/alg")]);
      // A 2×2 is read as a 3×3's corners, but only moves a 2×2 has are allowed (no slices).
      const kp = puzzle === "4x4" ? await puzzles["4x4x4"].kpuzzle() : await cube3x3x3.kpuzzle();
      const own = puzzle === "2x2" ? await cube2x2x2.kpuzzle() : kp;
      return {
        kp,
        validate: alg => { own.defaultPattern().applyAlg(new Alg(alg)); },
        invert: alg => new Alg(alg).invert().toString(),
        normal: alg => new Alg(alg).toString().replace(/2'/g, "2"),
      };
    })();
    kits.set(puzzle, k);
  }
  return k;
}

type Data = KPattern["patternData"];
const home = (d: Data, orbit: string, slots: number[]) =>
  slots.every(i => d[orbit].pieces[i] === i && d[orbit].orientation[i] === 0);
const oriented = (d: Data, orbit: string, slots: number[]) => slots.every(i => d[orbit].orientation[i] === 0);
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
const TOP = range(0, 4), F2L_EDGES = range(4, 12), BOTTOM = range(4, 8);

let f4: ReturnType<typeof faces4> | null = null;

function solvedFor(set: AlgCase["set"], kp: KPuzzle, p: KPattern): boolean {
  const d = p.patternData;
  switch (set) {
    case "F2L": return home(d, "EDGES", F2L_EDGES) && home(d, "CORNERS", BOTTOM);
    case "OLL": return solvedFor("F2L", kp, p) && oriented(d, "EDGES", TOP) && oriented(d, "CORNERS", TOP);
    case "COLL": return solvedFor("OLL", kp, p) && AUF.some(a => home(p.applyAlg(a).patternData, "CORNERS", TOP));
    case "PLL": return AUF.some(a => { const q = p.applyAlg(a).patternData; return home(q, "EDGES", range(0, 12)) && home(q, "CORNERS", range(0, 8)); });
    case "OLL2": return home(d, "CORNERS", BOTTOM) && oriented(d, "CORNERS", TOP);
    // PBL fixes both layers, so either may need a last turn.
    case "PBL": return AUF.some(a => ADF.some(b => home(p.applyAlg(join(a, b)).patternData, "CORNERS", range(0, 8))));
    case "PAR4": return parityFixed(kp, d);
  }
}

// The whole-cube turns to try at the end: on a 3×3 or 4×4 the one that puts the centers back
// (each center color on its own face); a 2×2 has no centers, so any.
function heldAgain(puzzle: string, kp: KPuzzle, p: KPattern): KPattern[] {
  if (puzzle === "2x2") return ROTATIONS.map(r => p.applyAlg(r));
  const centersHome = (q: KPattern) => {
    if (puzzle === "3x3") return q.patternData.CENTERS.pieces.every((v, i) => v === i);
    f4 ??= faces4(kp);
    const { center } = f4;
    return q.patternData.CENTERS.pieces.every((v, i) => center[v] === center[i]);
  };
  const r = ROTATIONS.find(r => centersHome(p.applyAlg(r)));
  return r === undefined ? [] : [p.applyAlg(r)];
}

export async function checkAlg(c: AlgCase, typed: string, existing: string[]): Promise<CheckResult> {
  const text = tidyAlg(typed);
  if (!text) return { ok: false, reason: "Type an algorithm first." };
  if (text.length > MAX_ALG_LENGTH) return { ok: false, reason: `That's too long (${MAX_ALG_LENGTH} characters at most).` };
  const puzzle = puzzleOf(c.set);
  const kit = await kitFor(puzzle);
  let alg: string;
  try {
    kit.validate(text);
    alg = kit.normal(text);
  } catch {
    return { ok: false, reason: puzzle === "2x2"
      ? "That isn't 2×2 notation (R U F, with ' and 2; no slice or wide moves)."
      : "That isn't valid notation. Use moves like R U R' U', with ' and 2." };
  }
  if (existing.includes(alg)) return { ok: false, reason: "That algorithm is already listed for this case." };

  const solved = kit.kp.defaultPattern();
  // The case held the usual way (a 2×2 is a 3×3's corners here, so its centers say how it's held).
  const start = heldAgain(puzzle === "2x2" ? "3x3" : puzzle, kit.kp, solved.applyAlg(kit.invert(c.algs[0])))[0];
  if (!start) return { ok: false, reason: "Couldn't set up this case." };
  // PBL: from either layer's turn, and with the cube turned over (x2 or z2), as the page suggests.
  const pres = c.set === "PBL" ? ["", "x2", "z2"].flatMap(f => AUF.flatMap(a => ADF.map(b => join(f, a, b)))) : AUF;
  for (const pre of pres) {
    const after = start.applyAlg(join(pre, alg));
    if (heldAgain(puzzle, kit.kp, after).some(p => solvedFor(c.set, kit.kp, p))) return { ok: true, alg };
  }
  return { ok: false, reason: `That doesn't solve ${c.name}${c.set === "F2L" ? " (with the rest of the first two layers kept)" : ""}, even from another turn of the top.` };
}
