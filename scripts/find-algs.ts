// Builds src/lib/algsF2L.ts and src/lib/algsCOLL.ts: every F2L and COLL case, each with up to 4
// algorithms checked on a cube model (scripts/alg-model-more.ts).
//
// For each case it takes, in order: well-known human algorithms from the lists below that solve
// it (the model decides which case each one is), then the shortest solutions cubing.js's twips
// search finds using a few small sets of moves (<R,U>, <R,U,F>, …), so every case gets something
// even where nothing from the lists fits. The search ignores what doesn't matter for the case: the
// last layer for F2L, and where the edges end up for COLL.
//
// Run: node scripts/find-algs.ts [f2l|coll]   (a few minutes; then npm run check:algs)
import { writeFileSync } from "node:fs";
import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolveTwips } from "cubing/search";
import { normalizeAlg, solved, type Pattern } from "./alg-model.ts";
import {
  collCase, collKeyOf, collProblems, collShapeOf, f2lCanonical, f2lGroup, f2lPlaceOf, f2lProblems, type PairPlace,
} from "./alg-model-more.ts";

const kp = await cube3x3x3.kpuzzle();
const MAX = 4;

// ---------- Known algorithms (front-right slot / top layer; any order, the model sorts them) ----------

const F2L_KNOWN = `
R U R' | U R U' R' | F' U' F | U' F' U F | U' R U R' U2 R U' R' | U' R U2 R' U2 R U' R' | U' R U' R' U R U R'
U' R U R' U R U R' | R U' R' U2 F' U' F | U F' U' F U2 F' U F | U F' U2 F U2 F' U F | U F' U F U' F' U' F
U F' U' F U' F' U' F | R U2 R' U' R U R' | U R U2 R' U R U' R' | U2 R U R' U R U' R' | R U R' U2 R U R' U' R U R'
U R U' R' U' R U' R' U R U' R' | F U R U' R' F' R U' R' | U' R' F R F' R U' R' | U R U' R' F R' F' R
R U' R' U R U' R' | R U R' U' R U R' | U' R U' R' U2 R U' R' | U R U R' U2 R U R' | U F' U' F U' R U R'
R U' R' U' R U R' U2 R U' R' | R U' R' U R U2 R' U R U' R' | R U R' U' R U' R' U2 F' U' F
R U' R' U' R U R' U' R U2 R' | R2 U2 F R2 F' U2 R' U R' | R U R' U2 R U' R' U R U R'
U R U' R' U R U' R' U R U' R' | U' R U' R' U R U' R' U R U R' | R U R' U' R U R' U' R U R'
U' R U R' U F' U' F | U R U' R' U' F' U F | R U2 R U R' U R U2 R2 | U2 R U' R' U' R U R'
R U' R' U2 R U' R' | U R U2 R' U R U R'
U' R U2 R' U F' U' F | U F' U2 F U' R U R' | U2 F' U' F U' F' U F | F R' F' R | U' F R' F' R
R U' R' U' F' U F | U' R U' R' U2 F' U' F | U F' U F U2 R U R' | R U R' U' F' U F | F' U F U' F' U F
R U2 R' U2 R U' R' | F' U2 F U2 F' U F | U R U R' U' R U R' U' R U R' | U' F' U' F U F' U' F U F' U' F
`;

const COLL_KNOWN = `
R U R' U R U2 R' | R U2 R' U' R U' R' | L' U' L U' L' U2 L | L' U2 L U L' U L
R' U' R U' R' U2 R | R' U2 R U R' U R | R U R' U R U' R' U R U2 R' | R U2 R' U' R U R' U' R U' R'
R U2 R2 U' R2 U' R2 U2 R | R' U2 R2 U R2 U R2 U2 R' | R2 D R' U2 R D' R' U2 R' | R2 D' R U2 R' D R U2 R
R U R' U' R' F R F' | F R' F' r U R U' r' | R' U2 R U2 R' F R U R' U' R' F' R2
R U R' U R U' R' U R U' R' U R U2 R' | R U2 R' U' R U R' U' R U R' U' R U' R'
F R U R' U' R U R' U' R U R' U' F' | R U R' U R U2 R' U R U2 R' U' R U' R'
R' U' R U' R' U R U' R' U2 R | R U R' U R U' R' U R U2 R' | L' U R U' L U R'
R U2 R' U' R U' R' U2 L' U R U' L U R' | R' F R F' R U2 R' U' R U' R'
`;

