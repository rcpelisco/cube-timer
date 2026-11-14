import { describe, expect, it } from "vitest";
import { checkAlg, tidyAlg } from "./algCheck";
import { ALGS } from "./algs";

const find = (set: keyof typeof ALGS, id: string) => ALGS[set].find(c => c.id === id)!;
const ok = async (set: keyof typeof ALGS, id: string, alg: string) => checkAlg(find(set, id), alg, []);

describe("checkAlg", () => {
  it("accepts every listed algorithm for its own case", async () => {
    for (const set of Object.keys(ALGS) as (keyof typeof ALGS)[])
      for (const c of ALGS[set])
        for (const alg of c.algs) expect((await checkAlg(c, alg, [])).ok, `${c.name}: ${alg}`).toBe(true);
  }, 60_000);

  it("accepts an algorithm that starts from another turn of the top", async () => {
    // T perm done from the back: needs a U2 first.
    expect((await ok("PLL", "pll-t", "R U R' U' R' F R2 U' R' U' R U R' F'")).ok).toBe(true);
    expect((await ok("PLL", "pll-t", "U2 R U R' U' R' F R2 U' R' U' R U R' F'")).ok).toBe(true);
  });

  it("rejects an algorithm for another case, with the reason", async () => {
    const r = await ok("PLL", "pll-t", "R U R' U R U2 R'");
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("doesn't solve T perm") });
  });

  it("rejects bad notation, moves a 2×2 doesn't have, and repeats", async () => {
    expect((await ok("PLL", "pll-t", "R U Q")).ok).toBe(false);
    expect((await ok("OLL2", "oll2-sune", "r U R' U R U2 r'")).ok).toBe(false);
    const t = find("PLL", "pll-t");
    expect(await checkAlg(t, "R U R' U' R' F R2 U' R' U' R U R' F'", t.algs)).toEqual({ ok: false, reason: expect.stringContaining("already listed") });
  });

  it("checks F2L by the first two layers only", async () => {
    const c = ALGS.F2L[0];
    expect((await checkAlg(c, `${c.algs[0]} R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'`, [])).ok).toBe(true);
    expect((await checkAlg(c, "R U R' U'", [])).ok).toBe(false);
  });

  it("checks 4×4 parity on a 4×4", async () => {
    expect((await ok("PAR4", "par4-pll", "2R2 U2 2R2 Uw2 2R2 Uw2 U2")).ok).toBe(true);
    expect((await ok("PAR4", "par4-oll", "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2")).ok).toBe(false);
  });

  it("tidies quotes, spaces and R2'", async () => {
    expect(tidyAlg("  R  U’ R` ")).toBe("R U' R'");
    const r = await ok("PLL", "pll-t", "R U R' U' R' F R2' U' R' U' R U R' F' U2 U2");
    expect(r).toEqual({ ok: true, alg: "R U R' U' R' F R2 U' R' U' R U R' F' U2 U2" });
  });
});
