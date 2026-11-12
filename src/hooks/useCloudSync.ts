import { useEffect, useRef, useState } from "react";
import {
  collection, doc, onSnapshot, onSnapshotsInSync, serverTimestamp, writeBatch,
  type DocumentSnapshot, type Firestore, type QuerySnapshot,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { mergeSessions, type Session } from "../lib/sessions";
import { pickAlgPrefs, type AlgPrefs } from "../lib/algPrefs";
import { diffDocs, fromDocs, stable, toBatches, toDocs, type SyncState } from "../lib/cloudDocs";

// Signed in, the cloud copy is the source of truth and localStorage mirrors it. The data is split
// over several documents (lib/cloudDocs.ts) so no single document hits Firestore's 1 MiB limit,
// and a new solve only rewrites the session's last chunk of solves.
// On sign-in, anything local that's newer than this device's last sync is merged in: solves made
// while signed out are kept, but solves and sessions deleted on another device don't come back.
// Algorithm settings (algs: statuses, main algorithms, cross color) sync as one block: the most
// recently changed copy wins (lib/algPrefs.ts).

export type SyncStatus = "off" | "loading" | "synced" | "saving" | "offline" | "error";
export const SYNC_LABEL: Record<SyncStatus, string> = {
  off: "", loading: "Syncing…", synced: "Synced", saving: "Saving…", offline: "Offline · will sync", error: "Sync failed",
};

const syncKey = (uid: string) => `cubeTimer.syncedAt.${uid}`;
function readSyncedAt(uid: string) {
  try { return Number(localStorage.getItem(syncKey(uid))) || 0; } catch { return 0; }
}
function writeSyncedAt(uid: string) {
  try { localStorage.setItem(syncKey(uid), String(Date.now())); } catch { /* ignore */ }
}

// A document's data as compared and stored in `known` (the server timestamp isn't data).
function plain(data: Record<string, unknown>) {
  const rest = { ...data };
  delete rest.updatedAt;
  return rest;
}

interface Options {
  user: User | null;
  sessions: Session[];
  inspection: boolean;
  algPrefs: AlgPrefs;
  setSessions: (s: Session[]) => void;
  setInspection: (v: boolean) => void;
  setAlgPrefs: (p: AlgPrefs) => void;
}

export function useCloudSync({ user, sessions, inspection, algPrefs, setSessions, setInspection, setAlgPrefs }: Options): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>("off");
  const local = useRef<SyncState>({ sessions, inspection, algs: algPrefs });
  const ready = useRef(false);
  // stable() of the state last written or received, so a change isn't echoed back.
  const lastWritten = useRef("");
  // What Firestore holds, path (relative to users/{uid}) → stable JSON; writes are diffed against it.
  const known = useRef(new Map<string, string>());
  useEffect(() => { local.current = { sessions, inspection, algs: algPrefs }; });

  // Write whatever differs between `state` and what Firestore holds.
  const push = useRef<(state: SyncState) => void>(() => {});

  useEffect(() => {
    ready.current = false;
    known.current = new Map();
    if (!user || !db) { setStatus("off"); return; }
    setStatus("loading");
    const fs: Firestore = db;
    const uid = user.uid;
    const ref = (path: string) => (path === "user" ? doc(fs, "users", uid) : doc(fs, "users", uid, ...path.split("/")));

    push.current = (state: SyncState) => {
      lastWritten.current = stable(state);
      const { sets, deletes } = diffDocs(known.current, toDocs(state));
      if (!sets.length && !deletes.length) return;
      for (const [p, d] of sets) known.current.set(p, stable(d));
      for (const p of deletes) known.current.delete(p);
      (async () => {
        for (const ops of toBatches(sets, deletes)) {
          const batch = writeBatch(fs);
          for (const op of ops) {
            if (!op.data) batch.delete(ref(op.path));
            else batch.set(ref(op.path), op.path === "user" ? { ...op.data, updatedAt: serverTimestamp() } : op.data);
          }
          await batch.commit();
        }
      })().catch(() => setStatus("error"));
    };

    let userSnap: DocumentSnapshot | null = null;
    let sessionSnap: QuerySnapshot | null = null;
    let chunkSnap: QuerySnapshot | null = null;

    // Runs once all three listeners have caught up with the same writes.
    const update = () => {
      if (!userSnap || !sessionSnap || !chunkSnap) return;
      const snaps = [userSnap, sessionSnap, chunkSnap];
      const fromCache = snaps.some(s => s.metadata.fromCache);
      const pending = snaps.some(s => s.metadata.hasPendingWrites);

      const userData = userSnap.exists() ? userSnap.data() : null;
      const sessionDocs = sessionSnap.docs.map(d => [d.id, d.data()] as [string, Record<string, unknown>]);
      const chunkDocs = chunkSnap.docs.map(d => d.data());
      const remote = fromDocs(userData, sessionDocs, chunkDocs);

      // What the server holds now (including this device's not-yet-acknowledged writes).
      const next = new Map<string, string>();
      if (userData) next.set("user", stable(plain(userData)));
      for (const [id, d] of sessionDocs) next.set(`sessions/${id}`, stable(d));
      for (const d of chunkSnap.docs) next.set(`chunks/${d.id}`, stable(d.data()));
      known.current = next;

      if (!ready.current) {
        // A cache miss while offline isn't proof the cloud is empty; wait for the server.
        if (fromCache && !remote.exists) { setStatus("offline"); return; }
        // Another device is midway through writing; wait for the rest.
        if (!remote.complete) return;
        const merged: SyncState = {
          sessions: remote.sessions ? mergeSessions(remote.sessions, local.current.sessions, readSyncedAt(uid)) : local.current.sessions,
          inspection: remote.exists ? remote.inspection : local.current.inspection,
          algs: pickAlgPrefs(local.current.algs, remote.algs),
        };
        ready.current = true;
        setSessions(merged.sessions);
        setInspection(merged.inspection);
        setAlgPrefs(merged.algs);
        // Also moves an old single-document account into the split layout.
        push.current(merged);
      } else if (!pending && remote.complete && remote.sessions) {
        // A change from another device.
        const data: SyncState = { sessions: remote.sessions, inspection: remote.inspection, algs: remote.algs ?? local.current.algs };
        const json = stable(data);
        if (json !== lastWritten.current) {
          lastWritten.current = json;
          setSessions(data.sessions);
          setInspection(data.inspection);
          setAlgPrefs(data.algs);
        }
        // An older copy of the app rewrote the user document in the old layout: put it right.
        if (remote.legacy) push.current(data);
      }

      if (pending) setStatus(navigator.onLine ? "saving" : "offline");
      else if (fromCache) setStatus("offline");
      else { setStatus("synced"); writeSyncedAt(uid); }
    };

    const opts = { includeMetadataChanges: true };
    const fail = () => setStatus("error");
    const unsubs = [
      onSnapshot(doc(fs, "users", uid), opts, s => { userSnap = s; }, fail),
      onSnapshot(collection(fs, "users", uid, "sessions"), opts, s => { sessionSnap = s; }, fail),
      onSnapshot(collection(fs, "users", uid, "chunks"), opts, s => { chunkSnap = s; }, fail),
      onSnapshotsInSync(fs, update),
    ];

    return () => { unsubs.forEach(u => u()); ready.current = false; push.current = () => {}; };
  }, [user, setSessions, setInspection, setAlgPrefs]);

  // Push local changes (solves, penalties, sessions, settings, algorithm progress) after a short pause.
  useEffect(() => {
    if (!user || !db || !ready.current) return;
    const state: SyncState = { sessions, inspection, algs: algPrefs };
    // Compared inside the timeout, so serialising a big history doesn't hold up the screen as a
    // solve finishes.
    const t = setTimeout(() => { if (stable(state) !== lastWritten.current) push.current(state); }, 400);
    return () => clearTimeout(t);
  }, [user, sessions, inspection, algPrefs]);

  return status;
}
