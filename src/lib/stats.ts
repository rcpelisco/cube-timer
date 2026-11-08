// Time math following WCA conventions: truncate to hundredths, trimmed averages.

export const DNF = -1;
export type Penalty = 0 | 2 | typeof DNF;
export interface Solve { t: number; pen: Penalty; scr: string; at: number }

export const eff = (s: Solve) => (s.pen === DNF ? Infinity : s.t + (s.pen === 2 ? 2000 : 0));

export function fmt(ms: number | null): string {
  if (ms == null) return "–";
  if (!isFinite(ms)) return "DNF";
  const cs = Math.floor(ms / 10), m = Math.floor(cs / 6000), sec = Math.floor((cs % 6000) / 100), c = cs % 100;
  const tail = `${String(sec).padStart(m ? 2 : 1, "0")}.${String(c).padStart(2, "0")}`;
  return m ? `${m}:${tail}` : tail;
}

export type Stat = (list: Solve[], n: number) => number | null;

export const meanOf: Stat = (list, n) => {
  if (list.length < n) return null;
  const v = list.slice(-n).map(eff);
  return v.some(x => !isFinite(x)) ? Infinity : v.reduce((a, b) => a + b, 0) / n;
};

export const avgOf: Stat = (list, n) => {
  if (list.length < n) return null;
  const v = list.slice(-n).map(eff).sort((a, b) => a - b);
  const trim = n <= 12 ? 1 : Math.ceil(n * 0.05);
  const mid = v.slice(trim, n - trim);
  return mid.some(x => !isFinite(x)) ? Infinity : mid.reduce((a, b) => a + b, 0) / mid.length;
};

export function bestRolling(solves: Solve[], fn: Stat, n: number): number | null {
  let best: number | null = null;
  for (let i = n; i <= solves.length; i++) {
    const v = fn(solves.slice(i - n, i), n);
    if (v != null && (best == null || v < best)) best = v;
  }
  return best;
}

// Which personal bests `solve` sets when it's added after `prev` (best single, Ao5, Ao12 in the
// session). A first-ever time isn't a "new" best, so each needs an earlier result to beat.
export type PbKind = "Single" | "Ao5" | "Ao12";
export function newBests(prev: Solve[], solve: Solve): PbKind[] {
  const out: PbKind[] = [];
  const t = eff(solve);
  if (!isFinite(t)) return out;
  const prevBest = Math.min(...prev.map(eff));
  if (isFinite(prevBest) && t < prevBest) out.push("Single");
  const next = [...prev, solve];
  for (const [kind, n] of [["Ao5", 5], ["Ao12", 12]] as const) {
    const now = avgOf(next, n), before = bestRolling(prev, avgOf, n);
    if (now != null && isFinite(now) && before != null && now < before) out.push(kind);
  }
  return out;
}
