import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface Mote {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  sway: number;
  color: string;
}

// Spread out with fixed formulas (not Math.random), so they don't jump around on re-render
const MOTES: Mote[] = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 2 + (i % 3),
  duration: 12 + ((i * 7) % 10),
  // Negative delays start each mote part-way up, so the hero isn't empty at first
  delay: -((i * 13) % 20),
  drift: ((i % 5) - 2) * 18,
  // Side-to-side swing of falling snow (themes with --mote-animation: snow-fall)
  sway: (i % 2 ? 1 : -1) * (14 + (i % 4) * 6),
  color: ["var(--mote-1)", "var(--mote-2)", "var(--mote-3)"][i % 3],
}));

// The occasional crystal snowflake, in the gaps between the motes; hidden unless the theme
// sets --mote-crystal-display. Each turns slowly, half of them the other way round.
const CRYSTALS = Array.from({ length: 4 }, (_, i) => ({
  left: (i * 31 + 27) % 100,
  size: 11 + (i % 2) * 3,
  duration: 15 + i * 2,
  delay: -(i * 9 + 4),
  drift: 0,
  sway: (i % 2 ? -1 : 1) * (22 + i * 4),
  color: i % 2 ? "var(--mote-3)" : "var(--mote-1)",
  spin: 9 + i * 3,
  reverse: i % 2 === 1,
}));

// One of a crystal's six arms, pointing up from the centre, with two pairs of branches
const CRYSTAL_ARM = "M12 12V2.5M12 6.5 9.5 4M12 6.5 14.5 4M12 9.5 10.2 7.7M12 9.5 13.8 7.7";

// The odd piece of popcorn popping up near the sides, one every few seconds; hidden unless the
// theme sets --mote-popcorn-display
const POPCORN = Array.from({ length: 4 }, (_, i) => ({
  left: [6, 22, 78, 92][i],
  size: 15 + (i % 3) * 2,
  duration: 13 + i,
  delay: -(2 + i * 4),
  drift: (i % 2 ? -1 : 1) * (20 + i * 6),
  sway: 0,
  color: "var(--mote-1)",
  height: -(38 + ((i * 7) % 18)),
}));

// White tape dropouts flicking across the picture now and then; hidden unless the theme sets
// --mote-dropout-display
const DROPOUTS = [
  { left: 12, top: 24, width: 46, duration: 7, delay: -1 },
  { left: 64, top: 33, width: 26, duration: 9, delay: -4 },
  { left: 28, top: 61, width: 70, duration: 8, delay: -6 },
  { left: 78, top: 56, width: 34, duration: 6, delay: -2.5 },
  { left: 8, top: 84, width: 30, duration: 10, delay: -8 },
];

// A puffed-up kernel: overlapping cream puffs and a bit of golden hull
const PopcornIcon = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <circle cx="8" cy="10" r="5" fill="#fff3d1" />
    <circle cx="14.5" cy="8" r="5" fill="#fff8e6" />
    <circle cx="17" cy="13.5" r="4.4" fill="#ffefc4" />
    <circle cx="11.5" cy="14.5" r="5.2" fill="#fff6dc" />
    <circle cx="6.5" cy="15" r="3.8" fill="#ffeab8" />
    <circle cx="13" cy="11" r="2.2" fill="#ffffff" />
    <path d="M9.5 19.2c1.4 1.9 4.2 2.1 5.8.2-.8-1.5-2.3-2.2-3.2-2.1-1.1 0-2 .7-2.6 1.9z" fill="#d4902a" />
  </svg>
);

const moteStyle = (mote: Mote): CSSProperties =>
  ({
    left: `${mote.left}%`,
    "--mote-size": `${mote.size}px`,
    "--mote-duration": `${mote.duration}s`,
    "--mote-delay": `${mote.delay}s`,
    "--mote-drift": `${mote.drift}px`,
    "--mote-sway": `${mote.sway}px`,
    "--mote-color": mote.color,
  }) as CSSProperties;

/** Faint lights drifting upward, snow falling or popcorn popping, depending on the theme (decorative; hidden with reduced motion) */
export const Motes = ({ className }: { className?: string }) => (
  <div aria-hidden data-html2canvas-ignore className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
    {MOTES.map((mote, i) => (
      <span key={i} className="mote" style={moteStyle(mote)} />
    ))}
    {CRYSTALS.map((crystal, i) => (
      <span
        key={`crystal-${i}`}
        className="mote mote-crystal"
        style={{ ...moteStyle(crystal), "--crystal-spin": `${crystal.spin}s` } as CSSProperties}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          style={{ animationDirection: crystal.reverse ? "reverse" : "normal" }}
        >
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <path key={angle} d={CRYSTAL_ARM} transform={`rotate(${angle} 12 12)`} />
          ))}
        </svg>
      </span>
    ))}
    {POPCORN.map((piece, i) => (
      <span
        key={`popcorn-${i}`}
        className="mote mote-popcorn"
        style={{ ...moteStyle(piece), "--pop-height": `${piece.height}vh` } as CSSProperties}
      >
        <PopcornIcon />
      </span>
    ))}
    {DROPOUTS.map((dropout, i) => (
      <span
        key={`dropout-${i}`}
        className="mote-dropout"
        style={
          {
            left: `${dropout.left}%`,
            top: `${dropout.top}%`,
            width: dropout.width,
            "--mote-duration": `${dropout.duration}s`,
            "--mote-delay": `${dropout.delay}s`,
          } as CSSProperties
        }
      />
    ))}
  </div>
);
