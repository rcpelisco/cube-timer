import type { KPattern } from "cubing/kpuzzle";
import { ALGS, isAlgSet, puzzleOf, setupFor, type AlgCase, type AlgSet } from "./algs";
import { PBL } from "./algs2x2";
import { rotationFor, type CrossColor } from "./crossColor";
import type { LearnStatus } from "./algStatus";
import { isCrossLevel, isDrill, type CrossLevel, type Drill } from "./drills";

// OLL/PLL trainer: a scramble that leaves a chosen last-layer case, timed per case.
//
// The scramble is a real random-looking one (cubing.js solves the target state, and the scramble
// is that solution backwards), so it doesn't give the case away the way undoing the algorithm
// would. You scramble as usual (white top, green front), then hold the cube with your cross on
// the bottom: the case is on top, from a random angle, with a random final U turn for PLL.

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const AUF = ["", "U", "U2", "U'"];
const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
// All 24 ways to hold a cube.
const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => join(a, b)));

const centresHome = (p: KPattern) => p.patternData.CENTERS.pieces.every((piece, i) => piece === i);

async function target(alg: string, cross: CrossColor): Promise<KPattern> {
  const [{ cube3x3x3 }, { Alg }] = await Promise.all([import("cubing/puzzles"), import("cubing/alg")]);
  const kp = await cube3x3x3.kpuzzle();
  // The case as seen with the cross on the bottom, written in the scrambling orientation:
  // turn to the solving orientation, set up the case, turn back.
  const rot = rotationFor(cross);
  const back = rot ? new Alg(rot).invert().toString() : "";
  let p = kp.defaultPattern().applyAlg(join(rot, pick(AUF), setupFor(alg), pick(AUF), back));
  // Some algorithms include y turns that don't cancel out, which leaves the cube turned. Turn it
  // back so the centers are home again (same cube, held the standard way).
  if (!centresHome(p)) {
    const fix = ROTATIONS.find(r => centresHome(p.applyAlg(r)));
    if (fix) p = p.applyAlg(fix);
  }
  return p;
}

// 2×2: there are no centers, so the case is built on the 3×3 model (which also understands
// x/y/z turns) and its corners are handed to the 2×2 solver. The layers get a random relative
// turn, and for OLL a random PBL as well, since after a first face the corners' places are random
// too; this also keeps the scramble from simply undoing the algorithm.
const DTURN = ["", "D", "D2", "D'"];
async function scramble2x2(alg: string, set: AlgSet, cross: CrossColor): Promise<string> {
  const [{ cube2x2x2, cube3x3x3 }, { Alg }, { KPattern }, { experimentalSolve2x2x2 }] = await Promise.all([
    import("cubing/puzzles"), import("cubing/alg"), import("cubing/kpuzzle"), import("cubing/search"),
  ]);
  const [k3, k2] = await Promise.all([cube3x3x3.kpuzzle(), cube2x2x2.kpuzzle()]);
  const rot = rotationFor(cross);
  const back = rot ? new Alg(rot).invert().toString() : "";
  const perm = set === "OLL2"
    ? join(pick(AUF), pick(DTURN), Math.random() < 0.8 ? setupFor(pick(pick(PBL).algs)) : "", pick(AUF), pick(DTURN))
    : join(pick(DTURN));
  const p3 = k3.defaultPattern().applyAlg(join(rot, perm, pick(AUF), setupFor(alg), pick(AUF), pick(DTURN), back));
  const p2 = new KPattern(k2, { CORNERS: p3.patternData.CORNERS });
  const solution = await experimentalSolve2x2x2(p2);
  return solution.invert().toString().replace(/2'/g, "2");
}

export async function caseScramble(alg: string, cross: CrossColor, set: AlgSet = "OLL"): Promise<string> {
  if (puzzleOf(set) === "2x2") return scramble2x2(alg, set, cross);
  const p = await target(alg, cross);
  const { experimentalSolve3x3x3IgnoringCenters } = await import("cubing/search");
  const solution = await experimentalSolve3x3x3IgnoringCenters(p);
  // cubing.js writes reversed half turns as R2'; show them the usual way.
  return solution.invert().toString().replace(/2'/g, "2");
}

// ---------- Settings and times (this device) ----------

export interface TrainerState {
  set: AlgSet;
  pool: LearnStatus[];                      // which learning statuses to practise
  picked: Partial<Record<AlgSet, string[]>>; // chosen case ids per set; missing = every case
  times: Record<string, number[]>;          // ms per case id (or drillKey), oldest first
  drill: Drill | null;                      // last layer or cross practice instead of cases
  level: CrossLevel;                        // cross difficulty
  plan: boolean;                            // 15 s planning time before a cross
  focus: boolean;                           // pick slow and little-practised cases more often
}

const KEY = "cubeTimer.trainer";
const KEEP = 50;

export function loadTrainer(): TrainerState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<TrainerState> | null;
    if (v && isAlgSet(v.set) && Array.isArray(v.pool) && v.times && typeof v.times === "object") {
      const picked = v.picked && typeof v.picked === "object" ? v.picked : {};
      return {
        set: v.set, pool: v.pool, picked, times: v.times,
        drill: isDrill(v.drill) ? v.drill : null, level: isCrossLevel(v.level) ? v.level : "any", plan: v.plan !== false,
        focus: v.focus !== false,
      };
    }
  } catch { /* fall through */ }
  return { set: "OLL", pool: ["learning", "learned"], picked: {}, times: {}, drill: null, level: "any", plan: true, focus: true };
}

export function saveTrainer(s: TrainerState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const addTime = (times: number[] = [], t: number) => [...times, t].slice(-KEEP);

// Average of the last 5 times (or as many as there are), best, and count.
export function caseStats(times: number[] = []) {
  const recent = times.slice(-5);
  return {
    reps: times.length,
    avg: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
    best: times.length ? Math.min(...times) : null,
  };
}

// How often each case comes up when picks favour the cases that need work. Each case's weight
// grows with how slow its recent average is next to the pool's middle case (squared, so a case
// half again as slow comes up about twice as often), between 0.4 and 4. Cases with fewer than 5
// times get a boost, and untried ones a weight of 3 so they come up early.
export function caseWeights(pool: AlgCase[], times: TrainerState["times"]): number[] {
  const avgs = pool.map(c => caseStats(times[c.id]).avg);
  const known = avgs.filter((a): a is number => a != null).sort((a, b) => a - b);
  const mid = known.length ? known[Math.floor(known.length / 2)] : null;
  return pool.map((c, i) => {
    const reps = times[c.id]?.length ?? 0, avg = avgs[i];
    if (!reps || avg == null || !mid) return 3;
    const slow = Math.min(4, Math.max(0.4, (avg / mid) ** 2));
    return slow * (reps < 5 ? 1 + (5 - reps) * 0.25 : 1);
  });
}

// Pick a case from the pool, not the same as last time when there's a choice; by weight when
// given (see caseWeights), else evenly.
export function nextCase(pool: AlgCase[], previous?: string, weights?: number[]): AlgCase | null {
  if (!pool.length) return null;
  const idx = pool.map((_, i) => i).filter(i => pool.length === 1 || pool[i].id !== previous);
  if (!weights) return pool[pick(idx)];
  const total = idx.reduce((sum, i) => sum + weights[i], 0);
  let r = Math.random() * total;
  for (const i of idx) { r -= weights[i]; if (r < 0) return pool[i]; }
  return pool[idx[idx.length - 1]];
}

export const casesFor = (set: AlgSet) => ALGS[set];
