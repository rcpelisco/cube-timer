// Builds src/lib/algs.ts from scripts/algs-source.txt (algorithm lists, most popular first).
// For each case it keeps up to 4 algorithms that pass the cube-model checks AND solve exactly the
// same case as the case's current first algorithm (the verified reference), in source order; the
// first kept one becomes the standard. The reference is kept too if nothing else matches it.
// Run: node scripts/build-algs.ts   (then npm run check:algs)
import { readFileSync, writeFileSync } from "node:fs";
import { OLL, PLL, type AlgCase } from "../src/lib/algs.ts";
import { caseKey, normalizeAlg, problems } from "./alg-model.ts";

const MAX = 4;
const source = new Map<string, string[]>();
for (const line of readFileSync(new URL("./algs-source.txt", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.startsWith("#")) continue;
  const cut = line.indexOf(" | ");   // name | alg || alg || …
  const name = line.slice(0, cut).trim(), rest = line.slice(cut + 3);
  source.set(name, rest.split("||").map(s => s.trim()).filter(Boolean));
}

const sourceName = (c: AlgCase) => (c.set === "OLL" ? c.name : `PLL ${c.name.replace(/ perm$/, "")}`);
const report: string[] = [];

function build(c: AlgCase) {
  const ref = c.algs[0];
  const refKey = caseKey(c.set, ref);
  const kept: string[] = [];
  for (const raw of source.get(sourceName(c)) ?? []) {
    const alg = normalizeAlg(raw);
    const errs = problems(c.set, c.group, alg);
    if (errs.length) { report.push(`  ${c.name}: dropped "${raw}" — ${errs.join("; ")}`); continue; }
    if (caseKey(c.set, alg) !== refKey) { report.push(`  ${c.name}: dropped "${raw}" — solves a different case`); continue; }
    if (!kept.includes(alg) && kept.length < MAX) kept.push(alg);
  }
  if (!kept.includes(ref)) {
    if (kept.length < MAX) kept.push(ref);
    if (kept.length === 1) report.push(`  ${c.name}: no source algorithm matched; kept the reference`);
  }
  return { ...c, algs: kept };
}

const oll = OLL.map(build), pll = PLL.map(build);
const q = (s: string) => JSON.stringify(s);
const line = (c: AlgCase) => c.set === "OLL"
  ? `  oll(${c.name.replace("OLL ", "")}, ${q(c.group)}, [${c.algs.map(q).join(", ")}]),`
  : `  pll(${q(c.name.replace(/ perm$/, ""))}, ${q(c.group)}, [${c.algs.map(q).join(", ")}]),`;

const file = readFileSync(new URL("../src/lib/algs.ts", import.meta.url), "utf8");
const head = file.slice(0, file.indexOf("export const OLL"));
const tail = file.slice(file.indexOf("export const ALGS"));
writeFileSync(new URL("../src/lib/algs.ts", import.meta.url),
  `${head}export const OLL: AlgCase[] = [\n${oll.map(line).join("\n")}\n];\n\nexport const PLL: AlgCase[] = [\n${pll.map(line).join("\n")}\n];\n\n${tail}`);

console.log(report.join("\n") || "  nothing dropped");
const count = (l: AlgCase[]) => l.reduce((n, c) => n + c.algs.length, 0);
console.log(`OLL: ${count(oll)} algorithms for ${oll.length} cases; PLL: ${count(pll)} for ${pll.length} cases`);
