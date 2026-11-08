// Confetti for a new personal best: two bursts from the bottom corners that arc across the screen
// and flutter down. Drawn on a temporary full-screen canvas that ignores touches, so it never gets
// in the way of the next solve. Skipped when the system asks for reduced motion.

const COLORS = ["#f4f4f4", "#ffd500", "#0a9a4a", "#0051ba", "#c8102e", "#ff5800"];
const DURATION = 3200;

interface Piece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; color: string;
  angle: number; spin: number; tilt: number; tiltSpeed: number;
}

export function fireConfetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // Speeds scale with the screen so the bursts reach about two thirds of the way up on any size.
  const power = Math.sqrt(H) * 0.75;
  const count = W < 500 ? 90 : 140;
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const angle = (left ? -1 : 1) * (Math.PI / 180) * (18 + Math.random() * 32); // from vertical
    const speed = power * (0.75 + Math.random() * 0.55);
    pieces.push({
      x: left ? -10 : W + 10, y: H * (0.78 + Math.random() * 0.12),
      vx: Math.sin(-angle) * speed, vy: -Math.cos(angle) * speed,
      w: 6 + Math.random() * 5, h: 9 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      angle: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI, tiltSpeed: 0.08 + Math.random() * 0.12,
    });
  }

  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 16.67, 3); // in 60 fps frames; capped after a stall
    last = now;
    const age = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = age > DURATION - 600 ? Math.max(0, (DURATION - age) / 600) : 1;
    for (const p of pieces) {
      p.vy += 0.32 * dt;                         // gravity
      p.vx *= Math.pow(0.985, dt);               // air drag
      p.vy = Math.min(p.vy, 4.5);                // paper falls slowly
      p.x += (p.vx + Math.sin(p.tilt) * 0.8) * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.tilt += p.tiltSpeed * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(1, Math.cos(p.tilt));            // flip as it tumbles
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  // Background tabs pause animation frames; make sure the canvas still goes away.
  setTimeout(() => canvas.remove(), DURATION + 1000);
}
