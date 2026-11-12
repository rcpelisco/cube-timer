import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseEnabled, loadFirebase, rememberSignedIn, mayBeSignedIn, type FirebaseClient } from "../lib/firebase";

// Popups are unreliable in an iOS home-screen app, so it uses the redirect flow there.
const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const IGNORED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

function message(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string" && IGNORED.has(code)) return null;
  if (code === "auth/unauthorized-domain") return "This site isn't an authorized domain in Firebase Authentication.";
  if (code === "auth/network-request-failed") return "No connection. Try again when you're online.";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't enabled in the Firebase project.";
  return "Sign-in didn't work. Try again.";
}

function provider(fb: FirebaseClient) {
  const p = new fb.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}

// Google sign-in. Firebase is loaded lazily (lib/firebase.ts): right away when this device was
// signed in last time, is coming back from a sign-in redirect, or hasn't checked yet; otherwise on
// the first sign-in.
export function useAuth() {
  const [fb, setFb] = useState<FirebaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => loadFirebase().then(m => { setFb(m); return m; }), []);

  useEffect(() => {
    if (firebaseEnabled && mayBeSignedIn()) load().catch(() => setError("Couldn't reach sign-in. Check your connection."));
  }, [load]);

  useEffect(() => {
    if (!fb) return;
    fb.getRedirectResult(fb.auth).catch(e => setError(message(e)));
    return fb.onAuthStateChanged(fb.auth, u => {
      setUser(u);
      rememberSignedIn(!!u);
      if (u) setError(null);
    });
  }, [fb]);

  const signIn = useCallback(async () => {
    if (!firebaseEnabled) return;
    setError(null);
    let m: FirebaseClient;
    try { m = await load(); } catch { setError("Couldn't reach sign-in. Check your connection."); return; }
    // Coming back from a redirect, Firebase has to be loaded straight away to finish signing in.
    const redirect = () => { rememberSignedIn(true); return m.signInWithRedirect(m.auth, provider(m)); };
    try {
      if (isStandalone()) await redirect();
      else await m.signInWithPopup(m.auth, provider(m));
    } catch (e) {
      // Also covers a browser that blocks the popup because loading Firebase took a moment.
      if ((e as { code?: unknown } | null)?.code === "auth/popup-blocked") await redirect().catch(err => setError(message(err)));
      else setError(message(e));
    }
  }, [load]);

  const signOutUser = useCallback(() => { if (fb) fb.signOut(fb.auth); }, [fb]);

  return { user, error, signIn, signOut: signOutUser };
}
