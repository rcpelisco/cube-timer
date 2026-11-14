// 4×4 parity algorithms on a cube model (cubing.js 4×4). A case is described by what the
// algorithm leaves changed after the top is turned so the corners are home: every corner must be
// solved, every center on its own face (centers of one color are interchangeable), and only top
// edges may move. The result lists each top edge's wings that aren't home, e.g. "UF:flip".
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";

const kp = await puzzles["4x4x4"].kpuzzle();
const solved = kp.defaultPattern();
const moves = (orbit: string, m: string) => kp.moveToTransformation(m).transformationData[orbit].permutation;
const by = (orbit: string, n: number) =>
  Array.from({ length: n }, (_, i) => ["U", "D", "F", "B", "R", "L"].filter(m => moves(orbit, m)[i] !== i).join(""));
const edgeOf = by("EDGES", 24), centerOf = by("CENTERS", 24);

export const validOn4x4 = (alg: string) => { try { solved.applyAlg(new Alg(alg)); return true; } catch { return false; } };

// What the algorithm does to a solved cube, or a problem with it.
export function parityEffect(alg: string): { effect: string } | { problem: string } {
  for (const auf of ["", "U", "U2", "U'"]) {
    const p = solved.applyAlg(new Alg(`${alg} ${auf}`)).patternData;
    if (!p.CORNERS.pieces.every((v, i) => v === i) || !p.CORNERS.orientation.every(o => o === 0)) continue;
    if (!p.CENTERS.pieces.every((v, i) => centerOf[v] === centerOf[i])) return { problem: "moves centers" };
    const changed = new Map<string, string>();
    for (let i = 0; i < 24; i++) {
      const v = p.EDGES.pieces[i], o = p.EDGES.orientation[i];
      if (v === i && o === 0) continue;
      if (!edgeOf[i].startsWith("U")) return { problem: `breaks the ${edgeOf[i]} edge` };
      changed.set(edgeOf[i], edgeOf[v] === edgeOf[i] ? "flip" : `from ${edgeOf[v]}`);
    }
    return { effect: [...changed].sort().map(([e, what]) => `${e}:${what}`).join(" ") || "nothing" };
  }
  return { problem: "leaves corners unsolved" };
}

// The case as shown in the app: the algorithm undone on a solved cube.
export const caseState4 = (alg: string) => solved.applyAlg(new Alg(alg).invert());
export const fromSolved4 = (moves: string) => solved.applyAlg(new Alg(moves));