const known = (text: string) => text.split(/[|\n]/).map(s => s.trim()).filter(Boolean).map(normalizeAlg);

// ---------- Search ----------

// The last-layer pieces as one indistinguishable piece each, so the search doesn't care where they
// go. `twist`: also ignore their orientation (F2L) or keep it (COLL edges).
type Blur = { edges: boolean; edgeTwist: boolean; corners: boolean };
function blur(p: Pattern, b: Blur): KPattern {
  const d = structuredClone(p.patternData) as Record<string, { pieces: number[]; orientation: number[]; orientationMod?: number[] }>;
  const go = (orbit: string, twist: boolean) => {
    const o = d[orbit];
    o.orientationMod = o.pieces.map(() => 0);
    o.pieces = o.pieces.map((v, i) => {
      if (v >= 4) return v;
      if (twist) { o.orientationMod![i] = 1; o.orientation[i] = 0; }
      return 0;
    });
  };
  if (b.edges) go("EDGES", b.edgeTwist);
  if (b.corners) go("CORNERS", true);
  return new KPattern(kp, d as never);
}

// maxDepth: some cases can't be solved with some move sets at all (a flipped edge needs F), and
// the search would otherwise never stop.
async function search(start: KPattern, target: KPattern, moves: string[], maxDepth: number): Promise<string | null> {
  try {
    const a = await experimentalSolveTwips(kp, start, { generatorMoves: moves, targetPattern: target, maxDepth });
    return normalizeAlg(a.toString().replace(/2'/g, "2")) || null;
  } catch { return null; }
}

// How awkward an algorithm is to do: its length, plus extra for moves that need a regrip or are
// slow (B, D, L), for half turns of R and F, and for using more kinds of move.
const len = (alg: string) => alg.split(" ").length;
function effort(alg: string): number {
  const moves = alg.split(" ");
  let n = moves.length + new Set(moves.map(m => m[0])).size;
  for (const m of moves) {
    if ("BDL".includes(m[0])) n += 2.5;
    if (m === "F2" || m === "R2") n += 0.6;
  }
  return n;
}
const byEase = (a: string, b: string) => effort(a) - effort(b);
// Search results are kept only if they're about as easy as the case's best algorithm so far.
const SLACK = 5;
// The same moves with a U turn added at the start or end (an AUF) count as the same algorithm.
export const core = (alg: string) => alg.trim().split(/\s+/).join(" ").replace(/^(U2?'? )+/, "").replace(/( U2?'?)+$/, "");
function addSearched(list: string[], searched: string[]) {
  const sorted = searched.sort(byEase);
  const best = Math.min(...[...list, ...sorted].map(effort));
  for (const alg of sorted) {
    if (list.some(a => core(a) === core(alg)) || effort(alg) > best + SLACK) continue;
    list.push(alg);
  }
}

// ---------- F2L ----------

function f2lStart(x: PairPlace): Pattern {
  const d = structuredClone(solved.patternData);
  const put = (o: { pieces: number[]; orientation: number[] }, piece: number, slot: number, ori: number) => {
    const other = o.pieces[slot];
    o.pieces[o.pieces.indexOf(piece)] = other;
    o.pieces[slot] = piece;
    o.orientation[slot] = ori;
  };
  put(d.CORNERS, 4, x.cs, x.co);
  put(d.EDGES, 8, x.es, x.eo);
  return new KPattern(kp, d) as Pattern;
}

const F2L_MOVES = [["R", "U"], ["U", "F"], ["R", "U", "F"], ["R", "U", "D"], ["R", "U", "L"], ["R", "U", "B"]];

async function f2l() {
  const cases = new Map<string, PairPlace>();
  for (const cs of [0, 1, 2, 3, 4]) for (let co = 0; co < 3; co++) for (const es of [0, 1, 2, 3, 8]) for (let eo = 0; eo < 2; eo++) {
    if (cs === 4 && co === 0 && es === 8 && eo === 0) continue;
    const c = f2lCanonical(f2lStart({ cs, co, es, eo }));
    cases.set(JSON.stringify(c), c);
  }
  console.log(`F2L: ${cases.size} cases`);
  const found = new Map<string, string[]>([...cases.keys()].map(k => [k, []]));
  for (const alg of known(F2L_KNOWN)) {
    if (f2lProblems(alg).length) { console.log(`  known alg dropped: ${alg} (${f2lProblems(alg).join("; ")})`); continue; }
    const k = JSON.stringify(f2lPlaceOf(alg));
    if (!found.get(k)!.includes(alg)) found.get(k)!.push(alg);
  }
  const b: Blur = { edges: true, edgeTwist: true, corners: true };
  const target = blur(solved, b);
  for (const [k, c] of cases) {
    const searched: string[] = [];
    for (const moves of F2L_MOVES) {
      const alg = await search(blur(f2lStart(c), b), target, moves, 11);
      if (alg && !f2lProblems(alg).length && JSON.stringify(f2lPlaceOf(alg)) === k && !searched.includes(alg)) searched.push(alg);
    }
    const list = found.get(k)!;
    addSearched(list, searched);
    console.log(`  F2L ${f2lGroup(c)}: ${list.length} algorithms`);
  }
  return [...cases].map(([k, c]) => ({ place: c, group: f2lGroup(c), algs: found.get(k)!.slice(0, MAX) }));
}

// ---------- COLL ----------

const COLL_MOVES = [["R", "U"], ["R", "U", "F"], ["R", "U", "L"], ["R", "U", "D"], ["R", "U", "B"], ["R", "U", "F", "L"]];

function collStarts(): Map<string, Pattern> {
  const perms: number[][] = [];
  const permute = (rest: number[], acc: number[]) => {
    if (!rest.length) { perms.push(acc); return; }
    rest.forEach((v, i) => permute(rest.filter((_, j) => j !== i), [...acc, v]));
  };
  permute([0, 1, 2, 3], []);
  const out = new Map<string, Pattern>();
  for (const cp of perms) for (let t = 0; t < 27; t++) {
    const co = [t % 3, Math.floor(t / 3) % 3, Math.floor(t / 9) % 3];
    co.push((6 - co[0] - co[1] - co[2]) % 3);
    if (co.every(o => o === 0)) continue;
    const d = structuredClone(solved.patternData);
    d.CORNERS.pieces.splice(0, 4, ...cp);
    d.CORNERS.orientation.splice(0, 4, ...co);
    const p = new KPattern(kp, d) as Pattern;
    const k = collKeyOf(p);
    if (!out.has(k)) out.set(k, p);
  }
  return out;
}

async function coll() {
  const cases = collStarts();
  console.log(`COLL: ${cases.size} cases`);
  const found = new Map<string, string[]>([...cases.keys()].map(k => [k, []]));
  for (const alg of known(COLL_KNOWN)) {
    if (collProblems(alg).length) { console.log(`  known alg dropped: ${alg} (${collProblems(alg).join("; ")})`); continue; }
    const k = collKeyOf(collCase(alg));
    if (!found.get(k)!.includes(alg)) found.get(k)!.push(alg);
  }
  const b: Blur = { edges: true, edgeTwist: false, corners: false };
  // Any U turn at the end is fine: try each.
  const targets = [0, 1, 2, 3].map(a => blur(solved.applyAlg(new Alg(["", "U", "U2", "U'"][a])), b));
  let n = 0;
  for (const [k, p] of cases) {
    const searched: string[] = [];
    for (const moves of COLL_MOVES) for (const target of targets) {
      const alg = await search(blur(p, b), target, moves, 14);
      if (alg && !collProblems(alg).length && collKeyOf(collCase(alg)) === k && !searched.includes(alg)) searched.push(alg);
    }
    const list = found.get(k)!;
    addSearched(list, searched);
    console.log(`  ${++n}/${cases.size} ${collShapeOf(p)}: ${list.length} algorithms`);
  }
  return [...cases].map(([k, p]) => ({ shape: collShapeOf(p), algs: found.get(k)!.slice(0, MAX) }));
}

// ---------- Write ----------

const q = (s: string) => JSON.stringify(s);
const shortest = (algs: string[]) => Math.min(...algs.map(len));

const only = process.argv[2];
if (only !== "coll") {
const f = await f2l();
const F2L_GROUPS = ["Both on top", "Cross color up", "Edge in slot", "Corner in slot", "Both in slot"];
f.sort((a, b) => F2L_GROUPS.indexOf(a.group) - F2L_GROUPS.indexOf(b.group) || shortest(a.algs) - shortest(b.algs)
  || (a.algs[0] < b.algs[0] ? -1 : 1));
writeFileSync(new URL("../src/lib/algsF2L.ts", import.meta.url), `import type { AlgCase } from "./algs";

// F2L for the front-right slot: the 41 places the slot's corner and edge can be, with the cross and
// the other slots solved. Numbered here by group (where the pieces are), then shortest first, so the
// numbers don't match other sites'. Generated by scripts/find-algs.ts (well-known algorithms where
// they fit, then the shortest found by search) and checked by \`npm run check:algs\`: each algorithm
// keeps the cross and the other slots, leaves the cube held the same way, and solves its case.
// Groups: "Both on top" (corner's cross color facing a side), "Cross color up" (both on top, cross
// color facing up), "Edge in slot", "Corner in slot", "Both in slot" (paired wrongly in the slot).

const f2l = (n: number, group: string, algs: string[]): AlgCase =>
  ({ set: "F2L", id: \`f2l-\${n}\`, name: \`F2L \${n}\`, group, algs });

export const F2L: AlgCase[] = [
${f.map((c, i) => `  f2l(${i + 1}, ${q(c.group)}, [${c.algs.map(q).join(", ")}]),`).join("\n")}
];
`);
console.log(`F2L: ${f.reduce((n, x) => n + x.algs.length, 0)} algorithms for ${f.length} cases${f.some(x => !x.algs.length) ? " ✗ some cases have none" : ""}`);
}

if (only !== "f2l") {
const c = await coll();
const SHAPES = ["Sune", "Antisune", "H", "Pi", "U", "T", "L"];
c.sort((a, b) => SHAPES.indexOf(a.shape) - SHAPES.indexOf(b.shape) || shortest(a.algs) - shortest(b.algs)
  || (a.algs[0] < b.algs[0] ? -1 : 1));
const num = new Map<string, number>();
writeFileSync(new URL("../src/lib/algsCOLL.ts", import.meta.url), `import type { AlgCase } from "./algs";

// COLL: with the first two layers done and the top edges oriented, orient and place the corners in
// one algorithm, leaving only an edge PLL (U, H or Z perm, or nothing). 40 cases in 7 groups by
// the top's shape (as OLL: Sune, Antisune, H, Pi, U, T, L), numbered within each group, shortest
// first; other sites number them differently. Generated by scripts/find-algs.ts (well-known
// algorithms where they fit, then the shortest found by search) and checked by \`npm run check:algs\`.

const coll = (shape: string, n: number, algs: string[]): AlgCase =>
  ({ set: "COLL", id: \`coll-\${shape.toLowerCase()}-\${n}\`, name: \`\${shape} \${n}\`, group: shape, algs });

export const COLL: AlgCase[] = [
${c.map(x => { const n = (num.get(x.shape) ?? 0) + 1; num.set(x.shape, n); return `  coll(${q(x.shape)}, ${n}, [${x.algs.map(q).join(", ")}]),`; }).join("\n")}
];
`);
console.log(`COLL: ${c.reduce((n, x) => n + x.algs.length, 0)} algorithms for ${c.length} cases${c.some(x => !x.algs.length) ? " ✗ some cases have none" : ""}`);
}
process.exit(0);
