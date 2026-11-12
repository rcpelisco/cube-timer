import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { ALGS, type AlgCase } from "./algs";
import { rotationFor, type CrossColor } from "./crossColor";

// Trainer drills on 3×3 that aren't a single case:
// - Last layer: first two layers solved, the last layer in a random state (any OLL with any PLL,
//   each as likely as on a real solve). Afterwards it says which OLL and PLL it was.
// - Cross: a random-state scramble whose cross (in your cross color) takes a chosen number of
//   moves at best, with the shortest solution shown afterwards.
// Both build a random state as seen when solving (cross on the bottom), then turn it into a
// scramble for the usual white top, green front, as the case trainer does.

export type Drill = "LL" | "cross";
export const isDrill = (v: unknown): v is Drill => v === "LL" || v === "cross";

export type CrossLevel = "easy" | "any" | "hard";
export const CROSS_LEVELS: { id: CrossLevel; label: string; note: string; ok: (n: number) => boolean }[] = [
  { id: "easy", label: "Easy", note: "5 moves or fewer", ok: n => n <= 5 },
  { id: "any", label: "Any", note: "any cross", ok: () => true },
  { id: "hard", label: "Hard", note: "7 or 8 moves", ok: n => n >= 7 },
];
export const isCrossLevel = (v: unknown): v is CrossLevel => CROSS_LEVELS.some(l => l.id === v);

// Keys for the drills' times in the trainer's store (case ids never contain a colon).
export const drillKey = (drill: Drill, level: CrossLevel) => (drill === "LL" ? "drill:LL" : `drill:cross:${level}`);

const AUF = ["", "U", "U2", "U'"];
const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => join(a, b)));
const rand = (n: number) => Math.floor(Math.random() * n);

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const parity = (p: number[]) => {
  let swaps = 0;
  const seen = p.map(() => false);
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = p[j]) { seen[j] = true; len++; }
    swaps += len - 1;
  }
  return swaps % 2;
};
// Random twists that add up to a multiple of `mod`, as on a real cube.
const twists = (n: number, mod: number) => {
  const o = Array.from({ length: n - 1 }, () => rand(mod));
  return [...o, (mod - (o.reduce((a, b) => a + b, 0) % mod)) % mod];
};
// A random arrangement of `pieces` (positions), with the rest left alone. Edge and corner swaps
// must match, so the corners are reshuffled until they do.
function randomOrbits(edges: number[], corners: number[], cornerParity?: number) {
  const ep = shuffled(edges.length), eo = twists(edges.length, 2);
  let cp = shuffled(corners.length);
  const want = cornerParity ?? parity(ep);
  while (parity(cp) !== want) cp = shuffled(corners.length);
  const co = twists(corners.length, 3);
  const E = { pieces: [...Array(12).keys()], orientation: Array(12).fill(0) };
  const C = { pieces: [...Array(8).keys()], orientation: Array(8).fill(0) };
  edges.forEach((pos, i) => { E.pieces[pos] = edges[ep[i]]; E.orientation[pos] = eo[i]; });
  corners.forEach((pos, i) => { C.pieces[pos] = corners[cp[i]]; C.orientation[pos] = co[i]; });
  return { EDGES: E, CORNERS: C };
}

async function kit() {
  const [{ cube3x3x3 }, { Alg }, { KPattern, KTransformation }] = await Promise.all([
    import("cubing/puzzles"), import("cubing/alg"), import("cubing/kpuzzle"),
  ]);
  return { kp: await cube3x3x3.kpuzzle(), Alg, KPattern, KTransformation };
}
type Kit = Awaited<ReturnType<typeof kit>>;

const centresHome = (p: KPattern) => p.patternData.CENTERS.pieces.every((piece, i) => piece === i);
// Undo any whole-cube turn an algorithm leaves (some have y turns that don't cancel out).
const homed = (p: KPattern) => (centresHome(p) ? p : p.applyAlg(ROTATIONS.find(r => centresHome(p.applyAlg(r))) ?? ""));

