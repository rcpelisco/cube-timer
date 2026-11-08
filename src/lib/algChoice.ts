import type { AlgCase } from "./algs";

// Which algorithm you use for each case ("main"). Defaults to the case's standard (first) one.
// Stored per device as case id → algorithm, so it survives the list being reordered.
const KEY = "cubeTimer.algChoice";

export type AlgChoices = Record<string, string>;

export function loadChoices(): AlgChoices {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function saveChoices(c: AlgChoices) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function mainAlg(c: AlgCase, choices: AlgChoices): string {
  const picked = choices[c.id];
  return picked && c.algs.includes(picked) ? picked : c.algs[0];
}
