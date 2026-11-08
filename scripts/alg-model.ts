// Shared checks for OLL/PLL algorithms on a cube model (cubing.js), used by build-algs.ts and
// check-algs.ts. A case state is built by undoing the algorithm on a solved cube.
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";

const kp = await cube3x3x3.kpuzzle();
export const solved = kp.defaultPattern();
export type Pattern = ReturnType<typeof solved.applyAlg>;
export type SetName = "OLL" | "PLL";

// cubing.js 3×3 piece order. EDGES: UF UR UB UL DF DR DB DL FR FL BR BL.
// CORNERS: UFR URB UBL ULF DRF DFL DLB DBR. Last-layer slots are 0–3 in both, going round U.
const ll = (p: Pattern) => ({
  ep: p.patternData.EDGES.pieces.slice(0, 4), eo: p.patternData.EDGES.orientation.slice(0, 4),
  cp: p.patternData.CORNERS.pieces.slice(0, 4), co: p.patternData.CORNERS.orientation.slice(0, 4),
});
const auf = (n: number) => ["", "U", "U2", "U'"][n];
const ROT = ["", "y", "y2", "y'"];

// Tidy notation: no brackets, R2' → R2, R3 → R', R3' → R.
export function normalizeAlg(alg: string): string {
  return alg.replace(/[()]/g, " ").trim().split(/\s+/).map(m => {
    const r = /^(.+?)(\d*)('?)$/.exec(m)!;
    const [, face, amt, prime] = r;
    if (amt === "2") return `${face}2`;
    if (amt === "3") return prime ? face : `${face}'`;
    return m;
  }).join(" ");
}

export function caseState(alg: string): Pattern { return solved.applyAlg(new Alg(alg).invert()); }

// The case as seen with the centers in their usual places: algorithms may start with y turns,
// which leave the top on top but turn the sides. Returns the y turn used, or null if the top
// doesn't stay on top.
export function normalizing(p: Pattern): string | null {
  for (const r of ROT) {
    const q = r ? p.applyAlg(new Alg(r)) : p;
    if (q.patternData.CENTERS.pieces.every((v, i) => v === i)) return r;
  }
  return null;
}
export function normalized(p: Pattern): Pattern | null {
  const r = normalizing(p);
  return r === null ? null : r ? p.applyAlg(new Alg(r)) : p;
}

export function problems(set: SetName, group: string, alg: string): string[] {
  let p0: Pattern;
  try { p0 = caseState(alg); } catch (e) { return [`can't parse (${(e as Error).message})`]; }
  const p = normalized(p0);
  if (!p) return ["turns the cube so the top isn't on top"];
  const out: string[] = [];
  const e = p.patternData.EDGES, k = p.patternData.CORNERS;
  for (let i = 4; i < 12; i++) if (e.pieces[i] !== i || e.orientation[i] !== 0) { out.push("breaks the first two layers (edges)"); break; }
  for (let i = 4; i < 8; i++) if (k.pieces[i] !== i || k.orientation[i] !== 0) { out.push("breaks the first two layers (corners)"); break; }
  if (out.length) return out;

  const { eo, co } = ll(p);
  const edgesOk = eo.map(o => o === 0);
  const nEdges = edgesOk.filter(Boolean).length, nCorners = co.filter(o => o === 0).length;

  if (set === "OLL") {
    if (nEdges === 4 && nCorners === 4) return ["is already oriented (not an OLL case)"];
    const opposite = nEdges === 2 && ((edgesOk[0] && edgesOk[2]) || (edgesOk[1] && edgesOk[3]));
    const expect: Record<string, boolean> = {
      "Dot": nEdges === 0,
      "Edges oriented": nEdges === 4,
      "Corners oriented": nCorners === 4 && nEdges === 2,
      "Line": opposite, "T shapes": opposite, "C shapes": opposite, "Knight move": opposite,
      // Lightning covers both kinds: 7, 8, 11, 12 have adjacent edges, 39 and 40 opposite.
      "Lightning": nEdges === 2,
    };
    const ok = group in expect ? expect[group] : nEdges === 2 && !opposite; // adjacent-edge shapes
    if (!ok) out.push(`orientation doesn't fit group "${group}" (${nEdges} edges, ${nCorners} corners oriented)`);
    return out;
  }

  if (nEdges !== 4 || nCorners !== 4) return ["last layer isn't fully oriented (not a PLL case)"];
  const variants = [0, 1, 2, 3].map(a => ll(p.applyAlg(new Alg(auf(a)))));
  const id = (xs: number[]) => xs.every((v, i) => v === i);
  if (variants.every(v => id(v.ep) && id(v.cp))) return ["is already solved (not a PLL case)"];
  const swaps = (cp: number[]) => {
    const wrong = cp.map((v, i) => (v === i ? -1 : i)).filter(i => i >= 0);
    return wrong.length === 2 && cp[wrong[0]] === wrong[1] ? (wrong[1] - wrong[0]) % 2 === 1 ? "adjacent" : "diagonal" : null;
  };
  const groupOk: Record<string, boolean> = {
    "Edges only": variants.some(v => id(v.cp)),
    "Corners only": variants.some(v => id(v.ep)),
    "Adjacent swap": variants.some(v => swaps(v.cp) === "adjacent"),
    "Diagonal swap": variants.some(v => swaps(v.cp) === "diagonal"),
  };
  if (!groupOk[group]) out.push(`permutation doesn't fit group "${group}"`);
  return out;
}

// Same case up to U turns: OLL compares orientation only (turning U before), PLL also allows a U
// turn after (relabelling the pieces). Call only on algorithms with no problems.
export function caseKey(set: SetName, alg: string): string {
  const r = normalizing(caseState(alg))!;
  const t = kp.algToTransformation(new Alg(alg).invert().concat(new Alg(r)));
  const keys: string[] = [];
  for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) {
    if (set === "OLL" && b > 0) continue;
    const q = solved.applyAlg(new Alg(auf(b))).applyTransformation(t).applyAlg(new Alg(auf(a)));
    const s = ll(q);
    keys.push(set === "OLL" ? `${s.eo.join("")}|${s.co.join("")}` : `${s.ep.join("")}|${s.cp.join("")}`);
  }
  return keys.sort()[0];
}
