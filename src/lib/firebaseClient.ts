import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { firebaseConfig } from "./firebase";

// The Firebase SDK, loaded on demand by loadFirebase() (lib/firebase.ts) so the timer doesn't wait
// for it. Only loaded when firebaseEnabled is true.
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Persistent cache lets solves made offline queue up and sync when the phone reconnects.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export {
  GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut,
} from "firebase/auth";
export {
  collection, doc, onSnapshot, onSnapshotsInSync, serverTimestamp, writeBatch,
} from "firebase/firestore";
