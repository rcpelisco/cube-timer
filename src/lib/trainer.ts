import type { KPattern } from "cubing/kpuzzle";
import { ALGS, isAlgSet, OLL, PLL, puzzleOf, setupFor, type AlgCase, type AlgSet } from "./algs";
import { PBL } from "./algs2x2";
import { rotationFor, type CrossColor } from "./crossColor";
import type { LearnStatus } from "./algStatus";
import { isCrossLevel, isDrill, type CrossLevel, type Drill } from "./drills";

// Case trainer (F2L, OLL, PLL, COLL, the 2×2's, and 4×4 parity): a scramble that leaves a chosen case, timed per case.
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

// What else the cube has on it for the case, done before the case's setup. F2L: a random last
// layer (any OLL with any PLL), as on a real solve. COLL: the edges in a random order (an edge PLL
// or none), which is what the algorithm leaves. OLL/PLL: nothing. Done in parts, each from a cube
// held the standard way (an algorithm can leave the cube turned, e.g. by a wide move).
function surroundings(set: AlgSet): string[] {
  if (set === "F2L") return [join(pick(AUF), setupFor(pick(pick(PLL).algs))), join(pick(AUF), setupFor(pick(pick(OLL).algs)))];
  if (set === "COLL") {
    const epll = PLL.filter(c => c.group === "Edges only");
    return Math.random() < 0.2 ? [] : [setupFor(pick(pick(epll).algs))];
  }
  return [];
}

