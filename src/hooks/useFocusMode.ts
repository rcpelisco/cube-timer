import { useEffect, useRef } from "react";

// Focus mode during inspection and solves: full-screen timer, page scrolling locked (see App.css).
// The switch is animated with a view transition (the time glides to/from the centre). It's only
// visual: the clock already started or stopped when the key/touch was released.
export function useFocusMode(active: boolean) {
  // A very quick start-and-stop can switch back before the first transition has applied, so only
  // skip when no switch is still pending (each switch's update runs, in order, even if skipped).
  const pending = useRef(0);
  useEffect(() => {
    if (pending.current === 0 && document.body.classList.contains("solving") === active) return;
    const apply = () => {
      document.body.classList.toggle("solving", active);
      document.documentElement.classList.toggle("scroll-locked", active);
    };
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (document as Partial<Document>).startViewTransition?.bind(document);
    if (startViewTransition && !reduceMotion) {
      pending.current++;
      startViewTransition(apply).updateCallbackDone.catch(() => {}).finally(() => { pending.current--; });
    } else apply();
  }, [active]);

  // Leaving the page mid-solve (e.g. the back gesture) mustn't leave the screen in focus mode.
  useEffect(() => () => {
    document.body.classList.remove("solving");
    document.documentElement.classList.remove("scroll-locked");
  }, []);
}
