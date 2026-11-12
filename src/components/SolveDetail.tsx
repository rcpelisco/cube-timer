import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SplitBars } from "./SplitsLine";
import { namesFor, phaseTimes, usePhases } from "../lib/splits";
import { ShareCard } from "./ShareCard";
import type { CardData } from "../lib/shareCard";
import { avgOf, bestSingle, DNF, eff, fmt, MAX_NOTE, type Penalty, type Solve } from "../lib/stats";
import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { ScramblePreview } from "./ScramblePreview";
import { useLeave } from "../hooks/useLeave";
import { useFlyIn } from "../hooks/useFlyIn";

// Full-screen view of one solve: time, penalties, date, the averages it ended, its scramble with
// a picture of the scrambled puzzle, and a note you can write.
// focusNote: open with the cursor in the note (from the Note button under the timer).
// origin: the tapped time in the solve list, which the big time flies up out of as this opens.
export function SolveDetail({ solves, i, puzzle, cube, onPenalty, onDelete, onNote, onNavigate, onClose, focusNote = false, origin }: {
  solves: Solve[]; i: number; puzzle: PuzzleId; cube?: string; focusNote?: boolean; origin?: HTMLElement;
  onPenalty: (i: number, pen: Penalty) => void; onDelete: (i: number) => void; onNote: (i: number, note: string) => void;
  onNavigate: (i: number) => void; onClose: () => void;
}) {
  const s = solves[i];
  // Which solve the delete confirmation is for, so it doesn't carry over when stepping to another.
  const [confirmAt, setConfirmAt] = useState<number | null>(null);
  const confirmDelete = confirmAt === i;
  const { leaving, close } = useLeave(onClose);
  // The tapped time shows in the list again on closing, or on stepping to another solve.
  const [firstI] = useState(i);
  const valueRef = useRef<HTMLDivElement>(null);
  const fly = useFlyIn(origin, valueRef, leaving || i !== firstI);
  const [sharing, setSharing] = useState<CardData | null>(null);
  const phaseNames = usePhases(puzzle);

  // Esc closes. Space and arrow keys don't reach the timer behind this view; in the note they
  // still type and move the cursor. Left/right step to the previous/next solve. While the share
  // view is open over this one, it handles the keys.
  useEffect(() => {
    if (sharing) return;
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.matches?.("textarea, input");
      if (e.key === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === "keydown") close();
      } else if (e.code === "Space" || e.key.startsWith("Arrow")) {
        e.stopImmediatePropagation();
        if (typing) return;
        e.preventDefault();
        if (e.type !== "keydown") return;
        if (e.key === "ArrowLeft" && i > 0) onNavigate(i - 1);
        if (e.key === "ArrowRight" && i < solves.length - 1) onNavigate(i + 1);
      }
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", key, true); };
  }, [i, solves.length, close, onNavigate, sharing]);

  if (!s) return null;

  const upTo = solves.slice(0, i + 1);
  const ao5 = avgOf(upTo, 5), ao12 = avgOf(upTo, 12);
  const time = s.pen === DNF ? "DNF" : fmt(eff(s));
  const share = () => {
    const best = s.pen !== DNF && bestSingle(solves) === eff(s);
    const phases = s.sp?.length ? phaseTimes(s.sp, s.t) : null;
    const names = phases ? namesFor(phases.length, phaseNames) : [];
    setSharing({
      kind: `${PUZZLES[puzzle].label} · Single`,
      value: s.pen === 2 ? `${time}+` : time,
      badge: best ? "Session best" : undefined,
      times: phases?.map((t, k) => ({ text: `${names[k]} ${fmt(t)}` })),
      note: s.scr || undefined,
      date: new Date(s.at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
      cube,
    });
  };
  const when = new Date(s.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return createPortal(
    <div className={`avg-detail solve-detail${fly && !leaving ? " fly" : ""}${leaving ? " leaving" : ""}`} role="dialog" aria-modal="true" aria-label={`Solve ${i + 1}`}>
      <div className="avg-detail-inner">
        <div className="avg-detail-head">
          <div>
            <span className="label">Solve {i + 1} of {solves.length} · {PUZZLES[puzzle].label}</span>
            <div className={`avg-detail-value${s.pen === DNF ? " dnf" : ""}`} ref={valueRef}>
              {time}{s.pen === 2 && <span className="solve-pen"> +2</span>}
            </div>
            <small className="avg-detail-when">
              {s.pen !== 0 && <>Raw {fmt(s.t)} · </>}{when}
            </small>
          </div>
          <div className="avg-detail-actions">
            <button type="button" onClick={share}>Share</button>
            <button type="button" className="overlay-close" aria-label="Previous solve" disabled={i === 0} onClick={() => onNavigate(i - 1)}>‹</button>
            <button type="button" className="overlay-close" aria-label="Next solve" disabled={i === solves.length - 1} onClick={() => onNavigate(i + 1)}>›</button>
            <button type="button" className="overlay-close" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        <div className="solve-actions">
          <button type="button" className={s.pen === 2 ? "on" : ""} aria-pressed={s.pen === 2} onClick={() => onPenalty(i, 2)}>+2</button>
          <button type="button" className={s.pen === DNF ? "on" : ""} aria-pressed={s.pen === DNF} onClick={() => onPenalty(i, DNF)}>DNF</button>
          <span className="solve-avgs">
            {ao5 != null && <>Ao5 <b>{fmt(ao5)}</b></>}
            {ao12 != null && <> · Ao12 <b>{fmt(ao12)}</b></>}
          </span>
          {confirmDelete ? (
            <span className="solve-delete-confirm">
              <button type="button" onClick={() => setConfirmAt(null)}>Keep</button>
              <button type="button" className="danger on" onClick={() => { onDelete(i); onClose(); }}>Delete</button>
            </span>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmAt(i)}>Delete</button>
          )}
        </div>

        {s.sp && s.sp.length > 0 && (
          <div className="panel solve-splits">
            <h2>Phases</h2>
            <SplitBars times={phaseTimes(s.sp, s.t)} puzzle={puzzle} label="Phase times" />
          </div>
        )}

        <div className="panel solve-scramble">
          <h2>Scramble</h2>
          <p className={`moves moves-${puzzle}`}>{s.scr || "—"}</p>
          {s.scr && <ScramblePreview puzzle={puzzle} moves={s.scr} className="solve-preview" />}
        </div>

        <label className="panel solve-note">
          <h2>Note</h2>
          <textarea value={s.note ?? ""} maxLength={MAX_NOTE} rows={3} autoFocus={focusNote}
            placeholder="Anything about this solve: a skip, a lockup, a bad cross…"
            onChange={e => onNote(i, e.target.value)} />
        </label>
      </div>
      {sharing && <ShareCard data={sharing} onClose={() => setSharing(null)} />}
    </div>,
    document.body,
  );
}
