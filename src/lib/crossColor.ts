// Which color you build the cross on, for the algorithm diagrams. The cube is turned so that color
// is on the bottom; the opposite color is the last layer on top. Stored per device.
// Standard scheme (cubing.js default, white top / green front): U white, D yellow, F green,
// B blue, R red, L orange.

export type CrossColor = "white" | "yellow" | "green" | "blue" | "red" | "orange";

const C = { white: "#f4f4f4", yellow: "#ffd500", green: "#0a9a4a", blue: "#0051ba", red: "#c8102e", orange: "#ff5800" };

// faces: the color of each side in the solver's frame (top, front, right, back, left) when the
// cross is on the bottom, holding the cube with the usual front for that cross.
export const CROSS_COLORS: {
  id: CrossColor; label: string; swatch: string; top: string; rotation: string;
  faces: { U: string; F: string; R: string; B: string; L: string };
}[] = [
  { id: "white", label: "White", swatch: C.white, top: "yellow", rotation: "z2", faces: { U: C.yellow, F: C.green, R: C.orange, B: C.blue, L: C.red } },
  { id: "yellow", label: "Yellow", swatch: C.yellow, top: "white", rotation: "", faces: { U: C.white, F: C.green, R: C.red, B: C.blue, L: C.orange } },
  { id: "green", label: "Green", swatch: C.green, top: "blue", rotation: "x'", faces: { U: C.blue, F: C.white, R: C.red, B: C.yellow, L: C.orange } },
  { id: "blue", label: "Blue", swatch: C.blue, top: "green", rotation: "x", faces: { U: C.green, F: C.yellow, R: C.red, B: C.white, L: C.orange } },
  { id: "red", label: "Red", swatch: C.red, top: "orange", rotation: "z", faces: { U: C.orange, F: C.green, R: C.white, B: C.blue, L: C.yellow } },
  { id: "orange", label: "Orange", swatch: C.orange, top: "red", rotation: "z'", faces: { U: C.red, F: C.green, R: C.yellow, B: C.blue, L: C.white } },
];

const KEY = "cubeTimer.crossColor";

export function loadCrossColor(): CrossColor {
  try {
    const v = localStorage.getItem(KEY);
    return CROSS_COLORS.some(c => c.id === v) ? (v as CrossColor) : "white";
  } catch { return "white"; }
}

export function saveCrossColor(c: CrossColor) {
  try { localStorage.setItem(KEY, c); } catch { /* ignore */ }
}

const info = (c: CrossColor) => CROSS_COLORS.find(x => x.id === c)!;
export const rotationFor = (c: CrossColor) => info(c).rotation;
export const facesFor = (c: CrossColor) => info(c).faces;

// The face (in cubing.js's white-top frame) whose color ends up on top for each cross color.
const TOP_FACE: Record<CrossColor, string> = { white: "D", yellow: "U", green: "B", blue: "F", red: "L", orange: "R" };

// cubing.js 3×3 pieces, written with their stickers in cubing.js's order: edges follow the usual
// names (UF, UR, …); corners go U/D sticker first and then the other two the opposite way round
// from the usual names (UFR is stored U, R, F). Checked visually for every cross color.
const EDGES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const CENTERS = ["U", "L", "F", "R", "B", "D"];

type Facelet = "regular" | "dim" | "ignored";

// cubing.js's own OLL/PLL stickerings gray out pieces by identity (the white-face pieces), which
// is wrong once the cube is turned. This builds the same look for whichever face is on top:
// OLL shows only the top-color stickers of last-layer pieces; PLL grays the top color and shows
// the side colors; the first two layers are dimmed in both. F2L and COLL: see stickeringMask.
// 2×2 (same corner order as the 3×3): OLL shows only the top color on the top layer and dims
// the bottom; PBL shows everything, since both layers matter.
export function stickeringMask2x2(set: "OLL2" | "PBL", cross: CrossColor) {
  const top = TOP_FACE[cross];
  const piece = (name: string): { facelets: Facelet[] } => ({
    facelets: [...name].map(face => {
      if (set === "PBL") return "regular";
      if (!name.includes(top)) return "dim";
      return face === top ? "regular" : "ignored";
    }),
  });
  return { orbits: { CORNERS: { pieces: CORNERS.map(piece) } } };
}

export function stickeringMask(set: "OLL" | "PLL" | "F2L" | "COLL", cross: CrossColor) {
  const top = TOP_FACE[cross];
  // F2L: the last layer doesn't matter (gray); the cross, slots and pair show their colors.
  // COLL: corners show every color; edges only their top color (their places don't matter).
  const piece = (name: string, edge: boolean): { facelets: Facelet[] } => ({
    facelets: [...name].map(face => {
      if (set === "F2L") return name.includes(top) ? "ignored" : "regular";
      if (!name.includes(top)) return "dim";
      if (set === "OLL") return face === top ? "regular" : "ignored";
      if (set === "COLL") return edge && face !== top ? "ignored" : "regular";
      return face === top ? "dim" : "regular";
    }),
  });
  const center = (name: string): { facelets: Facelet[] } =>
    ({ facelets: [set === "F2L" || (name === top && (set === "OLL" || set === "COLL")) ? "regular" : "dim"] });
  return {
    orbits: {
      EDGES: { pieces: EDGES.map(n => piece(n, true)) },
      CORNERS: { pieces: CORNERS.map(n => piece(n, false)) },
      CENTERS: { pieces: CENTERS.map(center) },
    },
  };
}
