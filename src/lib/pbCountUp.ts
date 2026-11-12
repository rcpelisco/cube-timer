import { useEffect, useMemo } from "react";
import { avgOf, bestRolling, type Solve } from "./stats";

// The Ao5 count-up only plays for a new PB Ao5, and only the first time each place shows that PB
// (the Solves page's headline card, the averages under the timer). A PB is known by the time of
// the solve that set it; each place keeps the last one it played, per device.

const KEY = "cubeTimer.pbCountUp";

// The PB Ao5 as of the latest solve, or null when the current Ao5 isn't a PB. The very first Ao5
// is always the best so far, so it doesn't count.
export function pbAo5Key(solves: Solve[]): string | null {
  if (solves.length <= 5) return null;
  const cur = avgOf(solves, 5);
  if (cur == null || !isFinite(cur) || cur !== bestRolling(solves, avgOf, 5)) return null;
  return String(solves[solves.length - 1].at);
}

function seen(place: string): string | null {
  try { return (JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string>)[place] ?? null; } catch { return null; }
}
function markSeen(place: string, key: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string>;
    localStorage.setItem(KEY, JSON.stringify({ ...all, [place]: key }));
  } catch { /* ignore */ }
}

// True while this place should play the count-up for the current PB. It's marked as played once
// the count has had time to finish, so leaving straight away (or a dev double-mount) doesn't use it up.
export function useFirstPb(place: string, key: string | null): boolean {
  const fresh = useMemo(() => key != null && seen(place) !== key, [place, key]);
  useEffect(() => {
    if (!fresh || key == null) return;
    const id = setTimeout(() => markSeen(place, key), 1000);
    return () => clearTimeout(id);
  }, [fresh, place, key]);
  return fresh;
}
