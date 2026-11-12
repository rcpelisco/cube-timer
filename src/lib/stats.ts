// Time math following WCA conventions: truncate to hundredths, trimmed averages.

export const DNF = -1;
export type Penalty = 0 | 2 | typeof DNF;
// note: what you wrote about the solve; left out (not empty) when there is none, since Firestore
// rejects undefined fields.
export interface Solve { t: number; pen: Penalty; scr: string; at: number; note?: string }

export const MAX_NOTE = 500;

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

// The solves behind an average: the latest n ("current") or the window that gave the best value.
// `trimmed` holds the positions (within `solves`) that a trimmed average leaves out: the fastest
// and slowest, 1 each up to Ao12 and 5% each above, as in avgOf. Means (Mo3) trim nothing.
export interface AverageWindow { start: number; solves: Solve[]; value: number; trimmed: Set<number> }

export function averageWindow(solves: Solve[], fn: Stat, n: number, which: "current" | "best"): AverageWindow | null {
  let start = solves.length - n;
  if (start < 0) return null;
  if (which === "best") {
    const best = bestRolling(solves, fn, n);
    if (best == null) return null;
    for (let i = 0; i + n <= solves.length; i++) {
      if (fn(solves.slice(i, i + n), n) === best) { start = i; break; }
    }
  }
  const win = solves.slice(start, start + n);
  const value = fn(win, n);
  if (value == null) return null;
  const trimmed = new Set<number>();
  if (fn === avgOf) {
    const trim = n <= 12 ? 1 : Math.ceil(n * 0.05);
    const order = win.map((_, i) => i).sort((a, b) => eff(win[a]) - eff(win[b]) || a - b);
    order.slice(0, trim).forEach(i => trimmed.add(i));
    order.slice(n - trim).forEach(i => trimmed.add(i));
  }
  return { start, solves: win, value, trimmed };
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
