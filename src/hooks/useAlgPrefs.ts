import { useCallback, useEffect, useState } from "react";
import { loadAlgPrefs, saveAlgPrefs, type AlgPrefs } from "../lib/algPrefs";
import type { AlgCase } from "../lib/algs";
import type { LearnStatus } from "../lib/algStatus";
import type { CrossColor } from "../lib/crossColor";

// Algorithm-page settings for the whole app (so they sync even while the timer page is showing).
// Every change stamps updatedAt; `replace` takes a copy from the cloud as-is.
export function useAlgPrefs() {
  const [prefs, setPrefs] = useState<AlgPrefs>(loadAlgPrefs);
  useEffect(() => saveAlgPrefs(prefs), [prefs]);

  const change = useCallback((fn: (p: AlgPrefs) => Omit<AlgPrefs, "updatedAt">) => {
    setPrefs(p => ({ ...fn(p), updatedAt: Date.now() }));
  }, []);

  const setStatus = useCallback((c: AlgCase, s: LearnStatus) => change(p => {
    const statuses = { ...p.statuses };
    if (s === "none") delete statuses[c.id]; else statuses[c.id] = s;
    return { ...p, statuses };
  }), [change]);

  const setMain = useCallback((c: AlgCase, alg: string) => change(p => {
    const choices = { ...p.choices };
    if (alg === c.algs[0]) delete choices[c.id]; else choices[c.id] = alg;   // standard needs no entry
    return { ...p, choices };
  }), [change]);

  const setCross = useCallback((cross: CrossColor) => change(p => ({ ...p, cross })), [change]);

  return { prefs, setStatus, setMain, setCross, replace: setPrefs };
}
