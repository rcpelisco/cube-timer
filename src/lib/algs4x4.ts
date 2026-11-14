import type { AlgCase } from "./algs";

// 4×4 parity: the last-layer cases a reduction solve (centers, pair edges, then solve it like a
// 3×3) can end in that a 3×3 can't have. OLL parity cases are told apart by the top's pattern only
// (as on speedcubedb.com: Pure, Basic, M), since PLL comes next; PLL parity is two opposite edge
// pairs swapped. Most popular algorithm first. Checked by `npm run check:algs` on a 4×4 model.
// Notation: Rw = the right two layers together, 2R = only the inner slice next to R,
// 2-3L = both inner slices, turned like L (M on a 3×3).

const par = (id: string, name: string, group: string, algs: string[]): AlgCase =>
  ({ set: "PAR4", id: `par4-${id}`, name, group, algs });

export const PAR4: AlgCase[] = [
  // One top edge pair flipped, nothing else: flips the front one and changes nothing else (the last
  // one also moves top pieces around).
  par("oll", "Pure OLL parity", "During OLL", [
    "Rw2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 Rw2",
    "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2",
    "2R U2 2R U2 2R' U2 2R U2 2L' U2 2R U2 2R' U2 2L 2R2 U2 2R'",
    "2R' U2 2L F2 2L' F2 2R2 U2 2R U2 2R' U2 F2 2R2 F2",
    "R U2 R' U' Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' F R' F' R",
  ]),
  // The front edge pair flipped, and the two front corners showing the top color on the front.
  par("oll-basic", "Basic OLL parity", "During OLL", [
    "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    "Rw' U2 Rw U2 Rw U2 Rw2 F2 Rw' U2 Rw' U2 F2 Rw2 F2",
    "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2",
  ]),
  // The back edge pair flipped, and the two front corners showing the top color on the front:
  // Basic's algorithms between both inner slices turned up and back down.
  par("oll-m", "M OLL parity", "During OLL", [
    "2-3L Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' 2-3L'",
    "2-3L Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2 2-3L'",
    "2-3L Rw' U2 Rw U2 Rw U2 Rw2 F2 Rw' U2 Rw' U2 F2 Rw2 F2 2-3L'",
  ]),
  // Two opposite top edge pairs are swapped (PLL looks like no 3×3 case): swaps front and back.
  par("pll", "PLL parity", "During PLL", [
    "2R2 U2 2R2 Uw2 2R2 Uw2",
    "Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2",
    "Uw2 2R2 Uw2 2R2 U2 2R2",
  ]),
];
