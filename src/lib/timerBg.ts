// Timer background: a photo of your choice behind the timer, with a dim (and optional blur) so the
// time stays readable. Kept on this device only. The image goes in IndexedDB rather than
// localStorage so it never eats into the space your solves are saved in; it's shrunk first.

const DB = "cubeTimer";
const STORE = "files";
const IMAGE_KEY = "timerBg";
const PREFS_KEY = "cubeTimer.timerBg";
const MAX_EDGE = 2048;

export interface TimerBg {
  url: string | null; // object URL of the stored image
  dim: number;        // 0–85, % of the page colour laid over the image
  blur: boolean;
}

interface Prefs { dim: number; blur: boolean }
const DEFAULT_PREFS: Prefs = { dim: 35, blur: false };

const loadPrefs = (): Prefs => {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    return {
      dim: typeof v?.dim === "number" ? Math.min(85, Math.max(0, v.dim)) : DEFAULT_PREFS.dim,
      blur: typeof v?.blur === "boolean" ? v.blur : DEFAULT_PREFS.blur,
    };
  } catch { return DEFAULT_PREFS; }
};

// ---------- IndexedDB ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  } finally { db.close(); }
}

// ---------- Shrinking the photo ----------

async function shrink(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't encode image"))), "image/jpeg", 0.85));
}

// ---------- Store ----------

let state: TimerBg = { url: null, ...loadPrefs() };
const listeners = new Set<() => void>();
const emit = (next: Partial<TimerBg>) => { state = { ...state, ...next }; listeners.forEach(fn => fn()); };
const savePrefs = () => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ dim: state.dim, blur: state.blur })); } catch { /* ignore */ }
};
const setBlob = (blob: Blob | null) => {
  if (state.url) URL.revokeObjectURL(state.url);
  emit({ url: blob ? URL.createObjectURL(blob) : null });
};

// Read the saved image once, at startup.
if (typeof indexedDB !== "undefined") {
  idb<Blob | undefined>("readonly", s => s.get(IMAGE_KEY))
    .then(b => { if (b instanceof Blob && !state.url) setBlob(b); })
    .catch(() => { /* no saved image, or storage blocked */ });
}

export const timerBgStore = {
  get: () => state,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  async setImage(file: File) {
    const blob = await shrink(file);
    await idb("readwrite", s => s.put(blob, IMAGE_KEY));
    setBlob(blob);
  },
  async clear() {
    await idb("readwrite", s => s.delete(IMAGE_KEY)).catch(() => {});
    setBlob(null);
  },
  setDim(dim: number) { emit({ dim }); savePrefs(); },
  setBlur(blur: boolean) { emit({ blur }); savePrefs(); },
};