async function target(alg: string, cross: CrossColor, set: AlgSet): Promise<KPattern> {
  const [{ cube3x3x3 }, { Alg }] = await Promise.all([import("cubing/puzzles"), import("cubing/alg")]);
  const kp = await cube3x3x3.kpuzzle();
  // The case as seen with the cross on the bottom, written in the scrambling orientation:
  // turn to the solving orientation, set up the case, turn back.
  const rot = rotationFor(cross);
  const back = rot ? new Alg(rot).invert().toString() : "";
  // Some algorithms include y turns that don't cancel out, which leaves the cube turned. Turn it
  // back so the centers are home again (same cube, held the standard way). This is done after the
  // surroundings too, so their turns don't move where the case is set up (an F2L pair's slot).
  const home = (p: KPattern) => {
    if (centresHome(p)) return p;
    const fix = ROTATIONS.find(r => centresHome(p.applyAlg(r)));
    return fix ? p.applyAlg(fix) : p;
  };
  const solving = kp.defaultPattern().applyAlg(rot);
  // The surroundings and case, in the solving orientation (centers home after `rot` is undone).
  const inSolving = (p: KPattern, moves: string) => home(p.applyAlg(join(moves, back))).applyAlg(rot);
  let p = solving;
  for (const part of surroundings(set)) p = inSolving(p, part);
  p = inSolving(p, join(pick(AUF), setupFor(alg), pick(AUF)));
  return home(p.applyAlg(back));
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

// Whole-cube turns written out of an algorithm: each later move is renamed to the face it turns
// once the cube is held as before. A 4×4 has no fixed centers, so how it's held at the end doesn't
// matter. x turns like R (the front comes up), y like U (the right comes to the front), z like F.
const TURN: Record<string, Record<string, string>> = {
  x: { U: "F", F: "D", D: "B", B: "U" },
  y: { F: "R", R: "B", B: "L", L: "F" },
  z: { U: "L", L: "D", D: "R", R: "U" },
};
export function withoutRotations(alg: string): string {
  let face: Record<string, string> = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  const out: string[] = [];
  for (const m of alg.split(/\s+/).filter(Boolean)) {
    const rot = /^([xyz])(2?)('?)$/.exec(m);
    if (rot) {
      const times = rot[2] ? 2 : rot[3] ? 3 : 1;
      for (let i = 0; i < times; i++) {
        const t = TURN[rot[1]], next = { ...face };
        for (const [to, from] of Object.entries(t)) next[to] = face[from];
        face = next;
      }
      continue;
    }
    out.push(m.replace(/[UDFBRL]/i, f => (f === f.toUpperCase() ? face[f] : face[f.toUpperCase()].toLowerCase())));
  }
  return out.join(" ");
}

// 4×4: cubing.js has no 4×4 solver, so the scramble is the case's setup itself, with whole-cube
// turns written out: a random 3×3 PLL for OLL parity (the top's pattern is the case; where its
// pieces are is random, as in a solve), then the case from a random angle, with a random last turn.
const OUTER = /^([UDFBRL][2']?|[xyz][2']?)$/;
function scramble4x4(alg: string, cross: CrossColor): string {
  const c = ALGS.PAR4.find(x => x.algs.includes(alg));
  const pll = PLL.flatMap(p => p.algs).filter(a => a.split(" ").every(m => OUTER.test(m)));
  const before = c?.group === "During OLL" && Math.random() < 0.8 ? join(pick(AUF), setupFor(pick(pll))) : "";
  return withoutRotations(join(rotationFor(cross), before, pick(AUF), setupFor(alg), pick(AUF))).replace(/2'/g, "2");
}

export async function caseScramble(alg: string, cross: CrossColor, set: AlgSet = "OLL"): Promise<string> {
  if (puzzleOf(set) === "2x2") return scramble2x2(alg, set, cross);
  if (puzzleOf(set) === "4x4") return scramble4x4(alg, cross);
  const p = await target(alg, cross, set);
  const { experimentalSolve3x3x3IgnoringCenters } = await import("cubing/search");
  const solution = await experimentalSolve3x3x3IgnoringCenters(p);
  // cubing.js writes reversed half turns as R2'; show them the usual way.
  return solution.invert().toString().replace(/2'/g, "2");
}

// ---------- Settings (this device) and times (synced) ----------

export interface TrainerState {
  set: AlgSet;
  pool: LearnStatus[];                      // which learning statuses to practise
  picked: Partial<Record<AlgSet, string[]>>; // chosen case ids per set; missing = every case
  times: Record<string, number[]>;          // ms per case id (or drillKey), oldest first
  timesAt: Record<string, number>;          // when each case's times last changed (ms); 0 or missing: before this was kept
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
        timesAt: v.timesAt && typeof v.timesAt === "object" ? v.timesAt : {},
        drill: isDrill(v.drill) ? v.drill : null, level: isCrossLevel(v.level) ? v.level : "any", plan: v.plan !== false,
        focus: v.focus !== false,
      };
    }
  } catch { /* fall through */ }
  return { set: "OLL", pool: ["learning", "learned"], picked: {}, times: {}, timesAt: {}, drill: null, level: "any", plan: true, focus: true };
}

export function saveTrainer(s: TrainerState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// The times are what syncs between devices (hooks/useCloudSync.ts); the rest of the Trainer's
// settings stay on each device.
export type TrainerTimes = Pick<TrainerState, "times" | "timesAt">;
export const NO_TRAINER_TIMES: TrainerTimes = { times: {}, timesAt: {} };

// Accepts what's stored in the cloud only if it has the right shape, dropping anything malformed.
export function readCloudTrainer(v: unknown): TrainerTimes | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<Record<keyof TrainerTimes, unknown>>;
  if (!o.times || typeof o.times !== "object") return null;
  const times: TrainerTimes["times"] = {}, timesAt: TrainerTimes["timesAt"] = {};
  const at = (o.timesAt && typeof o.timesAt === "object" ? o.timesAt : {}) as Record<string, unknown>;
  for (const [k, list] of Object.entries(o.times as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    times[k] = list.filter((t): t is number => typeof t === "number" && t > 0).slice(-KEEP);
    timesAt[k] = typeof at[k] === "number" ? at[k] : 0;
  }
  return { times, timesAt };
}

// This device's times merged with the cloud's, case by case: the copy changed most recently wins,
// so a deleted time stays deleted. Times from before changes were dated (0 on both sides) are
// combined, dated now so other devices take the combined list rather than adding theirs again.
export function mergeTrainerTimes(remote: TrainerTimes | null, local: TrainerTimes): TrainerTimes {
  if (!remote) return local;
  const times = { ...remote.times }, timesAt = { ...remote.timesAt };
  const now = Date.now();
  for (const [k, l] of Object.entries(local.times)) {
    const r = remote.times[k], la = local.timesAt[k] ?? 0, ra = remote.timesAt[k] ?? 0;
    if (!r || la > ra) { times[k] = l; timesAt[k] = la; }
    else if (la === 0 && ra === 0 && JSON.stringify(l) !== JSON.stringify(r)) { times[k] = [...r, ...l].slice(-KEEP); timesAt[k] = now; }
  }
  return { times, timesAt };
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
