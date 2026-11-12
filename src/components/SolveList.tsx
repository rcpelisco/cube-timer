import { memo, useCallback, useMemo, useState } from "react";
import { avgOf, DNF, eff, fmt, rolling, type Penalty, type Solve } from "../lib/stats";
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

// Rows shown at first, and added by each "Show more": thousands of rows at once make the page slow.
const PAGE = 100;

// Solves, newest first. Tap a row for the solve's details: scramble, picture, note.
// memo: the timer re-renders the app every frame while it runs; this only needs to when the solves change.
export const SolveList = memo(function SolveList({ solves, puzzle, cube, onPenalty, onDelete, onNote }: Props & {
  puzzle: PuzzleId; cube?: string; onNote: (i: number, note: string) => void;
}) {
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
    <div className="panel">
      <h2>Solves</h2>
      <div className="log">
        {!solves.length ? (
          <p className="empty-log">No solves yet. Your times, Ao5 at each solve and penalties will be listed here.</p>
        ) : (
          <table><tbody>
            {rows.map(({ s, i, ao }) => (
              <tr key={s.at + "-" + i} className="row" onClick={e => { if (!(e.target as Element).closest("button")) openRow(i, e.currentTarget); }}>
                <td className="n">{i + 1}</td>
                <td className={s.pen === DNF ? "dnf" : ""}>
                  <button type="button" className="row-open" aria-label={`Solve ${i + 1} details`} onClick={e => openRow(i, e.currentTarget.closest("tr")!)}>
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
        {hidden > 0 && (
          <button type="button" className="show-more" onClick={() => setLimit(l => l + PAGE * 5)}>
            Show {Math.min(hidden, PAGE * 5)} more · {hidden} older
          </button>
        )}
      </div>
      {open != null && open < solves.length && (
        <SolveDetail solves={solves} i={open} puzzle={puzzle} cube={cube} origin={origin} onPenalty={onPenalty} onNote={onNote}
          onDelete={j => { onDelete(j); setOpen(null); }} onNavigate={setOpen} onClose={close} />
      )}
    </div>
  );
});
