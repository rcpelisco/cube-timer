import { useEffect, useState } from "react";
import { useSeen } from "../hooks/useSeen";
import { puzzleOf, type AlgCase } from "../lib/algs";
import { CROSS_COLORS, facesFor, type CrossColor } from "../lib/crossColor";
import { cubeView, llStickers, stickers2x2, stickers4x4, type CubeView, type Face, type Face2, type Face3, type Layer2, type LLStickers, type Stickers2, type Stickers4 } from "../lib/llDiagram";

// Last-layer diagrams. Each one only works out its stickers once it's near the screen, so a long
// list of cases opens without doing them all at once. Stickers come from undoing the algorithm on a cube model, so the drawing
// always matches the algorithm.
// - 3×3 OLL/PLL: the top face as a 3×3 grid with the top layer's side stickers as strips around it.
//   OLL shows only the top color (everything else gray); PLL shows the side colors too.
// - 3×3 COLL: like PLL, but the edges' side stickers are gray (where edges go doesn't matter).
// - 3×3 F2L: the cube in 3D from the front-right corner (top, front and right faces), with the
//   last layer's pieces gray, so the corner and edge to pair up stand out.
// - 2×2 OLL: the same, 2×2.
// - 2×2 PBL: both layers, top and bottom, each as a face with its side strips. The bottom is drawn
//   as seen from above (through the cube), so its front is at the bottom like the top's.
// - 4×4 parity: the top face as a 4×4 grid with side strips. OLL parity shows only the top color;
//   PLL parity shows the side colors too.

export function CaseDiagram(props: { c: AlgCase; alg: string; cross: CrossColor; className?: string }) {
  if (puzzleOf(props.c.set) === "2x2") return <Diagram2x2 {...props} />;
  if (puzzleOf(props.c.set) === "4x4") return <Diagram4x4 {...props} />;
  return props.c.set === "F2L" ? <DiagramF2L {...props} /> : <Diagram3x3 {...props} />;
}

const M = 2, S = 10, G = 3, GAP = 2;
const O = M + S + G;                       // where the face grid starts

const Sticker = ({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) => (
  <rect x={x} y={y} width={w} height={h} rx={2.5} fill={fill} stroke="var(--sticker-edge)" strokeWidth={0.8} />
);

function Diagram3x3({ c, alg, cross, className = "" }: { c: AlgCase; alg: string; cross: CrossColor; className?: string }) {
  const [st, setSt] = useState<LLStickers | null>(null);
  const [ref, seen] = useSeen<SVGSVGElement>();
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    llStickers(alg).then(s => { if (alive) setSt(s); });
    return () => { alive = false; };
  }, [alg, seen]);

  const CELL = 22;
  const pos = (i: number) => O + i * (CELL + GAP);
  const FAR = O + 3 * CELL + 2 * GAP + G;  // where the bottom/right strips start
  const faces = facesFor(cross);
  const fill = (f: Face | undefined) => {
    if (!f) return "var(--sticker-off)";
    if (c.set === "OLL") return f === "U" ? faces.U : "var(--sticker-off)";
    return faces[f];
  };
  // COLL: an edge's side sticker (the middle of each strip) doesn't matter for the case.
  const side = (f: Face | undefined, i: number) => (c.set === "COLL" && i === 1 ? undefined : f);

  const rects: { x: number; y: number; w: number; h: number; f?: Face }[] = [];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    rects.push({ x: pos(col), y: pos(r), w: CELL, h: CELL, f: r === 1 && col === 1 ? "U" : st?.top[r][col] });
  }
  for (let i = 0; i < 3; i++) {
    rects.push({ x: pos(i), y: M, w: CELL, h: S, f: side(st?.sides.B[i], i) });
    rects.push({ x: pos(i), y: FAR, w: CELL, h: S, f: side(st?.sides.F[i], i) });
    rects.push({ x: M, y: pos(i), w: S, h: CELL, f: side(st?.sides.L[i], i) });
    rects.push({ x: FAR, y: pos(i), w: S, h: CELL, f: side(st?.sides.R[i], i) });
  }

  return (
    <svg ref={ref} className={`case-diagram ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${c.name} case`}>
      {rects.map((r, i) => <Sticker key={i} {...r} fill={fill(r.f)} />)}
    </svg>
  );
}

