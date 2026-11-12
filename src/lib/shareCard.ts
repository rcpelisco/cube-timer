// A result as an image to post or send: a 1080×1350 card (4:5, which feeds and chats show whole)
// in the app's dark colors, drawn on a canvas with the app's own fonts.

export interface CardTime { text: string; dim?: boolean }

export interface CardData {
  kind: string;          // "3×3 · Ao5"
  value: string;         // "12.63"
  badge?: string;        // "Personal best", "Mock round"
  times?: CardTime[];    // an average's solves; dim ones are in brackets (left out of it)
  note?: string;         // a line or two under them: the scramble, or a summary of a long average
  date: string;
  cube?: string;
}

const W = 1080, H = 1350, PAD = 96;
const C = {
  bg1: "#0d1116", bg2: "#18202b", ink: "#e6ebf2", muted: "#8b97a8", line: "#273140", accent: "#7aaeff", chip: "#1b232e",
};
const UI = '"Archivo", system-ui, sans-serif', NUM = '"Chivo Mono", ui-monospace, monospace';

// Lines of text that fit `width`, breaking at spaces (or anywhere in a word too long for a line).
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= width) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = word;
    if (lines.length === max) break;
  }
  if (cur && lines.length < max) lines.push(cur);
  if (lines.length === max && lines.join(" ").length < text.trim().length) {
    let last = lines[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[max - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function drawCard(d: CardData): Promise<Blob> {
  // The fonts load on first use; a canvas doesn't wait for them, so ask for them first.
  await Promise.all([`600 40px ${UI}`, `700 40px ${UI}`, `400 100px ${NUM}`, `500 40px ${NUM}`]
    .map(f => document.fonts?.load(f).catch(() => null)));

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const inner = W - PAD * 2;

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, C.bg2); bg.addColorStop(1, C.bg1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // A soft glow behind the value.
  const glow = ctx.createRadialGradient(PAD + 200, 520, 0, PAD + 200, 520, 640);
  glow.addColorStop(0, "rgba(122, 174, 255, 0.16)"); glow.addColorStop(1, "rgba(122, 174, 255, 0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  const y = PAD + 44;

  // What it is, and the badge.
  ctx.font = `600 38px ${UI}`;
  ctx.fillStyle = C.muted;
  ctx.letterSpacing = "4px";
  ctx.fillText(d.kind.toUpperCase(), PAD, y);
  ctx.letterSpacing = "0px";
  if (d.badge) {
    ctx.font = `700 30px ${UI}`;
    const bw = ctx.measureText(d.badge).width + 44;
    roundRect(ctx, W - PAD - bw, y - 40, bw, 54, 27);
    ctx.fillStyle = C.accent; ctx.fill();
    ctx.fillStyle = C.bg1;
    ctx.fillText(d.badge, W - PAD - bw + 22, y - 3);
  }

  // The value, the solves and the note, centred in the room between the header and the footer
  // (measured first, then drawn).
  const top = y + 40, bottom = H - PAD - 120;
  const body = (y0: number, draw: boolean): number => {
    let y = y0;
    let size = 300;
    ctx.font = `400 ${size}px ${NUM}`;
    while (size > 120 && ctx.measureText(d.value).width > inner) { size -= 10; ctx.font = `400 ${size}px ${NUM}`; }
    y += size * 0.74;
    if (draw) {
      ctx.fillStyle = C.ink;
      ctx.letterSpacing = `${-size * 0.02}px`;
      ctx.fillText(d.value, PAD - size * 0.04, y);
      ctx.letterSpacing = "0px";
    }
    y += 70;

    if (d.times?.length) {
      ctx.font = `500 42px ${NUM}`;
      const gap = 16, ch = 84;
      let x = PAD;
      for (const t of d.times) {
        const label = t.dim ? `(${t.text})` : t.text;
        const cw = Math.max(150, ctx.measureText(label).width + 48);
        if (x + cw > W - PAD) { x = PAD; y += ch + gap; }
        if (draw) {
          roundRect(ctx, x, y, cw, ch, 18);
          ctx.fillStyle = C.chip; ctx.fill();
          ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = t.dim ? C.muted : C.ink;
          ctx.fillText(label, x + (cw - ctx.measureText(label).width) / 2, y + 56);
        }
        x += cw + gap;
      }
      y += ch + 40;
    }

    if (d.note) {
      ctx.font = `500 34px ${NUM}`;
      ctx.fillStyle = C.muted;
      for (const line of wrap(ctx, d.note, inner, 4)) { if (draw) ctx.fillText(line, PAD, y + 34); y += 50; }
      y += 10;
    }
    return y - 40;
  };
  const height = body(0, false);
  body(Math.max(top, top + (bottom - top - height) * 0.42), true);

  // Footer: when, on what, and where it's from.
  const fy = H - PAD;
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, fy - 74); ctx.lineTo(W - PAD, fy - 74); ctx.stroke();
  ctx.font = `500 32px ${UI}`;
  ctx.fillStyle = C.muted;
  const brand = "Cube Timer";
  ctx.font = `700 34px ${UI}`;
  const bw = ctx.measureText(brand).width;
  ctx.font = `500 32px ${UI}`;
  const left = wrap(ctx, [d.date, d.cube].filter(Boolean).join(" · "), inner - bw - 110, 1)[0] ?? "";
  ctx.fillText(left, PAD, fy);
  ctx.font = `700 34px ${UI}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(brand, W - PAD - bw, fy);
  // A small 3×3 face as the mark.
  const s = 13, g = 3, mx = W - PAD - bw - 16 - (s * 3 + g * 2), my = fy - 33;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    roundRect(ctx, mx + c * (s + g), my + r * (s + g), s, s, 3);
    ctx.fillStyle = (r + c) % 2 ? C.accent : C.ink; ctx.fill();
  }

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the card"))), "image/png"));
}

// "cube-timer-3x3-ao5-12-63.png"
export function cardFileName(d: CardData): string {
  const slug = `${d.kind} ${d.value}`.toLowerCase().replace(/×/g, "x").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `cube-timer-${slug}.png`;
}
