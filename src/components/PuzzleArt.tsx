import type { ReactNode } from "react";
import type { PuzzleId } from "../lib/puzzles";

// Small line drawings of each puzzle, in the accent colour, for empty states. Drawn here rather
// than with cubing.js so they're instant and look like illustrations, not scramble previews.

type P = [number, number];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pts = (list: P[]) => list.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ");
const line = (a: P, b: P, key: string) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;

// An isometric cube: its three faces (top lightest) and the corners they share.
const T: P = [60, 18], UL: P = [22, 40], UR: P = [98, 40], C: P = [60, 62], LL: P = [22, 84], LR: P = [98, 84], B: P = [60, 106];
const FACES: { quad: [P, P, P, P]; shade: number }[] = [
  { quad: [UL, T, UR, C], shade: 0.26 },
  { quad: [UL, C, B, LL], shade: 0.14 },
  { quad: [C, UR, LR, B], shade: 0.06 },
];

function cubeFaces(inner: (q: [P, P, P, P], f: number) => ReactNode) {
  return FACES.map(({ quad, shade }, f) => (
    <g key={f}>
      <polygon points={pts(quad)} fill="currentColor" fillOpacity={shade} />
      {inner(quad, f)}
    </g>
  ));
}

// n×n stickers on each face: lines across the face parallel to its edges.
function nxn(n: number) {
  return cubeFaces(([a, b, c, d], f) => {
    const out = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      out.push(line(lerp(a, b, t), lerp(d, c, t), `${f}a${i}`), line(lerp(a, d, t), lerp(b, c, t), `${f}b${i}`));
    }
    return <g className="grid">{out}</g>;
  });
}

// Skewb: each face is a centre square (a diamond on the face) and four corners.
const skewb = () => cubeFaces(([a, b, c, d]) => (
  <polygon className="grid" points={pts([lerp(a, b, 0.5), lerp(b, c, 0.5), lerp(c, d, 0.5), lerp(d, a, 0.5)])} fill="none" />
));

// Pyraminx: one face, split into nine triangles.
function pyraminx() {
  const A: P = [60, 16], L: P = [12, 100], R: P = [108, 100];
  const out = [];
  for (const t of [1 / 3, 2 / 3]) {
    out.push(line(lerp(A, L, t), lerp(A, R, t), `h${t}`), line(lerp(L, A, t), lerp(L, R, t), `l${t}`), line(lerp(R, A, t), lerp(R, L, t), `r${t}`));
  }
  return <><polygon points={pts([A, L, R])} fill="currentColor" fillOpacity={0.2} /><g className="grid">{out}</g></>;
}

const pentagon = (cx: number, cy: number, r: number): P[] =>
  Array.from({ length: 5 }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

// Megaminx: one face, a centre pentagon with five edges and five corners round it.
function megaminx() {
  const outer = pentagon(60, 64, 50), inner = pentagon(60, 64, 20);
  const out = inner.flatMap((q, k) => [
    line(q, lerp(outer[k], outer[(k + 4) % 5], 0.3), `a${k}`),
    line(q, lerp(outer[k], outer[(k + 1) % 5], 0.3), `b${k}`),
  ]);
  return <>
    <polygon points={pts(outer)} fill="currentColor" fillOpacity={0.2} />
    <polygon points={pts(inner)} fill="currentColor" fillOpacity={0.14} className="grid" />
    <g className="grid">{out}</g>
  </>;
}

// Square-1: the top layer from above, four corner wedges and four edge wedges.
function square1() {
  const c: P = [60, 60], h = 44;
  const out = [15, 75, 105, 165, 195, 255, 285, 345].map(deg => {
    const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    const s = h / Math.max(Math.abs(dx), Math.abs(dy));
    return line(c, [c[0] + dx * s, c[1] + dy * s], `w${deg}`);
  });
  return <>
    <rect x={16} y={16} width={88} height={88} rx={6} fill="currentColor" fillOpacity={0.2} />
    <g className="grid">{out}</g>
  </>;
}

// Clock: nine dials (all at 12) and four pins.
function clock() {
  const dials = [];
  for (const y of [-26, 0, 26]) for (const x of [-26, 0, 26]) {
    dials.push(<g key={`${x},${y}`}><circle cx={60 + x} cy={60 + y} r={9} fill="currentColor" fillOpacity={0.18} /><line x1={60 + x} y1={60 + y} x2={60 + x} y2={60 + y - 6} /></g>);
  }
  const pins = [[-13, -13], [13, -13], [-13, 13], [13, 13]].map(([x, y]) => <circle key={`${x},${y}`} cx={60 + x} cy={60 + y} r={2.6} fill="currentColor" />);
  return <><circle cx={60} cy={60} r={50} fill="currentColor" fillOpacity={0.08} />{dials}{pins}</>;
}

// FTO: an octahedron seen point on, four faces round a centre corner.
function fto() {
  const t: P = [60, 12], r: P = [108, 60], b: P = [60, 108], l: P = [12, 60], c: P = [60, 60];
  const tri = (p: P, q: P, shade: number, k: string) => <polygon key={k} points={pts([p, q, c])} fill="currentColor" fillOpacity={shade} />;
  return <>
    {tri(t, r, 0.26, "tr")}{tri(r, b, 0.06, "rb")}{tri(b, l, 0.14, "bl")}{tri(l, t, 0.2, "lt")}
    <g className="grid">
      {line(t, b, "v")}{line(l, r, "h")}
      <polygon points={pts([lerp(c, t, 0.5), lerp(c, r, 0.5), lerp(c, b, 0.5), lerp(c, l, 0.5)])} fill="none" />
    </g>
  </>;
}

// Small drawings (badges, the puzzle picker) cap cubes at 3×3 stickers so the lines don't run
// together; the label beside them says which cube it is.
const ART: Record<PuzzleId, (small: boolean) => ReactNode> = {
  "222": () => nxn(2), "333": () => nxn(3), "444": s => nxn(s ? 3 : 4), "555": s => nxn(s ? 3 : 5), "666": s => nxn(s ? 3 : 6), "777": s => nxn(s ? 3 : 7),
  pyram: pyraminx, skewb, minx: megaminx, sq1: square1, clock, fto,
};

export function PuzzleArt({ puzzle, size = 96 }: { puzzle: PuzzleId; size?: number }) {
  const small = size < 40;
  return (
    <svg className={`puzzle-art${small ? " small" : ""}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
      {ART[puzzle](small)}
    </svg>
  );
}
