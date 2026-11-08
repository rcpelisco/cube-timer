import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { ScramblePreview } from "./ScramblePreview";

// Small scrambled-state preview for phones; tap it to see the whole puzzle full screen. The full
// view zooms out of the thumbnail when it opens and back into it when it closes.
export function ScrambleThumb({ puzzle, moves }: { puzzle: PuzzleId; moves: string | null }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Centre of the thumbnail on screen: where the full view grows from and shrinks back to.
  const thumbCentre = () => {
    const r = button.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  return (
    <>
      <button ref={button} type="button" className="thumb-btn" disabled={!moves} aria-label="Show the scrambled state full screen"
        onClick={() => setOrigin(thumbCentre())}>
        <ScramblePreview className="scramble-thumb" puzzle={puzzle} moves={moves} />
        <svg className="thumb-expand" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {origin && moves && (
        <ScrambleOverlay puzzle={puzzle} moves={moves} origin={origin} closeOrigin={thumbCentre} onClosed={() => setOrigin(null)} />
      )}
    </>
  );
}

function ScrambleOverlay({ puzzle, moves, origin, closeOrigin, onClosed }: {
  puzzle: PuzzleId; moves: string; origin: { x: number; y: number };
  closeOrigin: () => { x: number; y: number }; onClosed: () => void;
}) {
  const [closing, setClosing] = useState<{ x: number; y: number } | null>(null);
  const closingRef = useRef(false);

  // Shrink back into the thumbnail (re-measured, in case the page moved), then unmount.
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { onClosed(); return; }
    setClosing(closeOrigin());
    // If the animation never runs (e.g. the page is in the background), still finish closing:
    // otherwise the invisible overlay would keep catching Space.
    fallback.current = window.setTimeout(onClosed, 400);
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

  const at = closing ?? origin;
  const style = { "--ox": `${at.x}px`, "--oy": `${at.y}px` } as CSSProperties;

  return createPortal(
    <div className={`scramble-overlay ${closing ? "zoom-out" : "zoom-in"}`} style={style}
      role="dialog" aria-modal="true" aria-label="Scrambled state" onClick={close}
      onAnimationEnd={e => { if (e.target === e.currentTarget && closing) onClosed(); }}>
      <div className="overlay-head">
        <span className="label">Scrambled state · {PUZZLES[puzzle].label}</span>
        <button type="button" className="overlay-close" aria-label="Close" onClick={e => { e.stopPropagation(); close(); }}>✕</button>
      </div>
      <ScramblePreview className="scramble-zoom" puzzle={puzzle} moves={moves} />
      <p className={`moves moves-${puzzle}`}>{moves}</p>
      <p className="overlay-hint">Tap anywhere to close</p>
    </div>,
    document.body,
  );
}
