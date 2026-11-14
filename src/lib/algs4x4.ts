import type { AlgCase } from "./algs";

// 4×4 parity: the two last-layer cases a reduction solve (centers, pair edges, then solve it like
// a 3×3) can end in that a 3×3 can't have. Most popular algorithm first. Checked by
// `npm run check:algs` on a 4×4 model: each algorithm keeps everything but the named top-layer
// edges solved (up to a turn of the top), corners and centers included.
// Notation: Rw = the right two layers together, 2R = only the inner slice next to R.

const par = (id: string, name: string, group: string, algs: string[]): AlgCase =>
  ({ set: "PAR4", id: `par4-${id}`, name, group, algs });

export const PAR4: AlgCase[] = [
  // One top edge pair is flipped (an odd number of edges show the top color): flips the front one.
  par("oll", "OLL parity", "During OLL", [
    "Rw2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 Rw2",
    "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2",
    "2R U2 2R U2 2R' U2 2R U2 2L' U2 2R U2 2R' U2 2L 2R2 U2 2R'",
    "2R' U2 2L F2 2L' F2 2R2 U2 2R U2 2R' U2 F2 2R2 F2",
  ]),
  // Two opposite top edge pairs are swapped (PLL looks like no 3×3 case): swaps front and back.
  par("pll", "PLL parity", "During PLL", [
    "2R2 U2 2R2 Uw2 2R2 Uw2",
    "Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2",
    "Uw2 2R2 Uw2 2R2 U2 2R2",
  ]),
];
