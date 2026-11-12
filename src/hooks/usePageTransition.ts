import { useLayoutEffect, useRef } from "react";
import type { View } from "./useView";

// Phones: the new page slides in a little from the side of the tab you came from (left for a tab
// to the left, right for one to the right) as it fades in, so switching tabs doesn't just pop.
// The tab bar stays put. With reduced motion it only fades. The transform is gone once it ends,
// so fixed overlays inside the page aren't affected afterwards.
const ORDER: View[] = ["timer", "solves", "algs", "train", "settings"];

export function usePageTransition(view: View, phone: boolean) {
  const prev = useRef(view);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = view;
    if (!phone || from === view) return;
    const el = document.querySelector<HTMLElement>(".page-scroll > .app");
    if (!el?.animate) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dir = Math.sign(ORDER.indexOf(view) - ORDER.indexOf(from));
    const anim = el.animate(
      still
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: "none" }],
      { duration: still ? 150 : 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    return () => anim.cancel();
  }, [view, phone]);
}
