// Tests for lib/storage.ts: loading, moving older localStorage data into IndexedDB, saving, the
// fallbacks when IndexedDB is missing or stuck, the warning when a save fails, and wiping the device.
// Run: npm test
//
// Each test gets an empty IndexedDB (fake-indexeddb) and localStorage, and a fresh copy of the
// module, as if the page had just been opened. "Reopening" the app is another fresh copy.
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Saved } from "./storage";
import type { Session } from "./sessions";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const solve = (i: number) => ({ t: 10000 + i, pen: 0 as const, scr: "R U R' U'", at: 1794502658041 + i });
const session = (id: string, n: number): Session =>
  ({ id, name: `Session ${id}`, createdAt: 1794495902355, solves: Array.from({ length: n }, (_, i) => solve(i)), puzzle: "333" });
const data = (n = 3): Saved => ({ sessions: [session("a", n), session("b", 1)], currentId: "b", inspection: true });

// Opens the app: a fresh copy of the module, loaded the way main.tsx does.
async function open() {
  vi.resetModules();
  const storage = await import("./storage");
  await storage.loadStored();
  return storage;
}

// Saves wait for idle time (a 100 ms timer without requestIdleCallback), then write.
const afterSave = () => new Promise(r => setTimeout(r, 200));

// What's in IndexedDB, read directly.
function readDb(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cube-timer", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction("kv").objectStore("kv").get("solves");
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
  });
}

function writeDb(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("cube-timer", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, "solves");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loading", () => {
  it("starts a new device with one empty session", async () => {
    const { load } = await open();
    const saved = load();
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]).toMatchObject({ name: "Session 1", solves: [] });
    expect(saved.currentId).toBe(saved.sessions[0].id);
    expect(saved.inspection).toBe(false);
    expect(await readDb()).toBeUndefined(); // nothing written until there's something to save
  });

  it("reads what's in IndexedDB", async () => {
    await writeDb(data(5));
    const { load } = await open();
    expect(load()).toEqual(data(5));
  });

  it("prefers IndexedDB over anything left in localStorage", async () => {
    await writeDb(data(5));
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(1)));
    const { load } = await open();
    expect(load().sessions[0].solves).toHaveLength(5);
  });

  it("falls back to the first session when the current one is missing", async () => {
    await writeDb({ ...data(), currentId: "gone" });
    const { load } = await open();
    expect(load().currentId).toBe("a");
  });

  it("ignores IndexedDB data with no sessions", async () => {
    await writeDb({ sessions: [], currentId: "a", inspection: false });
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(2)));
    const { load } = await open();
    expect(load()).toEqual(data(2));
  });
});

describe("moving data over from localStorage", () => {
  it("copies sessions into IndexedDB and then removes them from localStorage", async () => {
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(4)));
    const { load } = await open();
    expect(load()).toEqual(data(4));
    expect(await readDb()).toEqual(data(4));
    expect(localStorage.getItem("cubeTimer.v2")).toBeNull();
  });

  it("turns the oldest format (one list of solves) into a first session", async () => {
    localStorage.setItem("cubeTimer.v1", JSON.stringify({ solves: [solve(0), solve(1)], inspection: true }));
    const { load } = await open();
    const saved = load();
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]).toMatchObject({ name: "Session 1", solves: [solve(0), solve(1)] });
    expect(saved.inspection).toBe(true);
    expect(await readDb()).toEqual(saved);
    expect(localStorage.getItem("cubeTimer.v1")).toBeNull();
  });

  it("keeps a large history (60,000 solves)", async () => {
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(60000)));
    await open();
    const stored = await readDb() as Saved;
    expect(stored.sessions[0].solves).toHaveLength(60000);
    expect(stored.sessions[0].solves[59999]).toEqual(solve(59999));
  });

  it("leaves localStorage alone if the copy can't be written", async () => {
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(4)));
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { load } = await open();
    expect(load()).toEqual(data(4));
    expect(localStorage.getItem("cubeTimer.v2")).not.toBeNull();
  });
});

describe("saving", () => {
  it("writes to IndexedDB, and the app reopens with it", async () => {
    const { save } = await open();
    save(data(7));
    await afterSave();
    expect(await readDb()).toEqual(data(7));
    const { load } = await open();
    expect(load()).toEqual(data(7));
  });

  it("folds quick saves into one write of the latest", async () => {
    const { save } = await open();
    const put = vi.spyOn(IDBObjectStore.prototype, "put");
    save(data(1));
    save(data(2));
    save(data(3));
    await afterSave();
    expect(put).toHaveBeenCalledTimes(1);
    expect(await readDb()).toEqual(data(3));
  });

  it("warns when a save fails, and clears the warning once one works", async () => {
    const storage = await open();
    const listener = vi.fn();
    storage.saveFailure.subscribe(listener);
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    storage.save(data(1));
    await vi.waitFor(() => expect(storage.saveFailure.get()).toBe(true));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();

    put.mockRestore();
    storage.save(data(2));
    await vi.waitFor(() => expect(storage.saveFailure.get()).toBe(false));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(await readDb()).toEqual(data(2));
  });
});

describe("without IndexedDB", () => {
  it("loads and saves with localStorage when IndexedDB isn't there", async () => {
    vi.stubGlobal("indexedDB", undefined);
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(2)));
    const { load, save } = await open();
    expect(load()).toEqual(data(2));
    save(data(3));
    await afterSave();
    expect(JSON.parse(localStorage.getItem("cubeTimer.v2")!)).toEqual(data(3));
  });

  it("gives up on IndexedDB if opening it hangs, after 3 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubGlobal("indexedDB", { open: () => ({}) }); // never answers
    localStorage.setItem("cubeTimer.v2", JSON.stringify(data(2)));
    vi.resetModules();
    const storage = await import("./storage");
    let done = false;
    const loading = storage.loadStored().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(2900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await loading;
    expect(storage.load()).toEqual(data(2));
  });

  it("warns when localStorage is full", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const storage = await open();
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    storage.save(data(1));
    await afterSave();
    expect(storage.saveFailure.get()).toBe(true);
  });
});

describe("wipeDevice", () => {
  it("removes this person's data and stops further saves", async () => {
    await writeDb(data(3));
    localStorage.setItem("cubeTimer.trainer", "{}");
    localStorage.setItem("cubeTimer.syncedAt.me", "1");
    localStorage.setItem("cubeTimer.theme", "dark"); // a device setting, not personal
    const { save, wipeDevice } = await open();
    save(data(9)); // pending when the wipe starts
    await wipeDevice();
    save(data(10));
    await afterSave();
    expect(await readDb()).toBeUndefined();
    expect(localStorage.getItem("cubeTimer.trainer")).toBeNull();
    expect(localStorage.getItem("cubeTimer.syncedAt.me")).toBeNull();
    expect(localStorage.getItem("cubeTimer.theme")).toBe("dark");
  });
});
