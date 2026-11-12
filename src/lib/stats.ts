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

// The value of `fn` over every run of n solves in a row: out[i] is for solves i−n+1 … i (null
// before there are n). Gives exactly what fn(solves.slice(i − n + 1, i + 1), n) would, but for
// avgOf it keeps the window sorted as it slides instead of sorting each window from scratch.
export function rolling(solves: Solve[], fn: Stat, n: number): (number | null)[] {
  const out: (number | null)[] = new Array(solves.length).fill(null);
  if (n < 1 || solves.length < n) return out;
  if (fn === avgOf) {
    const trim = n <= 12 ? 1 : Math.ceil(n * 0.05), m = n - 2 * trim;
    const vals = solves.map(eff);
    const w: number[] = [];
    // First position in w holding a value ≥ v.
    const at = (v: number) => { let lo = 0, hi = w.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (w[mid] < v) lo = mid + 1; else hi = mid; } return lo; };
    for (let i = 0; i < vals.length; i++) {
      w.splice(at(vals[i]), 0, vals[i]);
      if (i >= n) w.splice(at(vals[i - n]), 1);
      if (i < n - 1) continue;
      // Sorted, so the middle has a DNF exactly when its slowest time is one.
      if (!isFinite(w[n - trim - 1])) { out[i] = Infinity; continue; }
      let sum = 0;
      for (let k = trim; k < n - trim; k++) sum += w[k];
      out[i] = sum / m;
    }
    return out;
  }
  if (fn === meanOf) {
    const vals = solves.map(eff);
    for (let i = n - 1; i < vals.length; i++) {
      let sum = 0, dnf = false;
      for (let k = i - n + 1; k <= i; k++) { if (!isFinite(vals[k])) { dnf = true; break; } sum += vals[k]; }
      out[i] = dnf ? Infinity : sum / n;
    }
    return out;
  }
  for (let i = n - 1; i < solves.length; i++) out[i] = fn(solves.slice(i - n + 1, i + 1), n);
  return out;
}

const minOf = (vals: (number | null)[]) => {
  let best: number | null = null;
  for (const v of vals) if (v != null && (best == null || v < best)) best = v;
  return best;
};

export function bestRolling(solves: Solve[], fn: Stat, n: number): number | null {
  return minOf(rolling(solves, fn, n));
}

// Best single (fastest effective time), or null with no solves.
export function bestSingle(solves: Solve[]): number | null {
  let best: number | null = null;
  for (const s of solves) { const v = eff(s); if (best == null || v < best) best = v; }
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
    const all = rolling(solves, fn, n);
    const best = minOf(all);
    if (best == null) return null;
    start = all.indexOf(best) - n + 1;
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
  const prevBest = bestSingle(prev);
  if (prevBest != null && isFinite(prevBest) && t < prevBest) out.push("Single");
  const next = [...prev, solve];
  for (const [kind, n] of [["Ao5", 5], ["Ao12", 12]] as const) {
    const now = avgOf(next, n), before = bestRolling(prev, avgOf, n);
    if (now != null && isFinite(now) && before != null && now < before) out.push(kind);
  }
  return out;
}
