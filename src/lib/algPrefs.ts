import { loadChoices, saveChoices, type AlgChoices } from "./algChoice";
import { loadCustom, readCustom, saveCustom, type CustomAlgs } from "./algCustom";
import { loadStatuses, saveStatuses, type StatusMap } from "./algStatus";
import { CROSS_COLORS, loadCrossColor, saveCrossColor, type CrossColor } from "./crossColor";

// Your algorithm-page settings, kept together so they sync as one: learning statuses, the main
// algorithm per case, your own algorithms, and the cross color. updatedAt (ms) is when they last changed on any
// device; when two devices disagree, the most recent change wins (see pickAlgPrefs).
export interface AlgPrefs { statuses: StatusMap; choices: AlgChoices; custom: CustomAlgs; cross: CrossColor; updatedAt: number }

const AT_KEY = "cubeTimer.algPrefsAt";

export function loadAlgPrefs(): AlgPrefs {
  let updatedAt = 0;
  try { updatedAt = Number(localStorage.getItem(AT_KEY)) || 0; } catch { /* ignore */ }
  return { statuses: loadStatuses(), choices: loadChoices(), custom: loadCustom(), cross: loadCrossColor(), updatedAt };
}

export function saveAlgPrefs(p: AlgPrefs) {
  saveStatuses(p.statuses);
  saveChoices(p.choices);
  saveCustom(p.custom);
  saveCrossColor(p.cross);
  try { localStorage.setItem(AT_KEY, String(p.updatedAt)); } catch { /* ignore */ }
}

// Accepts a stored copy (from the cloud, or stashed on this device) only if it has the right shape.
export function readCloudAlgPrefs(v: unknown): AlgPrefs | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<AlgPrefs>;
  if (!o.statuses || typeof o.statuses !== "object" || !o.choices || typeof o.choices !== "object") return null;
  const cross = CROSS_COLORS.some(c => c.id === o.cross) ? (o.cross as CrossColor) : "white";
  // custom is missing from copies saved before your own algorithms existed.
  return { statuses: o.statuses, choices: o.choices, custom: readCustom(o.custom), cross, updatedAt: Number(o.updatedAt) || 0 };
}

// Which copy to keep when this device and the cloud differ: the most recently changed one.
// An untouched device (updatedAt 0) always takes the cloud's.
export function pickAlgPrefs(local: AlgPrefs, remote: AlgPrefs | null): AlgPrefs {
  if (!remote) return local;
  return local.updatedAt > remote.updatedAt ? local : remote;
}
