import type { AlgCase } from "./algs";
import type { CustomAlgs } from "./algCustom";

// Which algorithm you use for each case ("main"). Defaults to the case's standard (first) one.
// Stored per device as case id → algorithm, so it survives the list being reordered.
const KEY = "cubeTimer.algChoice";

export type AlgChoices = Record<string, string>;
// What decides a case's main algorithm: your pick, and your own algorithms it may be one of.
export interface AlgPicks { choices: AlgChoices; custom?: CustomAlgs }

export function loadChoices(): AlgChoices {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

export function saveChoices(c: AlgChoices) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

// The listed algorithms for a case, then your own.
export const algsFor = (c: AlgCase, custom: CustomAlgs = {}) => [...c.algs, ...(custom[c.id] ?? [])];

export function mainAlg(c: AlgCase, { choices, custom }: AlgPicks): string {
  const picked = choices[c.id];
  return picked && algsFor(c, custom).includes(picked) ? picked : c.algs[0];
}
