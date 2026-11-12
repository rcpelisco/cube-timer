import { useCallback, useEffect, useState } from "react";

// Whether an element has come near the screen yet (within a screen's height or so). Once seen it
// stays true. One shared observer serves every element, so long grids stay cheap. Without
// IntersectionObserver everything counts as seen.
const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;
function watch(el: Element, onSeen: () => void) {
  if (typeof IntersectionObserver === "undefined") { onSeen(); return () => {}; }
  observer ??= new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      callbacks.get(e.target)?.();
      callbacks.delete(e.target);
      observer!.unobserve(e.target);
    }
  }, { rootMargin: "600px 0px" });
  callbacks.set(el, onSeen);
  observer.observe(el);
  return () => { callbacks.delete(el); observer?.unobserve(el); };
}

export function useSeen<T extends Element>(): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => (el && !seen ? watch(el, () => setSeen(true)) : undefined), [el, seen]);
  return [useCallback((node: T | null) => setEl(node), []), seen];
}
