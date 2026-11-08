import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { puzzleOf, setupFor, SET_LABEL, type AlgCase } from "../lib/algs";
import { CaseDiagram } from "./CaseDiagram";
import { AlgText } from "./AlgText";
import { TwistyView } from "./TwistyView";
import { rotationFor, stickeringMask, stickeringMask2x2, type CrossColor } from "../lib/crossColor";
import { STATUS_LABEL, STATUS_ORDER, type LearnStatus } from "../lib/algStatus";

// Full-screen view of one case: the diagram, every algorithm for it (standard first; pick the one
// you use as "main"), and the setup for the main one. Tapping the diagram or "Watch" opens a popup
// with a 3D cube that plays that algorithm. Swipe left/right (or ← →, or ‹ ›) for the next or
// previous case in the list as currently filtered.
const SWIPE_PX = 60;

export function CaseDetail({ c, cross, main, onChooseMain, status, onStatus, onClose, position, onPrev, onNext }: {
  c: AlgCase; cross: CrossColor; main: string; onChooseMain: (alg: string) => void;
  status: LearnStatus; onStatus: (s: LearnStatus) => void; onClose: () => void;
  position: { index: number; total: number } | null; onPrev: (() => void) | null; onNext: (() => void) | null;
}) {
  const [watching, setWatching] = useState<string | null>(null);
  const watchingRef = useRef(false);
  useEffect(() => { watchingRef.current = watching !== null; }, [watching]);
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (dir: "next" | "prev") => {
    const fn = dir === "next" ? onNext : onPrev;
    if (!fn || watchingRef.current) return;
    setSlide(dir);
    fn();
  };
  // New case: start at the top.
  useEffect(() => { root.current?.scrollTo({ top: 0 }); }, [c.id]);

  // ← → keys move between cases (not while typing or while the 3D popup is open).
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (watchingRef.current || (e.target as Element).matches?.("input, textarea")) return;
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); setSlide("next"); onNext(); }
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); setSlide("prev"); onPrev(); }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [onNext, onPrev]);

  useEffect(() => {
    // While the 3D popup is open, Esc belongs to the popup.
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !watchingRef.current) { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="case-detail" role="dialog" aria-modal="true" aria-label={c.name} ref={root}
      onTouchStart={e => { const t = e.touches[0]; touch.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }}
      onTouchEnd={e => {
        const start = touch.current; touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
        // Only clearly sideways swipes change the case; anything else is scrolling.
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? "next" : "prev");
      }}>
      <div className="case-detail-head">
        <div>
          <span className="label">{puzzleOf(c.set) === "2x2" ? "2×2 " : ""}{SET_LABEL[c.set]} · {c.group}</span>
          <h2>{c.name}</h2>
        </div>
        <div className="case-nav">
          <button type="button" className="nav-btn" aria-label="Previous case" disabled={!onPrev} onClick={() => go("prev")}>‹</button>
          {position && <span className="case-pos">{position.index + 1} / {position.total}</span>}
          <button type="button" className="nav-btn" aria-label="Next case" disabled={!onNext} onClick={() => go("next")}>›</button>
          <button type="button" className="overlay-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
      </div>
      <div key={c.id} className={`case-detail-body${slide ? ` slide-${slide}` : ""}`}>
        <div className="status-switch" role="radiogroup" aria-label="Learning status">
          {STATUS_ORDER.map(s => (
            <button key={s} type="button" role="radio" aria-checked={status === s}
              className={`status-${s}${status === s ? " on" : ""}`} onClick={() => onStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button type="button" className="case-watch" onClick={() => setWatching(main)} aria-label={`Watch ${c.name} on a 3D cube`}>
          <CaseDiagram c={c} alg={main} cross={cross} className="case-diagram-large" />
          <span className="case-watch-hint">▶ Watch</span>
        </button>

        <section className="alg-list" aria-label="Algorithms">
          <h3>Algorithms <span>{c.algs.length}</span></h3>
          {c.algs.map((alg, i) => (
            <div key={alg} className={`alg-row${alg === main ? " main" : ""}`}>
              <div className="alg-row-tags">
                {i === 0 && <span className="tag">Standard</span>}
                {alg === main && <span className="tag main">Main</span>}
              </div>
              <p className="moves"><AlgText alg={alg} labels /></p>
              <div className="alg-row-actions">
                {alg !== main && <button type="button" onClick={() => onChooseMain(alg)}>Use as main</button>}
                <button type="button" onClick={() => setWatching(alg)}>Watch</button>
                <CopyButton text={alg} label="algorithm" />
              </div>
            </div>
          ))}
        </section>

        <section className="moves-block">
          <div className="moves-block-head">
            <div>
              <h3>Setup</h3>
              <span>For your main algorithm: from solved, top color on top</span>
            </div>
            <CopyButton text={setupFor(main)} label="setup" />
          </div>
          <p className="moves">{setupFor(main)}</p>
        </section>
      </div>
      {watching && <Cube3DPopup c={c} alg={watching} cross={cross} onClose={() => setWatching(null)} />}
    </div>,
    document.body,
  );
}

function Cube3DPopup({ c, alg, cross, onClose }: { c: AlgCase; alg: string; cross: CrossColor; onClose: () => void }) {
  const is2x2 = puzzleOf(c.set) === "2x2";
  // Esc closes just this popup: catch it before the detail view's own Esc handler.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopImmediatePropagation(); onClose();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);

  return (
    <div className="cube-popup-backdrop" onClick={onClose}>
      <div className="cube-popup" role="dialog" aria-modal="true" aria-label={`${c.name} on a 3D cube`} onClick={e => e.stopPropagation()}>
        <div className="cube-popup-head">
          <span className="label">{c.name}</span>
          <button type="button" className="overlay-close" aria-label="Close 3D cube" onClick={onClose}>✕</button>
        </div>
        <TwistyView className="case-3d" label={`${c.name} algorithm on a 3D cube`} options={{
          puzzle: is2x2 ? "2x2x2" : "3x3x3", alg, experimentalSetupAlg: rotationFor(cross), experimentalSetupAnchor: "end",
          experimentalStickeringMaskOrbits: c.set === "OLL2" || c.set === "PBL" ? stickeringMask2x2(c.set, cross) : stickeringMask(c.set, cross),
          visualization: "3D", background: "none",
          controlPanel: "bottom-row", hintFacelets: "floating", viewerLink: "none", tempoScale: 1.5,
        }} />
        <p className="moves cube-popup-moves"><AlgText alg={alg} /></p>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState("Copy");
  const copy = () => {
    const done = (m: string) => { setCopied(m); setTimeout(() => setCopied("Copy"), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => done("Copied"), () => done("Copy blocked"));
    else done("Copy blocked");
  };
  return <button type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied}</button>;
}
