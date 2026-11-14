import { newSession, type Session } from "./sessions";
import { isPersonalKey } from "./deviceOwner";

// Sessions and solves on this device. They're kept in IndexedDB, which has room for any history
// (localStorage stops at about 5 MB, some tens of thousands of solves). localStorage is only used
// where IndexedDB isn't available, and is where older versions of the app kept them: they're moved
// over once, then removed from localStorage.
const KEY = "cubeTimer.v2";
const LEGACY_KEY = "cubeTimer.v1"; // single list of solves, before sessions existed

export interface Saved { sessions: Session[]; currentId: string; inspection: boolean }

const DB_NAME = "cube-timer", STORE = "kv", DB_KEY = "solves";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    // Resolved once the transaction is committed, not just when the request succeeds.
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

let db: IDBDatabase | null = null;
let loaded: Saved | null = null;

function valid(raw: unknown): Saved | null {
  const r = raw as Partial<Saved> | null;
  if (!r || !Array.isArray(r.sessions) || !r.sessions.length) return null;
  const currentId = r.sessions.some(s => s.id === r.currentId) ? r.currentId! : r.sessions[0].id;
  return { sessions: r.sessions, currentId, inspection: !!r.inspection };
}

function fromLocalStorage(): Saved | null {
  try {
    const saved = valid(JSON.parse(localStorage.getItem(KEY) || "null"));
    if (saved) return saved;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
    if (legacy) {
      const first = newSession("Session 1", { solves: Array.isArray(legacy.solves) ? legacy.solves : [] });
      return { sessions: [first], currentId: first.id, inspection: !!legacy.inspection };
    }
  } catch { /* storage unavailable */ }
  return null;
}

// Reads the saved data, before the app first renders (main.tsx). Anything still in localStorage
// is copied into IndexedDB, and removed from localStorage only once that copy is committed.
// Gives up on IndexedDB if opening it hangs (it has in some Safari versions), so the app still starts.
const OPEN_TIMEOUT_MS = 3000;
export async function loadStored(): Promise<void> {
  try {
    db = await Promise.race([
      openDb(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("IndexedDB took too long")), OPEN_TIMEOUT_MS)),
    ]);
    const stored = valid(await request<unknown>(db, "readonly", s => s.get(DB_KEY)));
    if (stored) { loaded = stored; return; }
    const old = fromLocalStorage();
    if (old) {
      await request(db, "readwrite", s => s.put(old, DB_KEY));
      try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
      loaded = old;
    }
  } catch {
    db = null; // no IndexedDB (or it failed): keep using localStorage
    loaded = fromLocalStorage();
  }
}

export function load(): Saved {
  if (loaded) return loaded;
  const first = newSession("Session 1");
  return { sessions: [first], currentId: first.id, inspection: false };
}

// Whether the last save failed (storage full, or blocked). The app shows a warning while it is.
let failed = false;
const listeners = new Set<() => void>();
const setFailed = (v: boolean) => { if (v !== failed) { failed = v; listeners.forEach(fn => fn()); } };
export const saveFailure = {
  get: () => failed,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

// Writing the whole history takes a while once it's big, so it waits until the browser is idle
// (at most half a second) rather than holding up the frame that shows a finished time. Changes in
// the meantime are folded into one write, and a pending write starts at once when the app is
// hidden or closed.
let pending: Saved | null = null;
let scheduled = false;
let wiped = false;
let askedPersist = false;

function flush() {
  scheduled = false;
  if (!pending || wiped) return;
  const data = pending;
  pending = null;
  if (db) {
    request(db, "readwrite", s => s.put(data, DB_KEY)).then(
      () => { setFailed(false); persist(); },
      e => { console.error("Couldn't save solves", e); setFailed(true); },
    );
    return;
  }
  try { localStorage.setItem(KEY, JSON.stringify(data)); setFailed(false); }
  catch (e) { console.error("Couldn't save solves", e); setFailed(true); }
}

// Asks the browser to keep this site's storage when space runs low, instead of clearing it.
function persist() {
  if (askedPersist) return;
  askedPersist = true;
  navigator.storage?.persist?.().catch(() => { /* not supported */ });
}

export function save(data: Saved) {
  if (wiped) return;
  pending = data;
  if (scheduled) return;
  scheduled = true;
  if (typeof requestIdleCallback === "function") requestIdleCallback(flush, { timeout: 500 });
  else setTimeout(flush, 100);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

// Removes this person's data from the device (see isPersonalKey) and stops any further saves, so
// nothing is written back before the page reloads.
export async function wipeDevice() {
  wiped = true;
  pending = null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isPersonalKey(k)) keys.push(k); }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* storage unavailable */ }
  if (db) {
    try { await request(db, "readwrite", s => s.delete(DB_KEY)); } catch { /* ignore */ }
  }
}
