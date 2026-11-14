import { describe, expect, it } from "vitest";
import { puzzles } from "cubing/puzzles";
import { caseScramble, withoutRotations } from "./trainer";
import { PAR4 } from "./algs4x4";
import { CROSS_COLORS } from "./crossColor";

const ROTATIONS = ["", "y", "y2", "y'"].flatMap(a => ["", "x", "x2", "x'", "z", "z'"].map(b => `${a} ${b}`.trim()));

describe("4×4 trainer scrambles", () => {
  it("writes out whole-cube turns without changing what the moves do", async () => {
    const kp = await puzzles["4x4x4"].kpuzzle();
    const solved = kp.defaultPattern();
    const moves = ["R", "U'", "F2", "Rw", "2L'", "2-3L", "l", "Dw2", "B", "x", "y'", "z2", "x'", "z"];
    for (let n = 0; n < 50; n++) {
      const alg = Array.from({ length: 12 }, () => moves[Math.floor(Math.random() * moves.length)]).join(" ");
      const plain = withoutRotations(alg);
      expect(plain).not.toMatch(/[xyz]/);
      const want = solved.applyAlg(alg);
      expect(ROTATIONS.some(r => solved.applyAlg(plain).applyAlg(r).isIdentical(want)), alg).toBe(true);
    }
  });

  it("makes a 4×4 scramble with no whole-cube turns for every parity case and cross color", async () => {
    const kp = await puzzles["4x4x4"].kpuzzle();
    for (const c of PAR4) for (const cross of CROSS_COLORS) {
      const s = await caseScramble(c.algs[0], cross.id, "PAR4");
      expect(s).not.toMatch(/[xyz]|2'/);
      expect(() => kp.defaultPattern().applyAlg(s)).not.toThrow();
    }
  });
});
