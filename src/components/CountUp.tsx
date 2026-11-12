import { useLayoutEffect, useRef } from "react";

// A number that counts to its value: up from zero when it first shows (or, with fromZero off, from
// its first value), then from the old value to the new one when it changes. With animate off it
// just shows the value (and counts from there next time). It writes the text straight into the element each frame rather than
// re-rendering (React leaves the element's text alone; a hidden copy carries the real value for
// screen readers). Layout effect: the first number is in place before the page paints. No value,
// a DNF (Infinity) or reduced motion just shows the value. Once a count lands, the number swells slightly.
const DURATION = 650;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ value, format, className, animate = true, fromZero = true }: {
  value: number | null; format: (v: number | null) => string; className?: string; animate?: boolean; fromZero?: boolean;
}) {
  const el = useRef<HTMLElement>(null);
  const shown = useRef<number | null>(null); // the number on screen now, mid-count or not

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (value == null || !isFinite(value) || still || !animate) {
      node.textContent = format(value);
      shown.current = value != null && isFinite(value) ? value : 0;
      return;
    }
    const from = shown.current ?? (fromZero ? 0 : value), to = value;
    if (from === to) { node.textContent = format(to); return; }
    node.textContent = format(from);
    const start = performance.now();
    let hop: Animation | undefined;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION)); // a frame can be stamped just before start
      shown.current = from + (to - from) * ease(t);
      node.textContent = t < 1 ? format(shown.current) : format(to);
      if (t < 1) { frame = requestAnimationFrame(step); return; }
      shown.current = to;
      // Landed: a brief, slight swell.
      hop = node.animate?.([
        { transform: "none" },
        { transform: "scale(1.05)", offset: 0.4 },
        { transform: "none" },
      ], { duration: 320, easing: "ease-out" });
    });
    return () => { cancelAnimationFrame(frame); hop?.cancel(); };
  }, [value, format, animate, fromZero]);

  return <>
    <b ref={el} className={className} aria-hidden="true" />
    <span className="sr-only">{format(value)}</span>
  </>;
}
