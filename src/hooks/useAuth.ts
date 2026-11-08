import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "../lib/firebase";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Popups are unreliable in an iOS home-screen app, so it uses the redirect flow there.
const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const IGNORED = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

function message(e: unknown): string | null {
  const code = e instanceof FirebaseError ? e.code : "";
  if (IGNORED.has(code)) return null;
  if (code === "auth/unauthorized-domain") return "This site isn't an authorized domain in Firebase Authentication.";
  if (code === "auth/network-request-failed") return "No connection. Try again when you're online.";
  if (code === "auth/operation-not-allowed") return "Google sign-in isn't enabled in the Firebase project.";
  return "Sign-in didn't work. Try again.";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).catch(e => setError(message(e)));
    return onAuthStateChanged(auth, u => { setUser(u); if (u) setError(null); });
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) return;
    setError(null);
    try {
      if (isStandalone()) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
    } catch (e) {
      if (e instanceof FirebaseError && e.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider).catch(err => setError(message(err)));
      } else setError(message(e));
    }
  }, []);

  const signOutUser = useCallback(() => { if (auth) signOut(auth); }, []);

  return { user, error, signIn, signOut: signOutUser };
}