// The state `orbits` (in the solving frame: cross on the bottom) as a pattern in the scrambling
// frame, then a scramble for it: cubing.js solves it, and the scramble is that solution backwards.
async function scrambleFor(k: Kit, orbits: ReturnType<typeof randomOrbits>, cross: CrossColor): Promise<string> {
  const { kp, Alg, KTransformation } = k;
  const id = kp.identityTransformation().transformationData;
  const t = new KTransformation(kp, {
    EDGES: { permutation: orbits.EDGES.pieces, orientationDelta: orbits.EDGES.orientation },
    CORNERS: { permutation: orbits.CORNERS.pieces, orientationDelta: orbits.CORNERS.orientation },
    CENTERS: id.CENTERS,
  });
  const rot = rotationFor(cross);
  const back = rot ? new Alg(rot).invert().toString() : "";
  const p = kp.defaultPattern().applyAlg(rot).applyTransformation(t).applyAlg(back);
  const { experimentalSolve3x3x3IgnoringCenters } = await import("cubing/search");
  const solution = await experimentalSolve3x3x3IgnoringCenters(p);
  return solution.invert().toString().replace(/2'/g, "2");
}

// ---------- Last layer ----------

const U_EDGES = [0, 1, 2, 3], U_CORNERS = [0, 1, 2, 3];

const oriented = (p: KPattern) =>
  U_EDGES.every(i => p.patternData.EDGES.orientation[i] === 0) && U_CORNERS.every(i => p.patternData.CORNERS.orientation[i] === 0);
const solvedUpToAuf = (p: KPattern, solved: KPattern) =>
  AUF.some(a => {
    const q = p.applyAlg(a).patternData, s = solved.patternData;
    return (["EDGES", "CORNERS"] as const).every(o =>
      q[o].pieces.every((x, i) => x === s[o].pieces[i]) && q[o].orientation.every((x, i) => x === s[o].orientation[i]));
  });

// A case, "skip" when that step was already done, or null if it couldn't be told.
export type LLStep = AlgCase | "skip" | null;
export interface LLResult { scramble: string; oll: LLStep; pll: LLStep }

// alg: the algorithm you use for a case (your pick on the Algorithms page), used to tell which
// case it was; the PLL is the one your OLL algorithm leaves.
export async function llScramble(cross: CrossColor, alg: (c: AlgCase) => string): Promise<LLResult> {
  const k = await kit();
  const orbits = randomOrbits(U_EDGES, U_CORNERS);
  const solved = k.kp.defaultPattern();
  const start = new k.KPattern(k.kp, { ...solved.patternData, ...orbits });

  let afterOll: KPattern | null = oriented(start) ? start : null;
  let oll: LLStep = afterOll ? "skip" : null;
  for (const c of afterOll ? [] : ALGS.OLL) {
    const hit = AUF.map(a => homed(start.applyAlg(join(a, alg(c))))).find(oriented);
    if (hit) { oll = c; afterOll = hit; break; }
  }
  let pll: LLStep = null;
  if (afterOll) {
    const from = afterOll;
    pll = solvedUpToAuf(from, solved) ? "skip"
      : ALGS.PLL.find(c => AUF.some(a => solvedUpToAuf(homed(from.applyAlg(join(a, alg(c)))), solved))) ?? null;
  }
  return { scramble: await scrambleFor(k, orbits, cross), oll, pll };
}

// ---------- Cross ----------

// Shortest cross by search: the four bottom edges' places and flips, with a table of how far
// every arrangement of them is from solved (190,080 of them, built once).
const FACES = ["U", "D", "F", "B", "R", "L"];
const MOVES = FACES.flatMap(f => [f, `${f}2`, `${f}'`]);
const CROSS = [4, 5, 6, 7]; // DF, DR, DB, DL

let table: { moveEdge: Int8Array[]; dist: Int8Array } | null = null;
const code = (e: number[]) => ((e[0] * 24 + e[1]) * 24 + e[2]) * 24 + e[3];

function crossTable(kp: KPuzzle) {
  if (table) return table;
  // moveEdge[m][pos * 2 + flip] = where an edge there goes under move m (same encoding).
  const moveEdge = MOVES.map(m => {
    const { permutation, orientationDelta } = kp.moveToTransformation(m).transformationData.EDGES;
    const out = new Int8Array(24);
    permutation.forEach((from, to) => {
      for (const f of [0, 1]) out[from * 2 + f] = to * 2 + ((f + orientationDelta[to]) % 2);
    });
    return out;
  });
  const dist = new Int8Array(24 ** 4).fill(-1);
  let frontier = [CROSS.map(p => p * 2)];
  dist[code(frontier[0])] = 0;
  for (let d = 0; frontier.length; d++) {
    const next: number[][] = [];
    for (const e of frontier) {
      for (const me of moveEdge) {
        const n = e.map(x => me[x]), c = code(n);
        if (dist[c] === -1) { dist[c] = d + 1; next.push(n); }
      }
    }
    frontier = next;
  }
  return (table = { moveEdge, dist });
}

// Where each cross edge is (pos * 2 + flip) in a state given as pieces/orientation per position.
const crossEdges = (E: { pieces: number[]; orientation: number[] }) =>
  CROSS.map(piece => { const pos = E.pieces.indexOf(piece); return pos * 2 + E.orientation[pos]; });

export interface CrossResult { scramble: string; moves: number; solution: string }

export async function crossScramble(cross: CrossColor, level: CrossLevel): Promise<CrossResult> {
  const k = await kit();
  const { moveEdge, dist } = crossTable(k.kp);
  const ok = CROSS_LEVELS.find(l => l.id === level)!.ok;
  const all = [...Array(12).keys()], corners = [...Array(8).keys()];
  let orbits = randomOrbits(all, corners);
  let e = crossEdges(orbits.EDGES);
  for (let tries = 0; !ok(dist[code(e)]) && tries < 5000; tries++) {
    orbits = randomOrbits(all, corners);
    e = crossEdges(orbits.EDGES);
  }
  const moves = dist[code(e)];
  // Walk down the table for one shortest solution.
  const solution: string[] = [];
  for (let d = moves; d > 0; d--) {
    const m = moveEdge.findIndex(me => dist[code(e.map(x => me[x]))] === d - 1);
    solution.push(MOVES[m]);
    e = e.map(x => moveEdge[m][x]);
  }
  return { scramble: await scrambleFor(k, orbits, cross), moves, solution: solution.join(" ") };
}
