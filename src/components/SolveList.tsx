import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { avgOf, DNF, eff, fmt, rolling, type Penalty, type Solve } from "../lib/stats";
import { PUZZLES, type PuzzleId } from "../lib/puzzles";
import { solveKey } from "../lib/sessions";
import { SolveDetail } from "./SolveDetail";

interface Props {
  solves: Solve[];
  onPenalty: (i: number, pen: Penalty) => void;
  onDelete: (i: number) => void;
}

export function PenaltyButtons({ i, solve, onPenalty, onDelete, compact }: { i: number; solve: Solve; compact?: boolean } & Omit<Props, "solves">) {
  return (
    <>
      <button type="button" className={solve.pen === 2 ? "on" : ""} onClick={() => onPenalty(i, 2)}>+2</button>
      <button type="button" className={solve.pen === DNF ? "on" : ""} onClick={() => onPenalty(i, DNF)}>DNF</button>
      <button type="button" className="danger" aria-label={`Delete solve ${i + 1}`} onClick={() => onDelete(i)}>
        {compact ? "✕" : "Delete"}
      </button>
    </>
  );
}

// Rows shown at first, and added by each "Show more": thousands of rows at once make the page slow.
const PAGE = 100;

// Solves, newest first. Tap a row for the solve's details: scramble, picture, note.
// Select: tap rows (shift-click for a range) to delete them or move them to another session for the
// same puzzle, e.g. solves done while the wrong session was open.
// memo: the timer re-renders the app every frame while it runs; this only needs to when the solves change.
export const SolveList = memo(function SolveList({ solves, puzzle, cube, onPenalty, onDelete, onNote, targets, onDeleteMany, onMove }: Props & {
  puzzle: PuzzleId; cube?: string; onNote: (i: number, note: string) => void;
  targets: { id: string; name: string }[];
  onDeleteMany: (keys: Set<string>) => void; onMove: (keys: Set<string>, toId: string) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  // Only solves still in the session count (one may have been deleted or synced away meanwhile).
  const picked = useMemo(() => new Set(solves.map(solveKey).filter(k => selected.has(k))), [solves, selected]);
  const stopSelecting = useCallback(() => { setSelecting(false); setSelected(new Set()); setAnchor(null); }, []);
  const toggle = (i: number, range: boolean) => {
    const next = new Set(selected);
    if (range && anchor != null) {
      const on = !selected.has(solveKey(solves[i]));
      for (let j = Math.min(anchor, i); j <= Math.max(anchor, i); j++) {
        if (on) next.add(solveKey(solves[j])); else next.delete(solveKey(solves[j]));
      }
    } else {
      const k = solveKey(solves[i]);
      if (next.has(k)) next.delete(k); else next.add(k);
    }
    setSelected(next);
    setAnchor(i);
  };
  const allPicked = picked.size === solves.length && solves.length > 0;
  // Esc leaves selecting.
  useEffect(() => {
    if (!selecting) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector('[aria-modal="true"]')) { e.preventDefault(); stopSelecting(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selecting, stopSelecting]);

  // The open solve, by position in the session, and the tapped time it flies up out of.
  const [open, setOpen] = useState<number | null>(null);
  const [origin, setOrigin] = useState<HTMLElement | undefined>();
  const close = useCallback(() => setOpen(null), []);
  const openRow = (i: number, row: Element) => { setOrigin(row.querySelector<HTMLElement>(".row-open") ?? undefined); setOpen(i); };
  const [limit, setLimit] = useState(PAGE);
  const ao5 = useMemo(() => rolling(solves, avgOf, 5), [solves]);
  const rows = [];
  for (let i = solves.length - 1; i >= Math.max(0, solves.length - limit); i--) rows.push({ s: solves[i], i, ao: ao5[i] });
  const hidden = solves.length - rows.length;

  return (
    <div className={`panel solve-log${selecting ? " selecting" : ""}`}>
      <h2>
        <span>{selecting ? `${picked.size} selected` : "Solves"}</span>
        {solves.length > 0 && (selecting ? (
          <span className="log-head-actions">
            <button type="button" className="link-btn" onClick={() => { setSelected(allPicked ? new Set() : new Set(solves.map(solveKey))); setAnchor(null); }}>
              {allPicked ? "None" : `All ${solves.length}`}
            </button>
            <button type="button" className="link-btn" onClick={stopSelecting}>Done</button>
          </span>
        ) : (
          <button type="button" className="link-btn" onClick={() => setSelecting(true)}>Select</button>
        ))}
      </h2>
      <div className="log">
        {!solves.length ? (
          <p className="empty-log">No solves yet. Your times, Ao5 at each solve and penalties will be listed here.</p>
        ) : (
          <table><tbody>
            {rows.map(({ s, i, ao }) => (
              <tr key={s.at + "-" + i} className={`row${picked.has(solveKey(s)) ? " picked" : ""}`}
                onClick={e => {
                  if (selecting) { if (!(e.target as Element).closest("input")) toggle(i, e.shiftKey); return; }
                  if (!(e.target as Element).closest("button")) openRow(i, e.currentTarget);
                }}>
                <td className="n">
                  {selecting
                    ? <input type="checkbox" className="pick" aria-label={`Select solve ${i + 1}`} checked={picked.has(solveKey(s))}
                        onChange={() => {}} onClick={e => toggle(i, e.shiftKey)} />
                    : i + 1}
                </td>
                <td className={s.pen === DNF ? "dnf" : ""}>
                  <button type="button" className="row-open" aria-label={`Solve ${i + 1} details`} tabIndex={selecting ? -1 : undefined}
                    onClick={e => { if (!selecting) openRow(i, e.currentTarget.closest("tr")!); }}>
                    {s.pen === DNF ? <>DNF <span className="raw">({fmt(s.t)})</span></> : <>{fmt(eff(s))}{s.pen === 2 && <span className="pen-tag">+</span>}</>}
                  </button>
                  {s.note && <span className="note-mark" title={s.note} aria-label="Has a note">✎</span>}
                </td>
                <td className="ao">{ao == null ? "" : fmt(ao)}</td>
                <td className="act">
                  {!selecting && <PenaltyButtons i={i} solve={s} compact onPenalty={onPenalty} onDelete={onDelete} />}
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
        {hidden > 0 && (
          <button type="button" className="show-more" onClick={() => setLimit(l => l + PAGE * 5)}>
            Show {Math.min(hidden, PAGE * 5)} more · {hidden} older
          </button>
        )}
      </div>
      {selecting && (
        <div className="select-bar">
          <select aria-label="Move selected solves to session" value="" disabled={!picked.size || !targets.length}
            onChange={e => { if (e.target.value) { onMove(picked, e.target.value); stopSelecting(); } }}>
            <option value="">{targets.length ? "Move to…" : `No other ${PUZZLES[puzzle].label} sessions`}</option>
            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" className="danger" disabled={!picked.size} onClick={() => { onDeleteMany(picked); stopSelecting(); }}>
            Delete{picked.size ? ` ${picked.size}` : ""}
          </button>
        </div>
      )}
      {open != null && open < solves.length && (
        <SolveDetail solves={solves} i={open} puzzle={puzzle} cube={cube} origin={origin} onPenalty={onPenalty} onNote={onNote}
          onDelete={j => { onDelete(j); setOpen(null); }} onNavigate={setOpen} onClose={close} />
      )}
    </div>
  );
});
