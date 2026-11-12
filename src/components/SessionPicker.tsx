import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { knownCubes, nextName, type Session } from "../lib/sessions";
import { PUZZLE_ORDER, PUZZLES, toPuzzle, type PuzzleId } from "../lib/puzzles";
import type { SessionFields } from "../hooks/useSessions";
import { useLeave } from "../hooks/useLeave";
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

// Header button that opens the sessions menu.
export function SessionPicker(props: SessionPickerProps) {
  const { list, currentId } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = list.find(s => s.id === currentId) ?? list[0];
  const { leaving, close } = useLeave(() => setOpen(false), 120);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, [open, close]);

  return (
    <div className="session-picker" ref={ref}>
      <button type="button" className="session-trigger" aria-haspopup="true" aria-expanded={open}
        title={current.cube ? `${current.name} · ${current.cube}` : current.name} onClick={() => (open ? close() : setOpen(true))}>
        <PuzzleBadge puzzle={toPuzzle(current.puzzle)} />
        <span className="session-trigger-name">{current.name}</span>
        <span className="session-trigger-count">{current.solves.length}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>

      {open && (
        <div className={`session-menu${leaving ? " leaving" : ""}`}>
          <div className="session-menu-head">Sessions</div>
          <SessionManager {...props} onDone={close} />
        </div>
      )}
    </div>
  );
}

// The session list (switch, edit, delete) and the new-session form. Used in the header menu and
// on the Settings page; onDone runs after switching or creating (the menu closes then).
// Sessions show as cards, and the new-session form stays folded behind a button until needed.
// currentActions (e.g. Copy times / Clear solves) show inside the current session's card, and
// onExport adds an export button to each card (both only on the Settings page).
export function SessionManager({ list, currentId, onSelect, onCreate, onUpdate, onDelete, onDone, currentActions, onExport }: SessionPickerProps & {
  onDone?: () => void; currentActions?: ReactNode; onExport?: (session: Session) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftCube, setDraftCube] = useState("");
  const [draftPuzzle, setDraftPuzzle] = useState<PuzzleId | null>(null);
  const cubeListId = CUBE_LIST_ID + useId();
  const current = list.find(s => s.id === currentId) ?? list[0];
  const cubes = knownCubes(list);
  // New sessions default to the puzzle you're on.
  const newPuzzle = draftPuzzle ?? toPuzzle(current.puzzle);

  const create = (e: FormEvent) => {
    e.preventDefault();
    onCreate({ name: draft.trim().slice(0, MAX_NAME) || nextName(list), cube: draftCube.slice(0, MAX_NAME), puzzle: newPuzzle });
    setDraft(""); setDraftCube(""); setDraftPuzzle(null); setAdding(false);
    onDone?.();
  };
  const cancelNew = () => { setDraft(""); setDraftCube(""); setDraftPuzzle(null); setAdding(false); };

  return (
        <>
          <datalist id={cubeListId}>{cubes.map(c => <option key={c} value={c} />)}</datalist>
          <ul className="session-list">
            {list.map(s => {
              const ao5 = avgOf(s.solves, 5);
              return (
                <li key={s.id} className={s.id === current.id ? "current" : ""}>
                  {editing === s.id ? (
                    <EditForm session={s} cubeListId={cubeListId} onCancel={() => setEditing(null)}
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
                      <button type="button" className="session-row" aria-current={s.id === current.id ? "true" : undefined}
                        onClick={() => { onSelect(s.id); onDone?.(); }}>
                        <span className="session-name">
                          <PuzzleBadge puzzle={toPuzzle(s.puzzle)} /> <span className="session-name-text">{s.name}</span>
                        </span>
                        {s.cube && <span className="session-cube"><CubeGlyph /> {s.cube}</span>}
                        <span className="session-meta">
                          {s.solves.length.toLocaleString()} {s.solves.length === 1 ? "solve" : "solves"}{ao5 != null && ` · Ao5 ${fmt(ao5)}`}
                        </span>
                      </button>
                      {onExport && (
                        <button type="button" className="icon-btn" aria-label={`Export ${s.name}`} disabled={!s.solves.length}
                          title={s.solves.length ? "Export this session as a csTimer file" : "No solves to export"} onClick={() => onExport(s)}>
                          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7.5M4.8 6.8 8 10l3.2-3.2M3 11.5v2h10v-2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      )}
                      <button type="button" className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.id)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5 13.5 5 6 12.5H3.5V10z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete ${s.name}`} disabled={list.length === 1}
                        title={list.length === 1 ? "You need at least one session" : undefined}
                        onClick={() => (s.solves.length ? setConfirming(s.id) : onDelete(s.id))}>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                      </button>
                      {currentActions && s.id === current.id && <div className="session-current-actions">{currentActions}</div>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {!adding ? (
            <button type="button" className="session-add" onClick={() => setAdding(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              New session
            </button>
          ) : (
            <form className="session-new page" onSubmit={create}>
              <span className="label">New session</span>
              <div className="session-fields">
                <PuzzleChoice value={newPuzzle} onChange={setDraftPuzzle} />
                <input type="text" value={draft} maxLength={MAX_NAME} placeholder={nextName(list)} autoFocus
                  aria-label="New session name" onChange={e => setDraft(e.target.value)} />
                <input type="text" value={draftCube} maxLength={MAX_NAME} placeholder="Cube (optional)"
                  list={cubeListId} aria-label="Cube used in the new session" autoComplete="off" onChange={e => setDraftCube(e.target.value)} />
              </div>
              <div className="session-confirm-actions">
                <button type="button" onClick={cancelNew}>Cancel</button>
                <button type="submit" className="on">Create</button>
              </div>
            </form>
          )}
        </>
  );
}

function EditForm({ session, cubeListId, onSave, onCancel }: { session: Session; cubeListId: string; onSave: (fields: SessionFields) => void; onCancel: () => void }) {
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
        <input type="text" value={cube} maxLength={MAX_NAME} placeholder="Cube (optional)" list={cubeListId}
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
