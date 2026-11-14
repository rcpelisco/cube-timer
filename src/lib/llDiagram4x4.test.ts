import { describe, expect, it } from "vitest";
import { stickers4x4, type Stickers4 } from "./llDiagram";
import { PAR4 } from "./algs4x4";

// The top face and the front/back strips as rows of letters.
const rows = (s: Stickers4) => [s.sides.B.join(""), ...s.top.map(r => r.join("")), s.sides.F.join("")];

describe("stickers4x4", () => {
  it("shows pure OLL parity as the front edge pair flipped", async () => {
    for (const alg of PAR4[0].algs.slice(0, 4))
      expect(rows(await stickers4x4(alg))).toEqual(["BBBB", "UUUU", "UUUU", "UUUU", "UFFU", "FUUF"]);
  });

  it("gives each OLL parity case one top pattern, whichever algorithm sets it up", async () => {
    const top = async (alg: string) => (await stickers4x4(alg)).top.map(r => r.map(f => (f === "U" ? "#" : ".")).join("")).join(" ");
    const want: Record<string, string> = {
      "par4-oll": "#### #### #### #..#", "par4-oll-basic": "#### #### #### ....", "par4-oll-m": "#..# #### #### .##.",
    };
    for (const c of PAR4.filter(c => c.group === "During OLL"))
      for (const alg of c.algs.slice(0, c.id === "par4-oll" ? 4 : undefined)) expect(await top(alg), alg).toBe(want[c.id]);
  });

  it("shows PLL parity as the front and back edge pairs swapped, corners home", async () => {
    for (const alg of PAR4.find(c => c.id === "par4-pll")!.algs) {
      const s = await stickers4x4(alg);
      expect(rows(s)).toEqual(["BFFB", "UUUU", "UUUU", "UUUU", "UUUU", "FBBF"]);
      expect([s.sides.L.join(""), s.sides.R.join("")]).toEqual(["LLLL", "RRRR"]);
    }
  });

  it("draws a solved top for moves below it", async () => {
    expect(rows(await stickers4x4("D 2D 2U' D2"))).toEqual(["BBBB", "UUUU", "UUUU", "UUUU", "UUUU", "FFFF"]);
  });
});
