// Config comes from .env.local (see .env.example). Without it the app runs local-only and hides sign-in.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

// App Check's reCAPTCHA Enterprise site key (public, like the config above); without it App Check is off.
export const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY || "";

// The Firebase SDK is about a third of the app's code, so it isn't part of the first load: it's
// fetched when you sign in, or straight after start-up if you may be signed in
// (hooks/useAuth.ts). Loaded once; later calls get the same module.
export type FirebaseClient = typeof import("./firebaseClient");
let loading: Promise<FirebaseClient> | null = null;
export function loadFirebase(): Promise<FirebaseClient> {
  if (!firebaseEnabled) return Promise.reject(new Error("Firebase isn't configured"));
  loading ??= import("./firebaseClient");
  // A failed load (say, offline on first visit) can be tried again later.
  loading.catch(() => { loading = null; });
  return loading;
}

// Whether this device may be signed in, so sync can start without waiting for a click: "1" signed
// in, "0" signed out. Not yet known (first start, or the first since this was added) counts as
// maybe, so someone already signed in stays signed in; after that, signed-out starts skip Firebase.
const HINT = "cubeTimer.signedIn";
export const mayBeSignedIn = () => { try { return localStorage.getItem(HINT) !== "0"; } catch { return true; } };
export const rememberSignedIn = (on: boolean) => {
  try { localStorage.setItem(HINT, on ? "1" : "0"); } catch { /* ignore */ }
};
