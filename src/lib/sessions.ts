import type { Solve } from "./stats";
import type { PuzzleId } from "./puzzles";

// puzzle: which puzzle the session is for (scrambles and preview follow it); missing on
// sessions from before puzzles existed, which are 3×3 (see toPuzzle).
// cube: the physical puzzle used for the session, e.g. "GAN 12 M". Omitted when not set
// (Firestore rejects undefined fields, so the key is left out rather than set to undefined).
export interface Session {
  id: string; name: string; createdAt: number; solves: Solve[]; puzzle?: PuzzleId; cube?: string;
  // A "sub-X" target in ms (e.g. 12000 for sub-12); left out when there is none.
  goal?: number;
}

// The session with `goal` set, or removed for null.
export function withGoal(session: Session, goal: number | null): Session {
  const rest = { ...session };
  delete rest.goal;
  return goal && goal > 0 ? { ...rest, goal } : rest;
}

// crypto.randomUUID needs a secure context, which a phone on the LAN dev server isn't.
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function newSession(name: string, { solves = [], cube = "", puzzle = "333" }: { solves?: Solve[]; cube?: string; puzzle?: PuzzleId } = {}): Session {
  return withCube({ id: newId(), name, createdAt: Date.now(), solves, puzzle }, cube);
}

export function withCube(session: Session, cube: string): Session {
  const rest = { ...session };
  delete rest.cube;
  const trimmed = cube.trim();
  return trimmed ? { ...rest, cube: trimmed } : rest;
}

// Distinct cube names already used, for suggestions.
export function knownCubes(sessions: Session[]): string[] {
  return [...new Set(sessions.map(s => s.cube).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
}

export function nextName(sessions: Session[]): string {
  const taken = new Set(sessions.map(s => s.name));
  let n = sessions.length + 1;
  while (taken.has(`Session ${n}`)) n++;
  return `Session ${n}`;
}

// Merge used on sign-in: cloud sessions win, plus anything local that is newer than the last sync.
const solveKey = (s: Solve) => `${s.at}:${s.t}`;
const isDefaultName = (name: string) => /^Session \d+$/.test(name);

export function mergeSessions(remote: Session[], local: Session[], since: number): Session[] {
  const merged = remote.map(r => {
    const l = local.find(s => s.id === r.id);
    if (!l) return r;
    const known = new Set(r.solves.map(solveKey));
    const extra = l.solves.filter(s => !known.has(solveKey(s)) && s.at > since);
    return extra.length ? { ...r, solves: [...r.solves, ...extra].sort((a, b) => a.at - b.at) } : r;
  });
  for (const l of local) {
    if (remote.some(r => r.id === l.id)) continue;
    const newSolves = l.solves.some(s => s.at > since);
    // Skip each device's untouched "Session 1" so signing in doesn't pile up empty duplicates.
    const newSession = l.createdAt > since && (l.solves.length > 0 || !isDefaultName(l.name));
    if (newSolves || newSession) merged.push(l);
  }
  return merged;
}
