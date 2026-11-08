import { Fragment, useState } from "react";
import { avgOf, DNF, eff, fmt, type Penalty, type Solve } from "../lib/stats";

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

export function SolveList({ solves, onPenalty, onDelete }: Props) {
  const [open, setOpen] = useState(-1);
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
              <Fragment key={s.at + "-" + i}>
                <tr className="row" onClick={e => { if (!(e.target as Element).closest("button")) setOpen(open === i ? -1 : i); }}>
                  <td className="n">{i + 1}</td>
                  <td className={s.pen === DNF ? "dnf" : ""}>
                    {s.pen === DNF ? <>DNF <span className="raw">({fmt(s.t)})</span></> : <>{fmt(eff(s))}{s.pen === 2 && <span className="pen-tag">+</span>}</>}
                  </td>
                  <td className="ao">{ao == null ? "" : fmt(ao)}</td>
                  <td className="act">
                    <PenaltyButtons i={i} solve={s} compact onPenalty={(j, p) => { onPenalty(j, p); }} onDelete={j => { setOpen(-1); onDelete(j); }} />
                  </td>
                </tr>
                {open === i && <tr className="scr"><td></td><td colSpan={3}>{s.scr}</td></tr>}
              </Fragment>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  );
}
