import { useCallback, useEffect, useRef, useState } from "react";

// Closing with an exit animation: close() marks the popup as leaving (add the "leaving" class,
// whose CSS animation lasts at most `ms`), then calls onClose once it has played. With reduced
// motion it closes at once. The popup stays mounted meanwhile, so its key handlers still swallow
// the keyup of the key that closed it.
export function useLeave(onClose: () => void, ms = 160) {
  const [leaving, setLeaving] = useState(false);
  const latest = useRef(onClose);
  useEffect(() => { latest.current = onClose; });
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (timer.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { latest.current(); return; }
    setLeaving(true);
    // Reset too, for a popup whose owner stays mounted and can open it again (the session menu).
    timer.current = window.setTimeout(() => { timer.current = 0; setLeaving(false); latest.current(); }, ms);
  }, [ms]);

  return { leaving, close };
}
