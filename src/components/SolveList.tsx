import { useCallback, useState } from "react";
import { avgOf, DNF, eff, fmt, type Penalty, type Solve } from "../lib/stats";
import type { PuzzleId } from "../lib/puzzles";
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

// Solves, newest first. Tap a row for the solve's details: scramble, picture, note.
export function SolveList({ solves, puzzle, onPenalty, onDelete, onNote }: Props & {
  puzzle: PuzzleId; onNote: (i: number, note: string) => void;
}) {
  // The open solve, by position in the session.
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const rows = solves.map((s, i) => ({ s, i, ao: avgOf(solves.slice(0, i + 1), 5) })).reverse();

  return (
    <div className="panel">
      <h2>Solves</h2>
      <div className="log">
        {!solves.length ? (
          <p className="empty-log">No solves yet. Your times, Ao5 at each solve and penalties will be listed here.</p>
        ) : (
          <table><tbody>
            {rows.map(({ s, i, ao }) => (
              <tr key={s.at + "-" + i} className="row" onClick={e => { if (!(e.target as Element).closest("button")) setOpen(i); }}>
                <td className="n">{i + 1}</td>
                <td className={s.pen === DNF ? "dnf" : ""}>
                  <button type="button" className="row-open" aria-label={`Solve ${i + 1} details`} onClick={() => setOpen(i)}>
                    {s.pen === DNF ? <>DNF <span className="raw">({fmt(s.t)})</span></> : <>{fmt(eff(s))}{s.pen === 2 && <span className="pen-tag">+</span>}</>}
                  </button>
                  {s.note && <span className="note-mark" title={s.note} aria-label="Has a note">✎</span>}
                </td>
                <td className="ao">{ao == null ? "" : fmt(ao)}</td>
                <td className="act">
                  <PenaltyButtons i={i} solve={s} compact onPenalty={onPenalty} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
      {open != null && open < solves.length && (
        <SolveDetail solves={solves} i={open} puzzle={puzzle} onPenalty={onPenalty} onNote={onNote}
          onDelete={j => { onDelete(j); setOpen(null); }} onNavigate={setOpen} onClose={close} />
      )}
    </div>
  );
}