function Diagram4x4({ c, alg, cross, className = "" }: { c: AlgCase; alg: string; cross: CrossColor; className?: string }) {
  const [st, setSt] = useState<Stickers4 | null>(null);
  const [ref, seen] = useSeen<SVGSVGElement>();
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    stickers4x4(alg).then(s => { if (alive) setSt(s); });
    return () => { alive = false; };
  }, [alg, seen]);

  const CELL = 16;
  const pos = (i: number) => O + i * (CELL + GAP);
  const FAR = O + 4 * CELL + 3 * GAP + G;
  const faces = facesFor(cross);
  const topOnly = c.id === "par4-oll";
  const fill = (f: Face | undefined) => (!f ? "var(--sticker-off)" : topOnly && f !== "U" ? "var(--sticker-off)" : faces[f]);
  const rects: { x: number; y: number; w: number; h: number; f?: Face }[] = [];
  for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
    rects.push({ x: pos(col), y: pos(r), w: CELL, h: CELL, f: st?.top[r][col] });
  }
  for (let i = 0; i < 4; i++) {
    rects.push({ x: pos(i), y: M, w: CELL, h: S, f: st?.sides.B[i] });
    rects.push({ x: pos(i), y: FAR, w: CELL, h: S, f: st?.sides.F[i] });
    rects.push({ x: M, y: pos(i), w: S, h: CELL, f: st?.sides.L[i] });
    rects.push({ x: FAR, y: pos(i), w: S, h: CELL, f: st?.sides.R[i] });
  }
  return (
    <svg ref={ref} className={`case-diagram ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${c.name} case`}>
      {rects.map((r, i) => <Sticker key={i} {...r} fill={fill(r.f)} />)}
    </svg>
  );
}

// One 2×2 layer (face + side strips) in a 100×100 box at x0.
const CELL2 = 34;
const pos2 = (i: number) => O + i * (CELL2 + GAP);
const FAR2 = O + 2 * CELL2 + GAP + G;
function layerRects(layer: Layer2 | undefined, x0: number) {
  const rects: { x: number; y: number; w: number; h: number; f?: Face2 }[] = [];
  for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) {
    rects.push({ x: x0 + pos2(col), y: pos2(r), w: CELL2, h: CELL2, f: layer?.face[r][col] });
  }
  for (let i = 0; i < 2; i++) {
    rects.push({ x: x0 + pos2(i), y: M, w: CELL2, h: S, f: layer?.sides.B[i] });
    rects.push({ x: x0 + pos2(i), y: FAR2, w: CELL2, h: S, f: layer?.sides.F[i] });
    rects.push({ x: x0 + M, y: pos2(i), w: S, h: CELL2, f: layer?.sides.L[i] });
    rects.push({ x: x0 + FAR2, y: pos2(i), w: S, h: CELL2, f: layer?.sides.R[i] });
  }
  return rects;
}

function Diagram2x2({ c, alg, cross, className = "" }: { c: AlgCase; alg: string; cross: CrossColor; className?: string }) {
  const [st, setSt] = useState<Stickers2 | null>(null);
  const [ref, seen] = useSeen<SVGSVGElement>();
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    stickers2x2(alg).then(s => { if (alive) setSt(s); });
    return () => { alive = false; };
  }, [alg, seen]);

  // The first face (the "cross" color setting) is on the bottom.
  const faces = { ...facesFor(cross), D: CROSS_COLORS.find(x => x.id === cross)!.swatch };
  const fill = (f: Face2 | undefined) => {
    if (!f) return "var(--sticker-off)";
    if (c.set === "OLL2") return f === "U" ? faces.U : "var(--sticker-off)";
    return faces[f];
  };

  if (c.set === "OLL2") {
    return (
      <svg ref={ref} className={`case-diagram ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${c.name} case`}>
        {layerRects(st?.top, 0).map((r, i) => <Sticker key={i} {...r} fill={fill(r.f)} />)}
      </svg>
    );
  }
  // PBL: the cube in 3D, looking at the front-right top corner (top, front and right faces), so
  // the swaps in both layers show as broken or matching pairs on the sides.
  const quads: { pts: string; f?: Face2 }[] = [];
  for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) {
    // Top: row 0 = back, col 0 = left.
    quads.push({ pts: quad([col, 1 - r, 2], EX, EY), f: st?.top.face[r][col] });
  }
  for (let row = 0; row < 2; row++) {
    const layer = row === 0 ? st?.top : st?.bottom;
    for (let i = 0; i < 2; i++) {
      // Front: left→right. Right: front→back (sides.R is listed back→front).
      quads.push({ pts: quad([i, 0, 1 - row], EX, EZ), f: layer?.sides.F[i] });
      quads.push({ pts: quad([2, i, 1 - row], EY, EZ), f: layer?.sides.R[1 - i] });
    }
  }
  return (
    <svg ref={ref} className={`case-diagram ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${c.name} case`}>
      <polygon points={CUBE_OUTLINE} fill="var(--cube-body)" />
      {quads.map((q, i) => <polygon key={i} points={q.pts} fill={fill(q.f)} stroke="var(--sticker-edge)" strokeWidth={0.6} strokeLinejoin="round" />)}
    </svg>
  );
}

