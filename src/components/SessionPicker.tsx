import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { knownCubes, nextName, type Session } from "../lib/sessions";
import { PUZZLE_ORDER, PUZZLES, toPuzzle, type PuzzleId } from "../lib/puzzles";
import type { SessionFields } from "../hooks/useSessions";
import { avgOf, fmt } from "../lib/stats";

export interface SessionPickerProps {
  list: Session[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: (fields: SessionFields) => void;
  onUpdate: (id: string, fields: SessionFields) => void;
  onDelete: (id: string) => void;
}

const MAX_NAME = 40;
const CUBE_LIST_ID = "cube-suggestions";

export function SessionPicker({ list, currentId, onSelect, onCreate, onUpdate, onDelete }: SessionPickerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftCube, setDraftCube] = useState("");
  const [draftPuzzle, setDraftPuzzle] = useState<PuzzleId | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = list.find(s => s.id === currentId) ?? list[0];
  const cubes = knownCubes(list);
  // New sessions default to the puzzle you're on.
  const newPuzzle = draftPuzzle ?? toPuzzle(current.puzzle);

  useEffect(() => {
    if (!open) { setEditing(null); setConfirming(null); setDraft(""); setDraftCube(""); setDraftPuzzle(null); return; }
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const create = (e: FormEvent) => {
    e.preventDefault();
    onCreate({ name: draft.trim().slice(0, MAX_NAME) || nextName(list), cube: draftCube.slice(0, MAX_NAME), puzzle: newPuzzle });
    setOpen(false);
  };

  return (
    <div className="session-picker" ref={ref}>
      <button type="button" className="session-trigger" aria-haspopup="true" aria-expanded={open}
        title={current.cube ? `${current.name} · ${current.cube}` : current.name} onClick={() => setOpen(o => !o)}>
        <PuzzleBadge puzzle={toPuzzle(current.puzzle)} />
        <span className="session-trigger-name">{current.name}</span>
        <span className="session-trigger-count">{current.solves.length}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>

      {open && (
        <div className="session-menu">
          <div className="session-menu-head">Sessions</div>
          <datalist id={CUBE_LIST_ID}>{cubes.map(c => <option key={c} value={c} />)}</datalist>
          <ul className="session-list">
            {list.map(s => {
              const ao5 = avgOf(s.solves, 5);
              return (
                <li key={s.id} className={s.id === current.id ? "current" : ""}>
                  {editing === s.id ? (
                    <EditForm session={s} onCancel={() => setEditing(null)}
                      onSave={f => { onUpdate(s.id, { ...f, name: f.name || s.name }); setEditing(null); }} />
                  ) : confirming === s.id ? (
                    <div className="session-confirm">
                      <span>Delete “{s.name}” and its {s.solves.length} {s.solves.length === 1 ? "solve" : "solves"}?</span>
                      <div className="session-confirm-actions">
                        <button type="button" onClick={() => setConfirming(null)}>Keep</button>
                        <button type="button" className="danger on" onClick={() => { onDelete(s.id); setConfirming(null); }}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="session-row" onClick={() => { onSelect(s.id); setOpen(false); }}>
                        <span className="session-name"><PuzzleBadge puzzle={toPuzzle(s.puzzle)} /> {s.name}</span>
                        {s.cube && <span className="session-cube"><CubeGlyph /> {s.cube}</span>}
                        <span className="session-meta">
                          {s.solves.length} {s.solves.length === 1 ? "solve" : "solves"}{ao5 != null && ` · Ao5 ${fmt(ao5)}`}
                        </span>
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.id)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5 13.5 5 6 12.5H3.5V10z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete ${s.name}`} disabled={list.length === 1}
                        title={list.length === 1 ? "You need at least one session" : undefined}
                        onClick={() => (s.solves.length ? setConfirming(s.id) : onDelete(s.id))}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <form className="session-new" onSubmit={create}>
            <div className="session-fields">
              <PuzzleChoice value={newPuzzle} onChange={setDraftPuzzle} />
              <input id="new-session-name" type="text" value={draft} maxLength={MAX_NAME} placeholder={nextName(list)}
                aria-label="New session name" onChange={e => setDraft(e.target.value)} />
              <input id="new-session-cube" type="text" value={draftCube} maxLength={MAX_NAME} placeholder="Cube (optional)"
                list={CUBE_LIST_ID} aria-label="Cube used in the new session" autoComplete="off" onChange={e => setDraftCube(e.target.value)} />
            </div>
            <button type="submit">New session</button>
          </form>
        </div>
      )}
    </div>
  );
}

function EditForm({ session, onSave, onCancel }: { session: Session; onSave: (fields: SessionFields) => void; onCancel: () => void }) {
  const [name, setName] = useState(session.name);
  const [cube, setCube] = useState(session.cube ?? "");
  const [puzzle, setPuzzle] = useState(toPuzzle(session.puzzle));
  const locked = session.solves.length > 0;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const esc = (e: ReactKeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };

  return (
    <form className="session-edit" onSubmit={e => { e.preventDefault(); onSave({ name: name.trim().slice(0, MAX_NAME), cube: cube.slice(0, MAX_NAME), puzzle }); }}>
      <div className="session-fields">
        <PuzzleChoice value={puzzle} onChange={setPuzzle} disabled={locked} />
        {locked && <span className="session-note">The puzzle can't change once a session has solves.</span>}
        <input ref={input} type="text" value={name} maxLength={MAX_NAME} aria-label="Session name"
          onChange={e => setName(e.target.value)} onKeyDown={esc} />
        <input type="text" value={cube} maxLength={MAX_NAME} placeholder="Cube (optional)" list={CUBE_LIST_ID}
          aria-label="Cube used in this session" autoComplete="off" onChange={e => setCube(e.target.value)} onKeyDown={esc} />
      </div>
      <div className="session-confirm-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="on">Save</button>
      </div>
    </form>
  );
}

function PuzzleChoice({ value, onChange, disabled }: { value: PuzzleId; onChange: (p: PuzzleId) => void; disabled?: boolean }) {
  return (
    <div className="puzzle-choice" role="radiogroup" aria-label="Puzzle">
      {PUZZLE_ORDER.map(p => (
        <button key={p} type="button" role="radio" aria-checked={p === value} className={p === value ? "on" : ""}
          disabled={disabled && p !== value} onClick={() => onChange(p)}>
          {PUZZLES[p].label}
        </button>
      ))}
    </div>
  );
}

export function PuzzleBadge({ puzzle }: { puzzle: PuzzleId }) {
  return <span className={`puzzle-badge puzzle-${puzzle}`}>{PUZZLES[puzzle].label}</span>;
}

export function CubeGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1 11 3.5v5L6 11 1 8.5v-5z M1 3.5 6 6l5-2.5 M6 6v5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}
