import { useCallback, useEffect, useState } from "react";

// Which page is showing. Computers have Timer (with solves and stats beside it) and Algorithms;
// phones split the timer page and add Settings, one per bottom tab. The page is in the address
// (#solves, #algs, #train, #settings) so the back button / swipe works.
export type View = "timer" | "solves" | "algs" | "train" | "settings";
const VIEWS: View[] = ["timer", "solves", "algs", "train", "settings"];

const fromHash = (): View => {
  const v = location.hash.slice(1) as View;
  return VIEWS.includes(v) ? v : "timer";
};

export function useView(): [View, (v: View) => void] {
  const [view, setViewState] = useState<View>(fromHash);

  useEffect(() => {
    const sync = () => setViewState(fromHash());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);

  const setView = useCallback((v: View) => {
    if (v === fromHash()) return;
    history.pushState(null, "", v === "timer" ? location.pathname + location.search : `#${v}`);
    setViewState(v);
    window.scrollTo(0, 0);
    document.querySelector(".page-scroll")?.scrollTo(0, 0); // phones scroll inside the shell
  }, []);

  return [view, setView];
}