// Isometric projection for the 3D cubes: x = left→right, y = front→back, z = bottom→top, in
// cells; an n-cell cube with cells u wide sits centered in the 100×100 box.
type V3 = [number, number, number];
const EX: V3 = [1, 0, 0], EY: V3 = [0, 1, 0], EZ: V3 = [0, 0, 1];
function iso(n: number, u: number) {
  const origin = [50 - (n * u * Math.sqrt(3)) / 2, 50 + (n * u) / 2];
  const pt = ([x, y, z]: V3) => [
    origin[0] + (x + y) * u * Math.cos(Math.PI / 6),
    origin[1] + (x - y) * u * Math.sin(Math.PI / 6) - z * u,
  ].map(v => v.toFixed(2)).join(",");
  // One sticker on the cell at `o` spanned by unit steps a and b, inset from the cell's edges.
  const quad = (o: V3, a: V3, b: V3, inset = 0.07) => {
    const at = (s: number, t: number): V3 => [0, 1, 2].map(k => o[k] + s * a[k] + t * b[k]) as V3;
    const lo = inset, hi = 1 - inset;
    return [at(lo, lo), at(hi, lo), at(hi, hi), at(lo, hi)].map(pt).join(" ");
  };
  const outline = ([[0, 0, 0], [n, 0, 0], [n, n, 0], [n, n, n], [0, n, n], [0, 0, n]] as V3[]).map(pt).join(" ");
  return { quad, outline };
}
const { quad, outline: CUBE_OUTLINE } = iso(2, 23);
const ISO3 = iso(3, 15.5);

function DiagramF2L({ c, alg, cross, className = "" }: { c: AlgCase; alg: string; cross: CrossColor; className?: string }) {
  const [st, setSt] = useState<CubeView | null>(null);
  const [ref, seen] = useSeen<SVGSVGElement>();
  useEffect(() => {
    if (!seen) return;
    let alive = true;
    cubeView(alg).then(s => { if (alive) setSt(s); });
    return () => { alive = false; };
  }, [alg, seen]);
  const faces = { ...facesFor(cross), D: CROSS_COLORS.find(x => x.id === cross)!.swatch };
  const fill = (cell: { f: Face3; ll: boolean } | undefined) => (!cell || cell.ll ? "var(--sticker-off)" : faces[cell.f]);
  const quads: { pts: string; fill: string }[] = [];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    quads.push({ pts: ISO3.quad([col, 2 - r, 3], EX, EY), fill: fill(st?.U[r][col]) });
    quads.push({ pts: ISO3.quad([col, 0, 2 - r], EX, EZ), fill: fill(st?.F[r][col]) });
    quads.push({ pts: ISO3.quad([3, col, 2 - r], EY, EZ), fill: fill(st?.R[r][col]) });
  }
  return (
    <svg ref={ref} className={`case-diagram ${className}`} viewBox="0 0 100 100" role="img" aria-label={`${c.name} case`}>
      <polygon points={ISO3.outline} fill="var(--cube-body)" />
      {quads.map((q, i) => <polygon key={i} points={q.pts} fill={q.fill} stroke="var(--sticker-edge)" strokeWidth={0.6} strokeLinejoin="round" />)}
    </svg>
  );
}
