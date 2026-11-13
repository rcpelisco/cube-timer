import type { KPuzzle } from "cubing/kpuzzle";

// Flat net of a scrambled NxN cube, drawn our own way (rounded stickers with gaps, our colors).
// The sticker positions and starting colors come from cubing.js's own 2D drawing of the puzzle:
// each sticker there has an id like "CORNERS-l3-o1" (orbit, piece slot, orientation), and the
// scrambled colors follow the same rule cubing.js uses to repaint it.

export interface NetSticker { id: string; x: number; y: number; size: number }
export interface NetLayout { viewBox: string; stickers: NetSticker[]; colors: Record<string, string>; kpuzzle: KPuzzle }

// cubing.js color names → the app's cube colors.
const PALETTE: [RegExp, string][] = [
  [/^(white|#fff(fff)?|rgb\(255, 255, 255\))$/, "#f4f4f4"],
  [/^(yellow|#ff0|rgb\(244, 244, 0\)|rgb\(255, 255, 0\))$/, "#ffe600"],
  [/^(limegreen|#4e0|#44ee00|rgb\(68, 238, 0\)|rgb\(50, 205, 50\))$/, "#0a9a4a"],
  [/^(#26f|#2266ff|rgb\(34, 102, 255\))$/, "#0051ba"],
  [/^(red|#f00|rgb\(255, 0, 0\))$/, "#b8001f"],
  [/^(orange|#f80|#ff8000|rgb\(255, 128, 0\)|rgb\(255, 165, 0\))$/, "#ff6d00"],
];
const toPalette = (c: string) => PALETTE.find(([re]) => re.test(c.trim().toLowerCase()))?.[1] ?? c;

const STICKER_ID = /^[A-Z0-9_]+-l\d+-o\d+$/;

// Every number in a transform like "translate(5,40) scale(40)".
const nums = (s: string | null) => (s?.match(/-?\d*\.?\d+(e-?\d+)?/g) ?? []).map(Number);

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const stickers: NetSticker[] = [];
  const colors: Record<string, string> = {};
  for (const el of Array.from(doc.querySelectorAll("[id]"))) {
    if (!STICKER_ID.test(el.id)) continue;
    const fill = (el as SVGElement).style?.fill || el.getAttribute("fill") || "#888";
    colors[el.id] = toPalette(fill);

    if (el.tagName === "use") {
      // 2×2 / 3×3: a unit square, moved by translate(x, y), inside a group scaled by translate+scale.
      const [x, y] = nums(el.getAttribute("transform"));
      const group = el.closest("g[transform]");
      const [gx = 0, gy = 0, s = 1] = nums(group?.getAttribute("transform") ?? null);
      stickers.push({ id: el.id, x: gx + s * x, y: gy + s * y, size: s });
    } else {
      // 4×4: squares given as polygon points.
      const p = nums(el.getAttribute("points") ?? el.getAttribute("d"));
      const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs), y = Math.min(...ys);
      stickers.push({ id: el.id, x, y, size: Math.min(Math.max(...xs) - x, Math.max(...ys) - y) });
    }
  }
  // cubing.js draws each center in four parts (to show center turns); they share one spot and one
  // color, so keep one sticker per spot.
  const seen = new Set<string>();
  const unique = stickers.filter(s => {
    const key = `${Math.round(s.x)},${Math.round(s.y)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  stickers.splice(0, stickers.length, ...unique);

  // Fit the view to the stickers, with a small margin.
  const pad = Math.min(...stickers.map(s => s.size)) * 0.15;
  const minX = Math.min(...stickers.map(s => s.x)) - pad, minY = Math.min(...stickers.map(s => s.y)) - pad;
  const maxX = Math.max(...stickers.map(s => s.x + s.size)) + pad, maxY = Math.max(...stickers.map(s => s.y + s.size)) + pad;
  return { stickers, colors, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
}

const layouts = new Map<string, Promise<NetLayout>>();

export function loadNet(viewer: string): Promise<NetLayout> {
  let hit = layouts.get(viewer);
  if (!hit) {
    hit = import("cubing/puzzles").then(async ({ puzzles }) => {
      const loader = puzzles[viewer];
      if (!loader?.svg) throw new Error(`No net drawing for ${viewer}`);
      const [svg, kpuzzle] = await Promise.all([loader.svg(), loader.kpuzzle()]);
      return { ...parse(svg), kpuzzle };
    });
    layouts.set(viewer, hit);
  }
  return hit;
}

// Color of every sticker after `moves`: sticker (orbit, slot, o) shows what was originally at
// (orbit, piece in that slot, o − that piece's orientation).
export function netColors(layout: NetLayout, moves: string): Record<string, string> {
  const pattern = layout.kpuzzle.defaultPattern().applyAlg(moves);
  const out: Record<string, string> = {};
  for (const orbit of layout.kpuzzle.definition.orbits) {
    const data = pattern.patternData[orbit.orbitName];
    const n = orbit.numOrientations;
    for (let idx = 0; idx < orbit.numPieces; idx++) {
      for (let o = 0; o < n; o++) {
        const from = `${orbit.orbitName}-l${data.pieces[idx]}-o${(n - data.orientation[idx] + o) % n}`;
        out[`${orbit.orbitName}-l${idx}-o${o}`] = layout.colors[from];
      }
    }
  }
  return out;
}
