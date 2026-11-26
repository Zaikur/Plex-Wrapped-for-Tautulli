// Shared motion tokens, so every part of the report moves with the same feel
import type { Transition } from "framer-motion";

// Fast start, long soft landing: the default for anything entering the screen
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

// Lively overshoot for badges, icons and anything that "pops"
export const SPRING_POP: Transition = { type: "spring", stiffness: 260, damping: 18 };
// Calm settle for larger elements and layout changes
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 120, damping: 20 };

// Scroll-triggered animations play when they come into view and rewind when they leave it,
// so scrolling back up replays them
export const VIEWPORT = { once: false, amount: 0.25 } as const;
// Cards: no amount, so a card taller than the screen still counts as in view
export const CARD_VIEWPORT = { once: false, margin: "-50px" } as const;
// A card's pose before it rises into view, and once it has
export const CARD_HIDDEN = { opacity: 0, y: 40, scale: 0.97 };
export const CARD_SHOWN = { opacity: 1, y: 0, scale: 1 };

export type PaletteColor = "cyan" | "purple" | "pink" | "orange" | "yellow" | "gold" | "white";

// The default theme's colours, for when the current theme's can't be read
const FALLBACK: Record<PaletteColor, string> = {
  cyan: "hsl(173 80% 50%)",
  purple: "hsl(280 80% 55%)",
  pink: "hsl(326 80% 60%)",
  orange: "hsl(25 95% 55%)",
  yellow: "hsl(45 95% 55%)",
  gold: "hsl(43 96% 62%)",
  white: "hsl(0 0% 98%)",
};

const PALETTE_VARS: Record<PaletteColor, string | null> = {
  cyan: "--cyan",
  purple: "--purple",
  pink: "--pink",
  orange: "--orange",
  yellow: "--yellow",
  gold: "--sparkle",
  white: null,
};

/** The current theme's accent colours (from index.css) for confetti and canvas effects, which can't use CSS variables */
export const getPalette = (): Record<PaletteColor, string> => {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    (Object.keys(FALLBACK) as PaletteColor[]).map((name) => {
      const variable = PALETTE_VARS[name];
      const value = variable && style.getPropertyValue(variable).trim();
      return [name, value ? `hsl(${value})` : FALLBACK[name]];
    })
  ) as Record<PaletteColor, string>;
};
