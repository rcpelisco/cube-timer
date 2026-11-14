// Triggers: short, named move sequences that algorithms are built from. Seeing an algorithm as a
// few triggers ("Sune, then Sledgehammer") makes it easier to learn and to execute as chunks
// instead of a string of single moves.

export type TriggerFamily = "sexy" | "sledge" | "hedge" | "sune" | "fsexy" | "insert";

export interface Trigger { name: string; moves: string; family: TriggerFamily }

export const TRIGGERS: Trigger[] = [
  { name: "Sexy", moves: "R U R' U'", family: "sexy" },
  { name: "Reverse sexy", moves: "R' U' R U", family: "sexy" },
  { name: "Inverse sexy", moves: "U R U' R'", family: "sexy" },
  { name: "Inverse reverse sexy", moves: "U' R' U R", family: "sexy" },
  { name: "Left sexy", moves: "L' U' L U", family: "sexy" },
  { name: "Left reverse sexy", moves: "L U L' U'", family: "sexy" },
  { name: "Wide sexy", moves: "r U R' U'", family: "sexy" },
  { name: "Wide left sexy", moves: "l' U' L U", family: "sexy" },
  { name: "Sledgehammer", moves: "R' F R F'", family: "sledge" },
  { name: "Wide sledgehammer", moves: "r' F R F'", family: "sledge" },
  { name: "Left sledgehammer", moves: "L F' L' F", family: "sledge" },
  { name: "Hedgeslammer", moves: "F R' F' R", family: "hedge" },
  { name: "Left hedgeslammer", moves: "F' L F L'", family: "hedge" },
  { name: "Sune", moves: "R U R' U R U2 R'", family: "sune" },
  { name: "Antisune", moves: "R U2 R' U' R U' R'", family: "sune" },
  { name: "Left sune", moves: "L' U' L U' L' U2 L", family: "sune" },
  { name: "Left antisune", moves: "L' U2 L U L' U L", family: "sune" },
  { name: "Fat sune", moves: "r U R' U R U2 r'", family: "sune" },
  { name: "Fat antisune", moves: "r U2 R' U' R U' r'", family: "sune" },
  // A sexy move between F and F' (the "FRURUF" of beginner OLL), and its relatives.
  { name: "F sexy", moves: "F R U R' U' F'", family: "fsexy" },
  { name: "Wide F sexy", moves: "f R U R' U' f'", family: "fsexy" },
  { name: "F inverse sexy", moves: "F U R U' R' F'", family: "fsexy" },
  { name: "Wide F inverse sexy", moves: "f U R U' R' f'", family: "fsexy" },
  // Inserts: a side turned up, the top turned, the side turned back (R U R', F' U' F…). The
  // building block of F2L, and of much of OLL and COLL. Named by the side's first turn ("R insert",
  // "F' insert"), since which slot it works on depends on the algorithm.
  ...["R", "R'", "L", "L'", "F", "F'"].flatMap(side => {
    const back = side.endsWith("'") ? side.slice(0, -1) : `${side}'`;
    return ["U", "U'", "U2"].map(u => ({ name: `${side} insert`, moves: `${side} ${u} ${back}`, family: "insert" as const }));
  }),
];

const PATTERNS = TRIGGERS.map(t => ({ t, tokens: t.moves.split(" ") }));

export interface AlgPart { moves: string; trigger?: Trigger }

// Split an algorithm into triggers and the moves between them. Of all the ways to mark it, this
// takes the one that covers the most moves, then the one with the fewest (so longer) triggers:
// "R U R' U R U2 R'" is one Sune, not an Insert and a Sexy, and a short trigger near the start
// can't block a longer one that starts a move later.
export function splitTriggers(alg: string): AlgPart[] {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const n = tokens.length;
  // After an x or z rotation (until the next one, which turns it back in these algorithms) the
  // cube is on its side, so "R U' R'" there isn't the trigger it looks like.
  const sideways: boolean[] = [];
  let turned = false;
  for (const m of tokens) { if (/^[xz]/.test(m)) turned = !turned; sideways.push(turned); }
  // best[i]: the best marking of tokens[i..]: moves covered, triggers used, and the step taken.
  const best: { covered: number; count: number; step: number; trigger?: Trigger }[] = Array(n + 1);
  best[n] = { covered: 0, count: 0, step: 0 };
  for (let i = n - 1; i >= 0; i--) {
    let pick = { covered: best[i + 1].covered, count: best[i + 1].count, step: 1 } as (typeof best)[number];
    for (const { t, tokens: tt } of PATTERNS) {
      if (i + tt.length > n || !tt.every((m, k) => tokens[i + k] === m && !sideways[i + k])) continue;
      const rest = best[i + tt.length];
      const covered = rest.covered + tt.length, count = rest.count + 1;
      if (covered > pick.covered || (covered === pick.covered && count < pick.count))
        pick = { covered, count, step: tt.length, trigger: t };
    }
    best[i] = pick;
  }

  const parts: AlgPart[] = [];
  let loose: string[] = [];
  const flush = () => { if (loose.length) parts.push({ moves: loose.join(" ") }); loose = []; };
  for (let i = 0; i < n; i += best[i].step) {
    const { trigger, step } = best[i];
    if (trigger) { flush(); parts.push({ moves: tokens.slice(i, i + step).join(" "), trigger }); }
    else loose.push(tokens[i]);
  }
  flush();
  return parts;
}
