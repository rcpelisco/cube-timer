import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { DNF, fmt, type Penalty } from "../lib/stats";
import { setWakeLockStatus } from "../lib/wakeLockStatus";

// Stackmat-style timer: hold until ready (green), release to start, any key or tap to stop.
// Optional WCA inspection: 15 s countdown, +2 after 15 s, DNF after 17 s.

export type Phase = "idle" | "inspect" | "running";
export interface TimerView {
  phase: Phase;
  holding: boolean;
  ready: boolean;
  display: string | null; // null = show the last result
  warn: 0 | 8 | 12;
}

const HOLD_MS = 300;

interface Options {
  stageRef: RefObject<HTMLElement | null>;
  inspection: boolean;
  onFinish: (t: number, pen: Penalty) => void;
  enabled?: boolean; // false while another page is showing: keys and taps are ignored
}

export function useTimer({
  stageRef,
  inspection,
  onFinish,
  enabled = true,
}: Options): TimerView {
  const [view, setView] = useState<TimerView>({
    phase: "idle",
    holding: false,
    ready: false,
    display: null,
    warn: 0,
  });
  const opts = useRef({ inspection, onFinish, enabled });
  useLayoutEffect(() => {
    opts.current = { inspection, onFinish, enabled };
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = {
      phase: "idle" as Phase,
      holding: false,
      ready: false,
      pendingInspect: false,
      swallowUp: false,
      pointerArmed: false,
      downX: 0,
      downY: 0,
      t0: 0,
      inspStart: 0,
      inspPen: 0 as Penalty,
      raf: 0,
      holdTimer: 0,
    };
    const sync = (patch: Partial<TimerView> = {}) =>
      setView((v) => ({
        ...v,
        phase: st.phase,
        holding: st.holding,
        ready: st.ready,
        ...patch,
      }));

    const tick = () => {
      const now = performance.now();
      if (st.phase === "running") {
        sync({ display: fmt(now - st.t0) });
      } else if (st.phase === "inspect") {
        const el = now - st.inspStart;
        if (el >= 17000) {
          finish(0, DNF);
          return;
        }
        sync({
          display: el >= 15000 ? "+2" : String(15 - Math.floor(el / 1000)),
          warn: el >= 12000 ? 12 : el >= 8000 ? 8 : 0,
        });
      }
      st.raf = requestAnimationFrame(tick);
    };
    const loop = () => {
      cancelAnimationFrame(st.raf);
      st.raf = requestAnimationFrame(tick);
    };

    const finish = (t: number, pen: Penalty) => {
      cancelAnimationFrame(st.raf);
      st.phase = "idle";
      st.holding = st.ready = false;
      sync({ display: null, warn: 0 });
      opts.current.onFinish(Math.round(t), pen);
    };

    const startInspection = () => {
      st.phase = "inspect";
      st.inspStart = performance.now();
      sync({ display: "15", warn: 0 });
      loop();
    };

    const startSolve = () => {
      st.inspPen =
        st.phase === "inspect" && performance.now() - st.inspStart > 15000
          ? 2
          : 0;
      st.phase = "running";
      st.t0 = performance.now();
      sync({ display: "0.00", warn: 0 });
      loop();
    };

    const cancelAttempt = () => {
      cancelAnimationFrame(st.raf);
      clearTimeout(st.holdTimer);
      st.phase = "idle";
      st.holding = st.ready = st.pendingInspect = false;
      sync({ display: null, warn: 0 });
    };

    const pressDown = () => {
      if (st.phase === "running") {
        st.swallowUp = true;
        finish(performance.now() - st.t0, st.inspPen);
        return;
      }
      if (st.phase === "idle" && opts.current.inspection) {
        st.pendingInspect = true;
        return;
      }
      st.holding = true;
      st.ready = false;
      clearTimeout(st.holdTimer);
      st.holdTimer = window.setTimeout(() => {
        st.ready = true;
        sync();
      }, HOLD_MS);
      sync(st.phase === "idle" ? { display: "0.00" } : {});
    };

    const pressUp = () => {
      if (st.swallowUp) {
        st.swallowUp = false;
        return;
      }
      if (st.pendingInspect) {
        st.pendingInspect = false;
        startInspection();
        return;
      }
      if (!st.holding) return;
      clearTimeout(st.holdTimer);
      st.holding = false;
      if (st.ready) {
        st.ready = false;
        startSolve();
      } else sync(st.phase === "idle" ? { display: null } : {});
    };

    // Let text fields (session names) take keys normally.
    const typing = (e: KeyboardEvent) =>
      st.phase === "idle" &&
      (e.target as Element).matches?.("input[type=text], textarea");

    const onKeyDown = (e: KeyboardEvent) => {
      if (!opts.current.enabled || typing(e)) return;
      if (e.key === "Escape" && st.phase !== "idle") {
        cancelAttempt();
        return;
      }
      if (st.phase === "running") {
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        e.preventDefault();
        if (!e.repeat) pressDown();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) pressDown();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!opts.current.enabled || typing(e)) return;
      if (e.code === "Space") e.preventDefault();
      if (st.swallowUp || e.code === "Space") pressUp();
    };
    const onStageDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("button") || e.button !== 0) return;
      e.preventDefault();
      st.pointerArmed = true;
      st.downX = e.clientX;
      st.downY = e.clientY;
      pressDown();
    };
    const onDocDown = (e: PointerEvent) => {
      if (!opts.current.enabled) return;
      if (st.phase === "running" && !stage.contains(e.target as Node)) {
        st.pointerArmed = true;
        pressDown();
      }
    };
    const onUp = () => {
      if (st.pointerArmed) {
        st.pointerArmed = false;
        pressUp();
      }
    };

    // Drop a hold without starting the timer.
    const cancelHold = () => {
      if (st.holding || st.pendingInspect) {
        clearTimeout(st.holdTimer);
        st.holding = st.ready = st.pendingInspect = false;
        sync(st.phase === "idle" ? { display: null } : {});
      }
    };
    // A touch that turns into a scroll isn't a hold: the finger moves, the page scrolls,
    // or the browser takes the gesture over (pointercancel). None of these may start the timer.
    const SLOP_PX = 10;
    const abandonPointer = () => {
      if (!st.pointerArmed) return;
      st.pointerArmed = false;
      if (st.swallowUp)
        st.swallowUp = false; // the touch that stopped a solve; nothing to cancel
      else cancelHold();
    };
    const onMove = (e: PointerEvent) => {
      if (!st.pointerArmed || st.swallowUp) return;
      if (Math.hypot(e.clientX - st.downX, e.clientY - st.downY) > SLOP_PX)
        abandonPointer();
    };
    const onScroll = () => {
      if (!st.swallowUp) abandonPointer();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    stage.addEventListener("pointerdown", onStageDown);
    document.addEventListener("pointerdown", onDocDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", abandonPointer);
    window.addEventListener("pointermove", onMove, { passive: true });
    // Capture: also hears scrolling inside the phone page container (scroll doesn't bubble).
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("blur", cancelHold);
    return () => {
      cancelAnimationFrame(st.raf);
      clearTimeout(st.holdTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      stage.removeEventListener("pointerdown", onStageDown);
      document.removeEventListener("pointerdown", onDocDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", abandonPointer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("blur", cancelHold);
    };
  }, [stageRef]);

  useWakeLock(true);
  return view;
}

// Keep the screen on while the app is open (supported on iOS 16.4+ and recent Chrome).
// The browser drops the lock whenever the page is hidden, so take it again on return.
// iOS can refuse a request that isn't made from a tap (at launch, or after returning from the
// home screen), so every tap or key press also retries while no lock is held.
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (!("wakeLock" in navigator)) {
      setWakeLockStatus({ state: "unsupported" });
      return;
    }
    let lock: WakeLockSentinel | null = null,
      pending = false,
      disposed = false,
      requests = 0;
    const acquire = () => {
      if (disposed || pending || document.visibilityState !== "visible") return;
      if (lock && !lock.released) return;
      pending = true;
      setWakeLockStatus({ state: "requesting", requests: ++requests });
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (disposed) {
            l.release().catch(() => {});
            return;
          }
          lock = l;
          setWakeLockStatus({ state: "held", detail: "" });
          l.addEventListener("release", () => {
            if (!disposed) setWakeLockStatus({ state: "released", detail: `page ${document.visibilityState}` });
          });
        })
        .catch((e: unknown) => {
          const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
          setWakeLockStatus({ state: "refused", detail: err });
        })
        .finally(() => {
          pending = false;
        });
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    window.addEventListener("pointerdown", acquire, { capture: true, passive: true });
    window.addEventListener("keydown", acquire, { capture: true, passive: true });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      window.removeEventListener("pointerdown", acquire, { capture: true });
      window.removeEventListener("keydown", acquire, { capture: true });
      lock?.release().catch(() => {});
    };
  }, [active]);
}
