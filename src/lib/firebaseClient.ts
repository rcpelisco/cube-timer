import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { appCheckSiteKey, firebaseConfig } from "./firebase";

// The Firebase SDK, loaded on demand by loadFirebase() (lib/firebase.ts) so the timer doesn't wait
// for it. Only loaded when firebaseEnabled is true.
const app = initializeApp(firebaseConfig);

// App Check: every request carries a reCAPTCHA-backed token proving it came from this site, so
// scripts using the (public) config can't write to Firestore once enforcement is on in the
// console. Set up before the other services so their first requests carry a token. On the dev
// server it uses a debug token instead (registered in the console), since reCAPTCHA won't vouch
// for localhost.
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}

export const auth = getAuth(app);
// Persistent cache lets solves made offline queue up and sync when the phone reconnects.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export {
  GoogleAuthProvider, deleteUser, getRedirectResult, onAuthStateChanged, reauthenticateWithPopup, signInWithPopup, signInWithRedirect, signOut,
} from "firebase/auth";
export {
  clearIndexedDbPersistence, collection, doc, getDocsFromServer, onSnapshot, onSnapshotsInSync, serverTimestamp, terminate, writeBatch,
} from "firebase/firestore";
