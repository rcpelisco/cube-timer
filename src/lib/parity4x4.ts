import type { KPattern, KPuzzle } from "cubing/kpuzzle";

// 4×4 parity rules on a cubing.js 4×4 model, used to check algorithms (algCheck.ts, check:algs).
// No imports from the app, so the scripts can load it too.

type Data = KPattern["patternData"];
const home = (d: Data, orbit: string, slots: number[]) =>
  slots.every(i => d[orbit].pieces[i] === i && d[orbit].orientation[i] === 0);
const BOTTOM = [4, 5, 6, 7];

// 4×4: centers of one color are interchangeable, and so are the two wings of an edge.
export function faces4(kp: KPuzzle) {
  const moved = (orbit: string, n: number) => Array.from({ length: n }, (_, i) =>
    ["U", "D", "F", "B", "R", "L"].filter(m => kp.moveToTransformation(m).transformationData[orbit].permutation[i] !== i).join(""));
  return { edge: moved("EDGES", 24), center: moved("CENTERS", 24) };
}
let f4: ReturnType<typeof faces4> | null = null;

// 4×4 parity is fixed when the rest of the cube is solved and the last layer is one a 3×3 could
// have: each top edge's two wings together, an even number of top edges flipped, and the top
// edges and corners each swapped an even number of times or each an odd number (on a 3×3 the
// two always go together). How the top looks otherwise doesn't matter, since OLL and PLL come
// next; so a pure algorithm passes, and so does one like Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2
// Rw U2 Rw' U2 Rw', which also swaps two corners and two edges.
const TOP_EDGES = ["UF", "UR", "UB", "UL"];
// Whether a permutation takes an odd number of swaps: each cycle of length n takes n − 1.
const swapsOdd = (perm: number[]) => {
  const seen = perm.map(() => false);
  let swaps = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]) { seen[j] = true; len++; }
    swaps += len - 1;
  }
  return swaps % 2 === 1;
};
export function parityFixed(kp: KPuzzle, d: Data): boolean {
  f4 ??= faces4(kp);
  const { edge, center } = f4;
  const E = d.EDGES, C = d.CORNERS;
  if (!home(d, "CORNERS", BOTTOM) || !d.CENTERS.pieces.every((v, i) => center[v] === center[i])) return false;
  // Every wing below the top is back on its own edge, unflipped.
  if (!E.pieces.every((v, i) => TOP_EDGES.includes(edge[i]) || (edge[v] === edge[i] && E.orientation[i] === 0))) return false;
  const from: number[] = [];
  let flips = 0;
  for (const name of TOP_EDGES) {
    const [a, b] = E.pieces.flatMap((_, i) => (edge[i] === name ? [i] : []));
    const src = edge[E.pieces[a]];
    // Both wings from the same top edge, turned the same way.
    if (src !== edge[E.pieces[b]] || !TOP_EDGES.includes(src) || E.orientation[a] !== E.orientation[b]) return false;
    from.push(TOP_EDGES.indexOf(src));
    flips += E.orientation[a];
  }
  return flips % 2 === 0 && swapsOdd(from) === swapsOdd(C.pieces.slice(0, 4));
}

