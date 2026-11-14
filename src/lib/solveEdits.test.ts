import { describe, expect, it } from "vitest";
import { deleteSession, deleteSolves, moveSolves, withSolves } from "./solveEdits";
import { solveKey, type Session } from "./sessions";
import type { Solve } from "./stats";

const solve = (at: number, t = 10000, pen: Solve["pen"] = 0): Solve => ({ t, pen, scr: "R U", at });
const session = (id: string, solves: Solve[], name = id): Session => ({ id, name, createdAt: 0, solves, puzzle: "333" });
const keys = (...s: Solve[]) => new Set(s.map(solveKey));
const ats = (list: Session[], id: string) => list.find(s => s.id === id)!.solves.map(s => s.at);

const a = [solve(1), solve(2, 12340), solve(3), solve(4)];
const b = [solve(5)];
const start = () => [session("main", a, "Main"), session("oh", b, "One-handed")];

describe("deleteSolves", () => {
  it("deletes by key and undoes back into place", () => {
    const edit = deleteSolves(start(), "main", keys(a[1]));
    expect(ats(edit.sessions, "main")).toEqual([1, 3, 4]);
    expect(edit.undo!.label).toBe("Deleted 12.34");
    expect(ats(edit.undo!.apply(edit.sessions), "main")).toEqual([1, 2, 3, 4]);
  });

  it("keeps solves added after the delete when undoing", () => {
    const edit = deleteSolves(start(), "main", keys(a[0], a[2]));
    expect(edit.undo!.label).toBe("Deleted 2 solves");
    const later = edit.sessions.map(s => (s.id === "main" ? { ...s, solves: [...s.solves, solve(9)] } : s));
    expect(ats(edit.undo!.apply(later), "main")).toEqual([1, 2, 3, 4, 9]);
  });

  it("names a clear, a DNF and a +2", () => {
    expect(deleteSolves(start(), "main", keys(...a), true).undo!.label).toBe("Cleared 4 solves");
    expect(deleteSolves([session("x", [solve(1, 9000, -1)])], "x", keys(solve(1, 9000, -1))).undo!.label).toBe("Deleted a DNF");
    expect(deleteSolves([session("x", [solve(1, 9000, 2)])], "x", keys(solve(1, 9000, 2))).undo!.label).toBe("Deleted 11.00+");
  });

  it("does nothing for solves that aren't there", () => {
    const list = start();
    const edit = deleteSolves(list, "main", keys(solve(99)));
    expect(edit.sessions).toBe(list);
    expect(edit.undo).toBeNull();
  });

  it("undoing twice doesn't add solves twice", () => {
    const edit = deleteSolves(start(), "main", keys(a[1]));
    const once = edit.undo!.apply(edit.sessions);
    expect(ats(edit.undo!.apply(once), "main")).toEqual([1, 2, 3, 4]);
  });
});

describe("moveSolves", () => {
  it("moves solves into the other session by date, and undoes the move", () => {
    const edit = moveSolves(start(), "main", "oh", keys(a[2], a[3]));
    expect(ats(edit.sessions, "main")).toEqual([1, 2]);
    expect(ats(edit.sessions, "oh")).toEqual([3, 4, 5]);
    expect(edit.undo!.label).toBe("Moved 2 solves to One-handed");
    const undone = edit.undo!.apply(edit.sessions);
    expect(ats(undone, "main")).toEqual([1, 2, 3, 4]);
    expect(ats(undone, "oh")).toEqual([5]);
  });

  it("names a single solve", () => {
    expect(moveSolves(start(), "main", "oh", keys(a[1])).undo!.label).toBe("Moved 12.34 to One-handed");
  });

  it("does nothing to the same session or a missing one", () => {
    expect(moveSolves(start(), "main", "main", keys(a[0])).undo).toBeNull();
    expect(moveSolves(start(), "main", "gone", keys(a[0])).undo).toBeNull();
  });
});

describe("deleteSession", () => {
  it("deletes a session and puts it back where it was", () => {
    const list = [...start(), session("two", [])];
    const edit = deleteSession(list, "oh");
    expect(edit.sessions.map(s => s.id)).toEqual(["main", "two"]);
    expect(edit.undo!.label).toBe("Deleted session One-handed");
    expect(edit.undo!.apply(edit.sessions).map(s => s.id)).toEqual(["main", "oh", "two"]);
  });

  it("never deletes the last session", () => {
    expect(deleteSession([session("main", a)], "main").undo).toBeNull();
  });
});

describe("withSolves", () => {
  it("adds in time order without duplicates", () => {
    const s = withSolves(session("x", [solve(1), solve(5)]), [solve(3), solve(5), solve(0)]);
    expect(s.solves.map(v => v.at)).toEqual([0, 1, 3, 5]);
  });
});
