import type { Session } from "./sessions";
import { readCloudAlgPrefs, type AlgPrefs } from "./algPrefs";
import type { TrainerTimes } from "./trainer";

// Which account the solves on this device belong to, so signing in with a different account
// doesn't upload someone else's history into it (say, on a shared computer). Set each time sync
// finishes merging; cleared with the rest of the device's data (wipeDevice in lib/storage.ts).
const OWNER = "cubeTimer.owner";
const NOBODY = "-"; // the owner's account was deleted: the data is the device user's, for any account
const SYNCED_PREFIX = "cubeTimer.syncedAt.";
export const syncKey = (uid: string) => SYNCED_PREFIX + uid;

export function readSyncedAt(uid: string) {
  try { return Number(localStorage.getItem(syncKey(uid))) || 0; } catch { return 0; }
}

// The device's owner. Devices from before this was recorded fall back to the account that synced
// most recently, which is whose data the device holds.
export function readOwner(): string | null {
  try {
    const owner = localStorage.getItem(OWNER);
    if (owner === NOBODY) return null;
    if (owner) return owner;
    let latest: string | null = null, at = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(SYNCED_PREFIX)) continue;
      const t = Number(localStorage.getItem(k)) || 0;
      if (t > at) { at = t; latest = k.slice(SYNCED_PREFIX.length); }
    }
    return latest;
  } catch { return null; }
}

export function writeOwner(uid: string) {
  try { localStorage.setItem(OWNER, uid); } catch { /* ignore */ }
}

// After the signed-in account is deleted: its bookkeeping goes, and the data left on the device
// counts as no one's, so whoever signs in next on it (likely the same person) gets it merged in.
export function forgetAccount(uid: string) {
  try {
    localStorage.removeItem(syncKey(uid));
    localStorage.removeItem(stashKey(uid));
    localStorage.setItem(OWNER, NOBODY);
  } catch { /* ignore */ }
}

// When another account signs in, whatever the previous owner did since their last sync (solves made
// after signing out, say) is put aside here instead of being lost or uploaded to the wrong account,
// and merged back the next time they sign in on this device.
const stashKey = (uid: string) => `cubeTimer.unsynced.${uid}`;
interface Stash { sessions: Session[]; algs: AlgPrefs | null; trainer: TrainerTimes | null }

export function stashUnsynced(uid: string, sessions: Session[], algs: AlgPrefs, trainer: TrainerTimes) {
  const since = readSyncedAt(uid);
  const newer = sessions.filter(s => s.createdAt > since || s.solves.some(x => x.at > since) || s.rounds?.some(r => r.startAt > since));
  // Trainer times: cases changed since the last sync, and undated ones (from before Trainer times
  // synced, so never uploaded).
  const cases = Object.keys(trainer.times).filter(k => !trainer.timesAt[k] || trainer.timesAt[k] > since);
  const stash: Stash = {
    sessions: newer, algs: algs.updatedAt > since ? algs : null,
    trainer: cases.length
      ? { times: Object.fromEntries(cases.map(k => [k, trainer.times[k]])), timesAt: Object.fromEntries(cases.map(k => [k, trainer.timesAt[k] ?? 0])) }
      : null,
  };
  try {
    if (stash.sessions.length || stash.algs || stash.trainer) localStorage.setItem(stashKey(uid), JSON.stringify(stash));
  } catch { /* ignore: storage full or unavailable */ }
}

// This account's put-aside data, if any, removed from storage as it's taken.
export function takeStash(uid: string): Stash {
  try {
    const raw = JSON.parse(localStorage.getItem(stashKey(uid)) || "null") as Partial<Stash> | null;
    localStorage.removeItem(stashKey(uid));
    if (raw && Array.isArray(raw.sessions)) return { sessions: raw.sessions, algs: readCloudAlgPrefs(raw.algs), trainer: raw.trainer ?? null };
  } catch { /* ignore */ }
  return { sessions: [], algs: null, trainer: null };
}

// Everything on this device that belongs to whoever uses it: solves, sessions, mock rounds,
// algorithm progress, the Trainer (times and its settings) and sync bookkeeping. Look-and-feel settings stay.
export function isPersonalKey(k: string) {
  return k.startsWith("cubeTimer.syncedAt.") || k.startsWith("cubeTimer.unsynced.") || [
    OWNER, "cubeTimer.v2", "cubeTimer.v1", "cubeTimer.mockRound", "cubeTimer.mockRounds",
    "cubeTimer.algStatus", "cubeTimer.algChoice", "cubeTimer.crossColor", "cubeTimer.algPrefsAt",
    "cubeTimer.trainer", "cubeTimer.signedIn",
  ].includes(k);
}
