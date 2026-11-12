import { useCallback, useState } from "react";
import { newSession, withCube, withGoal, type Session } from "../lib/sessions";
import { toPuzzle, type PuzzleId } from "../lib/puzzles";
import type { Solve } from "../lib/stats";

export interface SessionFields { name: string; cube: string; puzzle: PuzzleId }

export function useSessions(initial: { sessions: Session[]; currentId: string }) {
  const [sessions, setSessionsRaw] = useState<Session[]>(initial.sessions);
  const [currentId, setCurrentId] = useState(initial.currentId);
  // Falls back to the first session if the current one was deleted (here or on another device).
  const current = sessions.find(s => s.id === currentId) ?? sessions[0];
  const id = current.id;

  // There is always at least one session.
  const setSessions = useCallback((list: Session[]) => {
    setSessionsRaw(list.length ? list : [newSession("Session 1")]);
  }, []);

  const setSolves = useCallback((fn: (list: Solve[]) => Solve[]) => {
    setSessionsRaw(list => list.map(s => (s.id === id ? { ...s, solves: fn(s.solves) } : s)));
  }, [id]);

  const create = useCallback(({ name, cube, puzzle }: SessionFields) => {
    const s = newSession(name, { cube, puzzle });
    setSessionsRaw(list => [...list, s]);
    setCurrentId(s.id);
  }, []);

  // The puzzle only changes while the session is empty, so times for different puzzles never mix.
  const update = useCallback((sid: string, { name, cube, puzzle }: SessionFields) => {
    setSessionsRaw(list => list.map(s => (s.id === sid
      ? withCube({ ...s, name, puzzle: s.solves.length ? toPuzzle(s.puzzle) : puzzle }, cube)
      : s)));
  }, []);

  const setGoal = useCallback((sid: string, goal: number | null) => {
    setSessionsRaw(list => list.map(s => (s.id === sid ? withGoal(s, goal) : s)));
  }, []);

  const remove = useCallback((sid: string) => {
    setSessionsRaw(list => {
      if (list.length <= 1) return list;
      const i = list.findIndex(s => s.id === sid);
      const next = list.filter(s => s.id !== sid);
      if (sid === id) setCurrentId(next[Math.max(0, i - 1)].id);
      return next;
    });
  }, [id]);

  return { sessions, current, setSessions, setSolves, select: setCurrentId, create, update, remove, setGoal };
}
