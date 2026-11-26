// A small canvas confetti burst (paper flakes, dots and curly ribbon streamers).
// One shared full-screen canvas is created on demand and removed once the last piece has fallen.
import { getPalette } from "@/lib/motion";

type Shape = "paper" | "dot" | "streamer";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: Shape;
  rotation: number;
  spin: number;
  /** Phase of the paper "flip" (drawn as a squash on one axis) */
  flip: number;
  flipSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  life: number;
  maxLife: number;
}

export interface ConfettiOptions {
  colors?: string[];
  /** Pieces on a large screen (phones get 60%) */
  count?: number;
  /** Launch direction in degrees, 90 = straight up */
  angle?: number;
  /** Cone width in degrees */
  spread?: number;
  /** Launch speed in px per frame */
  velocity?: number;
  gravity?: number;
  /** Mix in curly ribbon streamers */
  streamers?: boolean;
}

const DRAG = 0.985;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frame = 0;
let lastTime = 0;
let gravity = 0.32;

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const resize = () => {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const ensureCanvas = () => {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Never part of an exported image
  canvas.setAttribute("data-html2canvas-ignore", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
};

const teardown = () => {
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
  frame = 0;
};

const draw = (p: Particle, alpha: number) => {
  if (!ctx) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;

  if (p.shape === "paper") {
    ctx.scale(1, Math.cos(p.flip));
    ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64);
  } else if (p.shape === "dot") {
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.32, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // A short curly ribbon: a sine wave that keeps curling as it falls
    const length = p.size * 2.4;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= length; i += 2) {
      const y = Math.sin(i * 0.32 + p.wobble * 2) * 3.2;
      if (i === 0) ctx.moveTo(i - length / 2, y);
      else ctx.lineTo(i - length / 2, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const tick = (now: number) => {
  if (!ctx || !canvas) return teardown();
  // Frame-rate independent (1 = one 60fps frame), capped so a background tab doesn't teleport pieces
  const dt = Math.min((now - lastTime) / (1000 / 60), 3);
  lastTime = now;
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);

  const drag = Math.pow(DRAG, dt);
  particles = particles.filter((p) => {
    p.vx *= drag;
    p.vy = p.vy * drag + gravity * dt;
    p.wobble += p.wobbleSpeed * dt;
    p.x += (p.vx + Math.sin(p.wobble) * 0.6) * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
    p.flip += p.flipSpeed * dt;
    p.life += dt;

    if (p.life > p.maxLife || p.y > height + 40 || p.x < -60 || p.x > width + 60) return false;
    // Fade out over the last 30% of a piece's life
    const remaining = 1 - p.life / p.maxLife;
    draw(p, Math.min(1, remaining / 0.3));
    return true;
  });

  if (particles.length > 0) frame = requestAnimationFrame(tick);
  else teardown();
};

/** Bursts confetti from an element's centre or a viewport point. Does nothing with reduced motion. */
export const fireConfetti = (origin: HTMLElement | { x: number; y: number }, options: ConfettiOptions = {}) => {
  if (typeof window === "undefined" || prefersReducedMotion()) return;

  const point =
    origin instanceof HTMLElement
      ? (() => {
          const rect = origin.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })()
      : origin;

  const palette = getPalette();
  const {
    colors = [palette.cyan, palette.purple, palette.pink, palette.orange, palette.gold, palette.white],
    count = 120,
    angle = 90,
    spread = 70,
    velocity = 14,
    streamers = true,
  } = options;
  gravity = options.gravity ?? 0.32;

  ensureCanvas();
  const total = Math.round(count * (window.innerWidth < 640 ? 0.6 : 1));
  for (let i = 0; i < total; i++) {
    const direction = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
    const speed = velocity * (0.45 + Math.random() * 0.75);
    const roll = Math.random();
    const shape: Shape = streamers && roll < 0.18 ? "streamer" : roll < 0.32 ? "dot" : "paper";
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(direction) * speed,
      vy: -Math.sin(direction) * speed,
      size: 7 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.25,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.08 + Math.random() * 0.14,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.04 + Math.random() * 0.08,
      life: 0,
      maxLife: 150 + Math.random() * 110,
    });
  }

  if (!frame) {
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }
};
