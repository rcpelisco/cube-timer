import { useEffect, useLayoutEffect, type RefObject } from "react";

// Opening a popup from a value on the page (an average in Statistics, a time in the solve list):
// the popup's big value starts on top of the tapped one and travels up into place. Returns whether
// it flies, so the popup can use its fade-only opening (the "fly" class) instead of sliding up.
// The tapped value hides while it's "in" the popup and shows again as soon as `release` is set
// (closing, or stepping to another solve), or when the popup goes.

const FLY_MS = 320;

// Where the text inside an element sits (without the element's padding).
const textBox = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };

// The transform that puts `to`'s text where `from`'s text is, at its size.
// Measured with any running flight stopped, so a flight already under way doesn't skew it.
function flyFrom(from: Element, to: HTMLElement) {
  to.getAnimations().forEach(x => x.cancel());
  const a = textBox(from), b = textBox(to);
  if (!a.width || !b.height) return null;
  return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.height / b.height})`;
}

export function useFlyIn(origin: HTMLElement | undefined, valueRef: RefObject<HTMLElement | null>, release: boolean) {
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fly = !!origin && !reduced;

  // Before the first paint, so the value never shows in its final place first.
  useLayoutEffect(() => {
    const el = valueRef.current;
    if (!fly || !origin || !el) return;
    const from = flyFrom(origin, el);
    if (!from) return;
    el.animate(
      [{ transform: from, color: getComputedStyle(origin).color }, { transform: "none", color: getComputedStyle(el).color }],
      { duration: FLY_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    origin.style.visibility = "hidden";
    return () => { origin.style.visibility = ""; };
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (release && origin) origin.style.visibility = ""; }, [release, origin]);

  return fly;
}
