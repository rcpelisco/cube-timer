// Triggers: short, named move sequences that algorithms are built from. Seeing an algorithm as a
// few triggers ("Sune, then Sledgehammer") makes it easier to learn and to execute as chunks
// instead of a string of single moves.

export type TriggerFamily = "sexy" | "sledge" | "hedge" | "sune";

export interface Trigger { name: string; moves: string; family: TriggerFamily }

export const TRIGGERS: Trigger[] = [
  { name: "Sexy", moves: "R U R' U'", family: "sexy" },
  { name: "Reverse sexy", moves: "R' U' R U", family: "sexy" },
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
];

// Longest first, so a Sune is found as a Sune and not cut short by something inside it.
const BY_LENGTH = TRIGGERS.map(t => ({ t, tokens: t.moves.split(" ") }))
  .sort((a, b) => b.tokens.length - a.tokens.length);

export interface AlgPart { moves: string; trigger?: Trigger }

// Split an algorithm into triggers and the moves between them, reading left to right.
export function splitTriggers(alg: string): AlgPart[] {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const parts: AlgPart[] = [];
  let loose: string[] = [];
  const flush = () => { if (loose.length) parts.push({ moves: loose.join(" ") }); loose = []; };
  for (let i = 0; i < tokens.length;) {
    const hit = BY_LENGTH.find(({ tokens: tt }) => tt.every((m, k) => tokens[i + k] === m));
    if (hit) {
      flush();
      parts.push({ moves: hit.t.moves, trigger: hit.t });
      i += hit.tokens.length;
    } else {
      loose.push(tokens[i]);
      i++;
    }
  }
  flush();
  return parts;
}
