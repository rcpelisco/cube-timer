// Checks every OLL/PLL algorithm in src/lib/algs.ts against a real cube model (cubing.js).
// Run: npm run check:algs
//
// For each case, every listed algorithm must:
// - keep the top on top (y turns are fine) and keep the first two layers solved,
// - fit the case's group (OLL: orientation pattern; PLL: fully oriented, corner swap type),
// - solve the same case as the case's first (standard) algorithm,
// - have a setup (setupFor) that turns a solved cube into exactly the case it solves.
// And each set must have every case exactly once (OLL: 57, PLL: 21, up to U turns).
import { Alg } from "cubing/alg";
import { OLL, PLL, setupFor } from "../src/lib/algs.ts";
import { caseKey, caseState, problems, solved } from "./alg-model.ts";
import { OLL2, PBL } from "../src/lib/algs2x2.ts";
import { allOriented, bottomSolved, validOn2x2, caseState2, corners, fromSolved2, ollKey, pblKey } from "./alg-model-2x2.ts";

let failed = 0;
let total = 0;
for (const [set, list, expected] of [["OLL", OLL, 57], ["PLL", PLL, 21]] as const) {
  const seen = new Map<string, string>();
  for (const c of list) {
    if (!c.algs.length) { console.log(`✗ ${c.name}: no algorithms`); failed++; continue; }
    let key: string | null = null;
    for (const alg of c.algs) {
      total++;
      const errs = problems(set, c.group, alg);
      if (errs.length) { console.log(`✗ ${c.name}: ${errs.join("; ")}   [${alg}]`); failed++; continue; }
      const k = caseKey(set, alg);
      if (key === null) key = k;
      else if (k !== key) { console.log(`✗ ${c.name}: "${alg}" solves a different case from "${c.algs[0]}"`); failed++; }
      const setup = setupFor(alg);
      if (JSON.stringify(solved.applyAlg(new Alg(setup)).patternData) !== JSON.stringify(caseState(alg).patternData)) {
        console.log(`✗ ${c.name}: setup "${setup}" doesn't produce the case for "${alg}"`); failed++;
      }
    }
    if (key === null) continue;
    if (seen.has(key)) { console.log(`✗ ${c.name}: same case as ${seen.get(key)}`); failed++; continue; }
    seen.set(key, c.name);
  }
  const ok = list.length === expected && seen.size === expected;
  console.log(`${ok ? "✓" : "✗"} ${set}: ${seen.size} distinct cases of ${list.length} listed (expected ${expected})`);
  if (!ok) failed++;
}
// 2×2 Ortega. Each case's expected pattern, worked out by hand from the case's name:
// OLL2: corner twists going round the top (0 = top color up), smallest rotation.
// PBL: swap type in the top / bottom layer (S solved, A adjacent, D diagonal).
const EXPECT: Record<string, string> = {
  "oll2-sune": "0222", "oll2-antisune": "0111", "oll2-h": "1212", "oll2-pi": "1122",
  "oll2-u": "0012", "oll2-t": "0021", "oll2-l": "0102",
  "pbl-adj": "A/S", "pbl-diag": "D/S", "pbl-adj-adj": "A/A", "pbl-diag-diag": "D/D", "pbl-adj-diag": "A/D",
};
for (const [set, list, expected] of [["2×2 OLL", OLL2, 7], ["2×2 PBL", PBL, 5]] as const) {
  const seen = new Set<string>();
  for (const c of list) {
    for (const alg of c.algs) {
      total++;
      if (!validOn2x2(alg)) { console.log(`✗ ${c.name}: uses a move a 2×2 doesn't have   [${alg}]`); failed++; continue; }
      const p = caseState2(alg);
      const key = set === "2×2 OLL" ? ollKey(p) : pblKey(p);
      const ok = set === "2×2 OLL" ? bottomSolved(p) : allOriented(p);
      if (!ok) { console.log(`✗ ${c.name}: ${set === "2×2 OLL" ? "breaks the bottom layer" : "leaves corners twisted"}   [${alg}]`); failed++; }
      else if (key !== EXPECT[c.id]) { console.log(`✗ ${c.name}: solves ${key}, expected ${EXPECT[c.id]}   [${alg}]`); failed++; }
      if (corners(fromSolved2(setupFor(alg))) !== corners(p)) { console.log(`✗ ${c.name}: setup doesn't produce the case for "${alg}"`); failed++; }
    }
    seen.add(EXPECT[c.id]);
  }
  const ok = list.length === expected && seen.size === expected;
  console.log(`${ok ? "✓" : "✗"} ${set}: ${seen.size} distinct cases of ${list.length} listed (expected ${expected})`);
  if (!ok) failed++;
}
console.log(`${failed ? "✗" : "✓"} ${total} algorithms checked${failed ? `, ${failed} problem(s)` : ""}`);
process.exit(failed ? 1 : 0);
