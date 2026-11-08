import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { mergeSessions, type Session } from "../lib/sessions";
import { pickAlgPrefs, readCloudAlgPrefs, type AlgPrefs } from "../lib/algPrefs";

// One Firestore document per user: users/{uid} = { sessions, inspection, algs, updatedAt }.
// Signed in, the cloud copy is the source of truth and localStorage mirrors it.
// On sign-in, anything local that's newer than this device's last sync is merged in: solves made
// while signed out are kept, but solves and sessions deleted on another device don't come back.
// Algorithm settings (algs: statuses, main algorithms, cross color) sync as one block: the most
// recently changed copy wins (lib/algPrefs.ts).

export type SyncStatus = "off" | "loading" | "synced" | "saving" | "offline" | "error";
export const SYNC_LABEL: Record<SyncStatus, string> = {
  off: "", loading: "Syncing…", synced: "Synced", saving: "Saving…", offline: "Offline · will sync", error: "Sync failed",
};

interface CloudDoc { sessions: Session[]; inspection: boolean; algs: AlgPrefs }

// JSON with object keys sorted, so the same data always compares equal whatever order Firestore
// returns map fields in.
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => val && typeof val === "object" && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
    : val);
}

const syncKey = (uid: string) => `cubeTimer.syncedAt.${uid}`;
function readSyncedAt(uid: string) {
  try { return Number(localStorage.getItem(syncKey(uid))) || 0; } catch { return 0; }
}
function writeSyncedAt(uid: string) {
  try { localStorage.setItem(syncKey(uid), String(Date.now())); } catch { /* ignore */ }
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
  const local = useRef({ sessions, inspection, algPrefs });
  const ready = useRef(false);
  const lastWritten = useRef("");
  useEffect(() => { local.current = { sessions, inspection, algPrefs }; });

  // Subscribe to the user's document and merge on first load.
  useEffect(() => {
    ready.current = false;
    if (!user || !db) { setStatus("off"); return; }
    setStatus("loading");
    const ref = doc(db, "users", user.uid);
    const uid = user.uid;

    const write = (data: CloudDoc) => {
      lastWritten.current = stable(data);
      setDoc(ref, { ...data, updatedAt: serverTimestamp() }).catch(() => setStatus("error"));
    };

    const unsub = onSnapshot(ref, { includeMetadataChanges: true }, snap => {
      const { fromCache, hasPendingWrites } = snap.metadata;
      const remote = snap.exists() ? (snap.data() as CloudDoc) : null;
      const remoteSessions = Array.isArray(remote?.sessions) ? remote.sessions : null;
      const remoteAlgs = readCloudAlgPrefs(remote?.algs);

      if (!ready.current) {
        // A cache miss while offline isn't proof the cloud is empty; wait for the server.
        if (fromCache && !remote) { setStatus("offline"); return; }
        const merged: CloudDoc = {
          sessions: remoteSessions ? mergeSessions(remoteSessions, local.current.sessions, readSyncedAt(uid)) : local.current.sessions,
          inspection: remote ? !!remote.inspection : local.current.inspection,
          algs: pickAlgPrefs(local.current.algPrefs, remoteAlgs),
        };
        ready.current = true;
        setSessions(merged.sessions);
        setInspection(merged.inspection);
        setAlgPrefs(merged.algs);
        const json = stable(merged);
        const remoteJson = remoteSessions && remoteAlgs
          ? stable({ sessions: remoteSessions, inspection: !!remote?.inspection, algs: remoteAlgs }) : "";
        if (json !== remoteJson) write(merged);
        else lastWritten.current = json;
      } else if (remoteSessions && !hasPendingWrites) {
        // Change from another device.
        const data: CloudDoc = {
          sessions: remoteSessions, inspection: !!remote?.inspection,
          algs: remoteAlgs ?? local.current.algPrefs,
        };
        const json = stable(data);
        if (json !== lastWritten.current) {
          lastWritten.current = json;
          setSessions(data.sessions);
          setInspection(data.inspection);
          setAlgPrefs(data.algs);
        }
      }

      if (hasPendingWrites) setStatus(navigator.onLine ? "saving" : "offline");
      else if (fromCache) setStatus("offline");
      else { setStatus("synced"); writeSyncedAt(uid); }
    }, () => setStatus("error"));

    return () => { unsub(); ready.current = false; };
  }, [user, setSessions, setInspection, setAlgPrefs]);

  // Push local changes (solves, penalties, sessions, settings, algorithm progress) after a short pause.
  useEffect(() => {
    if (!user || !db || !ready.current) return;
    const data: CloudDoc = { sessions, inspection, algs: algPrefs };
    const json = stable(data);
    if (json === lastWritten.current) return;
    const ref = doc(db, "users", user.uid);
    const t = setTimeout(() => {
      lastWritten.current = json;
      setDoc(ref, { ...data, updatedAt: serverTimestamp() }).catch(() => setStatus("error"));
    }, 400);
    return () => clearTimeout(t);
  }, [user, sessions, inspection, algPrefs]);

  return status;
}
