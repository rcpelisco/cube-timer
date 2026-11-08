import type { AlgCase } from "./algs";

// 2×2 Ortega: solve one face, orient the top (OLL, 7 cases), then permute both layers at once
// (PBL, 5 cases). Most popular algorithm first. Checked by `npm run check:algs` on a cube model:
// OLL keeps the bottom layer solved and each algorithm solves its named twist pattern; PBL keeps
// everything oriented and fixes the named swap in each layer. Only moves a 2×2 has (no wide or
// slice moves: on a 2×2, r is a whole-cube turn).

const oll = (id: string, name: string, group: string, algs: string[]): AlgCase =>
  ({ set: "OLL2", id: `oll2-${id}`, name, group, algs });
const pbl = (id: string, name: string, group: string, algs: string[]): AlgCase =>
  ({ set: "PBL", id: `pbl-${id}`, name, group, algs });

export const OLL2: AlgCase[] = [
  oll("sune", "Sune", "One oriented", ["R U R' U R U2 R'", "y' R' U2 R U R' U R", "L' U2 L U L' U L"]),
  oll("antisune", "Antisune", "One oriented", ["R U2 R' U' R U' R'", "R' U' R U' R' U2 R", "L' U' L U' L' U2 L", "R' F R F' R U R'"]),
  oll("h", "H", "None oriented", ["R2 U2 R U2 R2", "R2 U2 R' U2 R2", "R U2 R' U' R U R' U' R U' R'", "F R U R' U' R U R' U' R U R' U' F'"]),
  oll("pi", "Pi", "None oriented", ["F R U R' U' R U R' U' F'", "R U2 R2 U' R2 U' R2 U2 R", "R' U2 R2 U R2 U R2 U2 R'"]),
  oll("u", "U", "Two oriented", ["F R U R' U' F'", "R2 D R' U2 R D' R' U2 R'", "R2 D' R U2 R' D R U2 R"]),
  oll("t", "T", "Two oriented", ["R U R' U' R' F R F'", "R' F' R U R U' R' F", "y2 L' U' L U L F' L' F"]),
  oll("l", "L", "Two oriented", ["F R' F' R U R U' R'", "F R U' R' U' R U R' F'", "F' R U R' U' R' F R"]),
];

// Names say what's swapped in each layer: "Adj" = two neighbouring corners (one side already has a
// matching pair), "Diag" = two opposite corners. For a case with the swap only on the bottom (or
// Diag top / Adj bottom), turn the cube over (x2 or z2) first.
export const PBL: AlgCase[] = [
  pbl("adj", "Adj top", "One layer", ["R U2 R' U' R U2 L' U R' U' L", "R U R' F' R U R' U' R' F R2 U' R'", "R U R' U' R' F R2 U' R' U' R U R' F'"]),
  pbl("diag", "Diag top", "One layer", ["R U' R' U' F2 U' R U R' D R2", "F R U' R' U' R U R' F' R U R' U' R' F R F'", "F R' F R2 U' R' U' R U R' F' R U R' U' F'", "R U' R' U' F2 U' R U R' U F2"]),
  pbl("adj-adj", "Double adj", "Both layers", ["R2 U' B2 U2 R2 U' R2", "R2 U R2 U2 F2 U F2", "R2 U' R2 U2 F2 U' F2"]),
  pbl("diag-diag", "Double diag", "Both layers", ["R2 F2 R2", "R2 B2 R2", "x R2 U2 R2 x'"]),
  pbl("adj-diag", "Adj top / diag bottom", "Both layers", ["R U' R F2 R' U R'", "R' U R' F2 R F' R", "R' F R' F2 R U' R"]),
];
