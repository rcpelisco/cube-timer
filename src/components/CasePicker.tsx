import { useState } from "react";
import type { AlgCase } from "../lib/algs";
import { mainAlg, type AlgChoices } from "../lib/algChoice";
import type { CrossColor } from "../lib/crossColor";
import { CaseDiagram } from "./CaseDiagram";

// Choose exactly which cases the trainer uses: tap cases one by one, or a whole group at once.
// `picked` null means every case (so cases you haven't seen yet are included too).
export function CasePicker({ cases, allIds, picked, onChange, choices, cross }: {
  cases: AlgCase[];                  // the cases matching the status filter
  allIds: string[];                  // every case in the set, shown or not
  picked: string[] | null;
  onChange: (ids: string[] | null) => void;
  choices: AlgChoices; cross: CrossColor;
}) {
  const [open, setOpen] = useState(false);
  const isOn = (id: string) => picked === null || picked.includes(id);
  const chosen = cases.filter(c => isOn(c.id)).length;

  const groups: [string, AlgCase[]][] = [];
  for (const c of cases) {
    const g = groups.find(([name]) => name === c.group);
    if (g) g[1].push(c); else groups.push([c.group, [c]]);
  }

  // Changes start from "everything" when nothing has been picked yet, and go back to "everything"
  // once every case is picked again.
  const base = () => new Set(picked ?? allIds);
  const commit = (ids: Set<string>) => onChange(allIds.every(id => ids.has(id)) ? null : [...ids]);
  const toggle = (id: string) => {
    const ids = base();
    if (ids.has(id)) ids.delete(id); else ids.add(id);
    commit(ids);
  };
  const toggleGroup = (list: AlgCase[]) => {
    const ids = base();
    const allOn = list.every(c => ids.has(c.id));
    for (const c of list) if (allOn) ids.delete(c.id); else ids.add(c.id);
    commit(ids);
  };

  const summary = picked === null || chosen === cases.length ? `All ${cases.length}` : `${chosen} of ${cases.length}`;

  return (
    <div className="case-picker">
      <button type="button" className="case-picker-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>Cases <b>{summary}</b></span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={open ? "flip" : ""}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="case-picker-panel panel">
          <div className="case-picker-quick" role="group" aria-label="Select cases">
            <button type="button" onClick={() => onChange(null)}>All</button>
            <button type="button" onClick={() => onChange([])}>None</button>
            {groups.map(([name, list]) => {
              const n = list.filter(c => isOn(c.id)).length;
              return (
                <button key={name} type="button" className={n === list.length ? "on" : ""} aria-pressed={n === list.length}
                  onClick={() => toggleGroup(list)}>
                  {name} <span>{n}/{list.length}</span>
                </button>
              );
            })}
          </div>
          <div className="case-picker-grid">
            {cases.map(c => (
              <button key={c.id} type="button" className={`case-pick${isOn(c.id) ? " on" : ""}`} aria-pressed={isOn(c.id)}
                onClick={() => toggle(c.id)}>
                <CaseDiagram c={c} alg={mainAlg(c, choices)} cross={cross} className="case-pick-diagram" />
                <span>{c.name.replace(/ perm$/, "")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
