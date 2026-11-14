import { useCallback, useEffect, useRef } from "react";

// Pull a full-screen popup down to close it, as with iOS sheets. Starts only when the popup is
// scrolled to the top and the finger moves mostly downwards (sideways swipes and scrolling are left
// alone); the popup follows the finger, and on release it closes if pulled far enough or flicked
// down, or springs back. Touches on text fields and on the 3D cube popup are ignored.
// Returns a ref for the popup's scrolling root.
const START_PX = 8;      // movement before deciding between a pull and something else
const CLOSE_PX = 110;    // pulled this far: close
const FLICK = 0.5;       // or released moving down this fast (px/ms) after a short pull
const SKIP = "input, textarea, select, .cube-popup-backdrop";

export function usePullToClose(onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => { latest.current = onClose; });

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false, dy = 0, lastY = 0, lastT = 0, speed = 0, done = false;

    const springBack = () => {
      el.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "";
      delete el.dataset.pulling;
    };
    const down = (e: TouchEvent) => {
      start = null;
      if (done || e.touches.length !== 1 || el.scrollTop > 0 || (e.target as Element).closest?.(SKIP)) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      lastY = t.clientY; lastT = e.timeStamp; speed = 0; dy = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      dy = t.clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
        // Up, sideways, or the content has scrolled: not a pull.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) { start = null; return; }
        pulling = true;
        el.style.transition = "none";
        el.dataset.pulling = "";
      }
      e.preventDefault(); // no scroll or rubber-band while pulling
      if (e.timeStamp > lastT) speed = (t.clientY - lastY) / (e.timeStamp - lastT);
      lastY = t.clientY; lastT = e.timeStamp;
      el.style.transform = `translateY(${Math.max(0, dy - START_PX)}px)`;
    };
    const up = () => {
      start = null;
      if (!pulling) return;
      pulling = false;
      if (dy > CLOSE_PX || (dy > 40 && speed > FLICK)) {
        done = true;
        el.style.transition = "transform 200ms cubic-bezier(0.4, 0, 1, 1)";
        el.style.transform = `translateY(${window.innerHeight}px)`;
        el.style.pointerEvents = "none";
        window.setTimeout(() => latest.current(), 200);
      } else springBack();
    };

    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", up);
    el.addEventListener("touchcancel", up);
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, []);
}
