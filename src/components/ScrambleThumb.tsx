import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { ScramblePreview } from "./ScramblePreview";

const FLY_MS = 320, BACK_MS = 240;

// The transform that puts `el` where `target` is, at its size (both pictures have the same shape).
// Measured with any running flight stopped, so a flight already under way doesn't skew it.
function flyTo(el: HTMLElement, target: Element) {
  el.getAnimations().forEach(x => x.cancel());
  const a = target.getBoundingClientRect(), b = el.getBoundingClientRect();
  if (!a.width || !b.width) return null;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${a.width / b.width})`;
}

// Text size of the scramble in the full view, as steps of a scale; remembered on this device.
const TEXT_SCALES = [0.7, 0.85, 1, 1.2, 1.4, 1.65, 1.9, 2.2];
const TEXT_KEY = "cubeTimer.scrambleTextSize";
function readTextStep() {
  const normal = TEXT_SCALES.indexOf(1);
  try {
    const raw = localStorage.getItem(TEXT_KEY), v = Number(raw);
    return raw !== null && Number.isInteger(v) && v >= 0 && v < TEXT_SCALES.length ? v : normal;
  } catch { return normal; }
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Small scrambled-state preview for phones; tap it to see the whole puzzle full screen. The
// picture flies from the thumbnail to the middle as the full view opens, and back as it closes.
export function ScrambleThumb({ puzzle, moves }: { puzzle: PuzzleId; moves: string | null }) {
  const [open, setOpen] = useState(false);
  const thumb = useRef<HTMLDivElement>(null);

  return (
    <>
      <button type="button" className="thumb-btn dimmable" disabled={!moves} aria-label="Show the scrambled state full screen"
        onClick={() => setOpen(true)}>
        <div ref={thumb} className="thumb-pic">
          <ScramblePreview className="scramble-thumb" puzzle={puzzle} moves={moves} />
        </div>
        <svg className="thumb-expand" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && moves && (
        <ScrambleOverlay puzzle={puzzle} moves={moves} thumb={thumb} onClosed={() => setOpen(false)} />
      )}
    </>
  );
}

function ScrambleOverlay({ puzzle, moves, thumb, onClosed }: {
  puzzle: PuzzleId; moves: string; thumb: RefObject<HTMLDivElement | null>; onClosed: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const pic = useRef<HTMLDivElement>(null);
  const [textStep, setTextStep] = useState(readTextStep);
  useEffect(() => {
    try { localStorage.setItem(TEXT_KEY, String(textStep)); } catch { /* ignore */ }
  }, [textStep]);
  const changeText = (by: number) => (e: MouseEvent) => {
    e.stopPropagation(); // a tap on the overlay closes it
    setTextStep(step => Math.min(TEXT_SCALES.length - 1, Math.max(0, step + by)));
  };

  // Before the first paint: start the big picture on top of the thumbnail and let it travel to the
  // middle. The thumbnail hides meanwhile (the picture is "out" of it) and shows again on closing.
  useLayoutEffect(() => {
    const el = pic.current, from = thumb.current;
    if (!el || !from || reducedMotion()) return;
    const t = flyTo(el, from);
    if (!t) return;
    el.animate([{ transform: t }, { transform: "none" }], { duration: FLY_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    from.style.visibility = "hidden";
    return () => { from.style.visibility = ""; };
  }, [thumb]);

  // Fly back into the thumbnail (re-measured, in case the page moved), then unmount.
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const el = pic.current, to = thumb.current;
    if (reducedMotion() || !el || !to) { onClosed(); return; }
    const t = flyTo(el, to);
    if (t) el.animate([{ transform: "none" }, { transform: t }], { duration: BACK_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" });
    setClosing(true);
    // A timer rather than animationend, so it also finishes when the page is in the background:
    // otherwise the invisible overlay would keep catching Space.
    fallback.current = window.setTimeout(onClosed, BACK_MS);
  };
  const fallback = useRef(0);
  useEffect(() => () => clearTimeout(fallback.current), []);

  // Esc or Space closes. Listen in the capture phase and stop the event there, so Space
  // closes this view without also arming the timer (the overlay stays mounted while it animates
  // out, so it also catches that Space's keyup).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.code !== "Space") return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === "keydown") close();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  });

  return createPortal(
    <div className={`scramble-overlay${closing ? " closing" : ""}`} style={{ "--scr-scale": TEXT_SCALES[textStep] } as CSSProperties}
      role="dialog" aria-modal="true" aria-label="Scrambled state" onClick={close}>
      <div className="overlay-head">
        <span className="label">Scrambled state · {PUZZLES[puzzle].label}</span>
        <div className="overlay-actions">
          <div className="text-size" role="group" aria-label="Scramble text size">
            <button type="button" aria-label="Smaller scramble text" disabled={textStep === 0} onClick={changeText(-1)}>
              <span className="a-small">A</span>
            </button>
            <button type="button" aria-label="Bigger scramble text" disabled={textStep === TEXT_SCALES.length - 1} onClick={changeText(1)}>
              <span className="a-big">A</span>
            </button>
          </div>
          <button type="button" className="overlay-close" aria-label="Close" onClick={e => { e.stopPropagation(); close(); }}>✕</button>
        </div>
      </div>
      <div ref={pic} className="zoom-pic">
        <ScramblePreview className="scramble-zoom" puzzle={puzzle} moves={moves} />
      </div>
      <p className={`moves moves-${puzzle}`}>{moves}</p>
      <p className="overlay-hint">Tap anywhere to close</p>
    </div>,
    document.body,
  );
}
