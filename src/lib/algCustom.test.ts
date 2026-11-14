import { describe, expect, it } from "vitest";
import { MAX_CUSTOM_PER_CASE, readCustom } from "./algCustom";
import { readCloudAlgPrefs } from "./algPrefs";
import { algsFor, mainAlg } from "./algChoice";
import { ALGS } from "./algs";

describe("custom algorithms", () => {
  it("keeps only well-formed entries", () => {
    expect(readCustom(null)).toEqual({});
    expect(readCustom(["R U"])).toEqual({});
    const many = Array.from({ length: 20 }, (_, i) => `R U${i}`);
    expect(readCustom({ a: ["R U", 3, ""], b: "R", c: [], d: many }))
      .toEqual({ a: ["R U"], d: many.slice(0, MAX_CUSTOM_PER_CASE) });
  });

  it("reads settings saved before custom algorithms existed", () => {
    const old = { statuses: {}, choices: { "pll-t": "x" }, cross: "white", updatedAt: 5 };
    expect(readCloudAlgPrefs(old)?.custom).toEqual({});
  });

  it("lets your own algorithm be the main one, and falls back when it's gone", () => {
    const t = ALGS.PLL.find(c => c.id === "pll-t")!;
    const mine = "U2 R U R' U' R' F R2 U' R' U' R U R' F'";
    expect(algsFor(t, { "pll-t": [mine] })).toEqual([...t.algs, mine]);
    expect(mainAlg(t, { choices: { "pll-t": mine }, custom: { "pll-t": [mine] } })).toBe(mine);
    expect(mainAlg(t, { choices: { "pll-t": mine }, custom: {} })).toBe(t.algs[0]);
  });
});
