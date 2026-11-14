// Your own algorithms, added to a case on top of the listed ones: case id → algorithms, in the
// order added. Each is checked on a cube model before it's added (algCheck.ts). Stored per device
// and synced with the other algorithm settings (algPrefs.ts).
const KEY = "cubeTimer.algCustom";

export type CustomAlgs = Record<string, string[]>;

export const MAX_CUSTOM_PER_CASE = 10;
export const MAX_ALG_LENGTH = 200;

// Keeps only well-formed entries (from storage or the cloud).
export function readCustom(v: unknown): CustomAlgs {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: CustomAlgs = {};
  for (const [id, list] of Object.entries(v)) {
    if (!Array.isArray(list)) continue;
    const algs = list.filter((a): a is string => typeof a === "string" && a.length > 0 && a.length <= MAX_ALG_LENGTH)
      .slice(0, MAX_CUSTOM_PER_CASE);
    if (algs.length) out[id] = algs;
  }
  return out;
}

export function loadCustom(): CustomAlgs {
  try { return readCustom(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { return {}; }
}

export function saveCustom(c: CustomAlgs) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
