import { solveKey, type Session } from "./sessions";
import { DNF, eff, fmt, type Solve } from "./stats";

// Deleting and moving solves (and deleting sessions), each with a way to undo it.
// Solves are found by solveKey rather than by position, and an undo works on the sessions as they
// are by then, so solves added since (or changes synced from another device) are kept.

export interface Edit {
  sessions: Session[];
  undo: Undo | null; // null when nothing changed
}
export interface Undo {
  label: string; // e.g. "Deleted 12.34", "Moved 3 solves to One-handed"
  apply: (sessions: Session[]) => Session[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const timeOf = (s: Solve) => (s.pen === DNF ? "a DNF" : `${fmt(eff(s))}${s.pen === 2 ? "+" : ""}`);

// The session with these solves added back in time order, skipping any it already has.
export function withSolves(session: Session, solves: Solve[]): Session {
  const have = new Set(session.solves.map(solveKey));
  const add = solves.filter(s => !have.has(solveKey(s)));
  if (!add.length) return session;
  return { ...session, solves: [...session.solves, ...add].sort((a, b) => a.at - b.at) };
}

function withoutSolves(session: Session, keys: Set<string>): Session {
  const solves = session.solves.filter(s => !keys.has(solveKey(s)));
  return solves.length === session.solves.length ? session : { ...session, solves };
}

const mapSession = (list: Session[], id: string, fn: (s: Session) => Session) =>
  list.map(s => (s.id === id ? fn(s) : s));

// Deletes the given solves (by solveKey) from a session. `cleared`: the whole session was emptied.
export function deleteSolves(list: Session[], sid: string, keys: Set<string>, cleared = false): Edit {
  const session = list.find(s => s.id === sid);
  const removed = session?.solves.filter(s => keys.has(solveKey(s))) ?? [];
  if (!session || !removed.length) return { sessions: list, undo: null };
  const label = cleared ? `Cleared ${plural(removed.length, "solve")}`
    : removed.length === 1 ? `Deleted ${timeOf(removed[0])}` : `Deleted ${plural(removed.length, "solve")}`;
  return {
    sessions: mapSession(list, sid, s => withoutSolves(s, keys)),
    undo: { label, apply: l => mapSession(l, sid, s => withSolves(s, removed)) },
  };
}

// Moves the given solves to another session, where they go in by date.
export function moveSolves(list: Session[], fromId: string, toId: string, keys: Set<string>): Edit {
  const from = list.find(s => s.id === fromId), to = list.find(s => s.id === toId);
  const moving = from?.solves.filter(s => keys.has(solveKey(s))) ?? [];
  if (!from || !to || fromId === toId || !moving.length) return { sessions: list, undo: null };
  const moved = new Set(moving.map(solveKey));
  return {
    sessions: list.map(s => (s.id === fromId ? withoutSolves(s, moved) : s.id === toId ? withSolves(s, moving) : s)),
    undo: {
      label: `Moved ${moving.length === 1 ? timeOf(moving[0]) : plural(moving.length, "solve")} to ${to.name}`,
      apply: l => l.map(s => (s.id === toId ? withoutSolves(s, moved) : s.id === fromId ? withSolves(s, moving) : s)),
    },
  };
}

// Deletes a session (never the last one). Undo puts it back where it was.
export function deleteSession(list: Session[], sid: string): Edit {
  const i = list.findIndex(s => s.id === sid);
  if (i < 0 || list.length <= 1) return { sessions: list, undo: null };
  const session = list[i];
  return {
    sessions: list.filter(s => s.id !== sid),
    undo: {
      label: `Deleted session ${session.name}`,
      apply: l => (l.some(s => s.id === sid) ? l : [...l.slice(0, i), session, ...l.slice(i)]),
    },
  };
}
