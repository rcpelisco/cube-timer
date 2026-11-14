import { describe, expect, it } from "vitest";
import { splitTriggers, TRIGGERS } from "./triggers";

// The algorithm as "[moves]Name" for triggers and plain moves between them.
const show = (alg: string) => splitTriggers(alg).map(p => (p.trigger ? `[${p.moves}]${p.trigger.name}` : p.moves)).join(" | ");

describe("splitTriggers", () => {
  it("finds a whole Sune, not the shorter triggers inside it", () => {
    expect(show("R U R' U R U2 R'")).toBe("[R U R' U R U2 R']Sune");
  });

  it("marks inserts between other moves", () => {
    expect(show("U' R U R' U2 R U' R'")).toBe("U' | [R U R']R insert | U2 | [R U' R']R insert");
    expect(show("F' U' F")).toBe("[F' U' F]F' insert");
  });

  it("finds F sexy as one trigger rather than a sexy inside F … F'", () => {
    expect(show("F R U R' U' F'")).toBe("[F R U R' U' F']F sexy");
    expect(show("f R U R' U' f' U' F R U R' U' F'")).toBe("[f R U R' U' f']Wide F sexy | U' | [F R U R' U' F']F sexy");
  });

  it("covers the most moves when a greedy left-to-right match wouldn't", () => {
    // Nb perm. Taking "R' U R" (an insert) at the start would split the Inverse sexy that starts
    // a move later, and cover a move less.
    expect(show("R' U R U' R' F' U' F R U R' F R' F' R U' R"))
      .toBe("R' | [U R U' R']Inverse sexy | [F' U' F]F' insert | [R U R']R insert | [F R' F' R]Hedgeslammer | U' R");
  });

  it("doesn't mark moves made while the cube is turned on its side", () => {
    expect(show("x R' U R' D2 R U' R' D2 R2 x'")).toBe("x R' U R' D2 R U' R' D2 R2 x'");
    expect(show("y R U R'")).toBe("y | [R U R']R insert");
  });

  it("keeps every move, in order", () => {
    const alg = "y' R U' R2 D' r U r' D R2 U R'";
    expect(splitTriggers(alg).map(p => p.moves).join(" ")).toBe(alg);
  });

  it("has no two triggers with the same moves", () => {
    const moves = TRIGGERS.map(t => t.moves);
    expect(new Set(moves).size).toBe(moves.length);
  });
});
