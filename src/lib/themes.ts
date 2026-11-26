// Report themes, picked in the Admin Panel. Shared by the server (validation, index.html,
// manifest) and the web app, so nothing here may touch the DOM.
//
// The web app's colours live in index.css, one [data-theme] block per theme. Exported images
// can't use CSS variables (html2canvas), so they get their own palettes below: keep the two in step.
// Like index.css, the palettes keep the default theme's names for the three gradient colours (cyan,
// purple, pink), whatever colour a theme gives them.

export const THEME_IDS = ["default", "gold", "frost", "vhs", "rental"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "default";

/** Colours for the exported images, as hex (the exports add alpha suffixes like `${color}15`) */
export interface ExportColors {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  cyan: string;
  purple: string;
  pink: string;
  orange: string;
  yellow: string;
  green: string;
  blue: string;
  /** The hour heatmap's tiles */
  heat: string;
  /** Behind the full report's hero */
  heroGradient: string;
  /** Behind every story slide, when it isn't plain `bg` */
  slideBackground?: string;
}

/** Extra scenery: in the hero (components/motion/HeroDecor.tsx) and on the story slides */
export type ThemeDecor = "none" | "vhs" | "rental";

/** What the top movie and show come in before they're revealed */
export type ThemeReveal = "gift" | "blankTape" | "rentalCase";

export interface ThemeInfo {
  label: string;
  description: string;
  /** The page background: browser theme colour and the installed app's background */
  background: string;
  decor: ThemeDecor;
  reveal: ThemeReveal;
  exportColors: ExportColors;
}

export const THEMES: Record<ThemeId, ThemeInfo> = {
  default: {
    label: "Default",
    description: "Teal, violet and pink on near-black",
    background: "#09090b",
    decor: "none",
    reveal: "gift",
    exportColors: {
      bg: "#0a0a0f",
      card: "#0f0f14",
      cardAlt: "#141419",
      text: "#fafafa",
      textMuted: "#71717a",
      cyan: "#00d4aa",
      purple: "#a855f7",
      pink: "#ec4899",
      orange: "#f97316",
      yellow: "#eab308",
      green: "#22c55e",
      blue: "#3b82f6",
      heat: "#00d4aa",
      heroGradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 50%, rgba(6, 182, 212, 0.08) 100%)",
    },
  },
  gold: {
    label: "Plex Gold",
    description: "Plex amber, orange and ember red on warm charcoal",
    background: "#0c0a08",
    decor: "none",
    reveal: "gift",
    exportColors: {
      bg: "#0c0a08",
      card: "#15120e",
      cardAlt: "#1c1813",
      text: "#faf6ef",
      textMuted: "#8a7f70",
      cyan: "#e5a00d",
      purple: "#f97316",
      pink: "#e64f37",
      orange: "#fa9b2e",
      yellow: "#fac72e",
      green: "#77b34d",
      blue: "#599ecf",
      heat: "#e5a00d",
      heroGradient: "linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(230, 79, 55, 0.1) 50%, rgba(229, 160, 13, 0.08) 100%)",
    },
  },
  frost: {
    label: "Midnight Frost",
    description: "Ice blue, lavender and silver on deep navy, with berry red touches and falling snow",
    background: "#0b1426",
    decor: "none",
    reveal: "gift",
    exportColors: {
      bg: "#0b1426",
      card: "#0f1b31",
      cardAlt: "#142340",
      text: "#f1f6fd",
      textMuted: "#7d8fab",
      cyan: "#7dd3fc",
      purple: "#a5b4fc",
      pink: "#e2e8f0",
      orange: "#eb5c68",
      yellow: "#f8d877",
      green: "#61d1ac",
      blue: "#5a9bf6",
      heat: "#7dd3fc",
      heroGradient: "linear-gradient(135deg, rgba(165, 180, 252, 0.15) 0%, rgba(226, 232, 240, 0.08) 50%, rgba(125, 211, 252, 0.1) 100%)",
    },
  },
  vhs: {
    label: "VHS Rewind",
    description: "Retro CRT/VHS theme in black, cream and rainbow stripes",
    background: "#0e0d0c",
    decor: "vhs",
    reveal: "blankTape",
    exportColors: {
      bg: "#0e0d0c",
      card: "#171615",
      cardAlt: "#1d1b19",
      text: "#f3ead3",
      textMuted: "#8f877a",
      cyan: "#ffc93c",
      purple: "#4d8af0",
      pink: "#e8322f",
      orange: "#f5821f",
      yellow: "#ffd96b",
      green: "#3fae49",
      blue: "#2f6fd8",
      heat: "#ffc93c",
      heroGradient: "linear-gradient(160deg, rgba(232, 50, 47, 0.12) 0%, rgba(245, 130, 31, 0.07) 45%, rgba(47, 111, 216, 0.1) 100%)",
    },
  },
  rental: {
    label: "Rental Night",
    description: "Video-store blue and yellow with popcorn",
    background: "#06184a",
    decor: "rental",
    reveal: "rentalCase",
    exportColors: {
      bg: "#06184a",
      card: "#0a2363",
      cardAlt: "#0f2f7f",
      text: "#ffffff",
      textMuted: "#a7b8e2",
      cyan: "#ffa903",
      purple: "#8fb1ff",
      pink: "#ffffff",
      orange: "#ffbf47",
      yellow: "#ffd36b",
      green: "#5fd39a",
      blue: "#5d8bff",
      heat: "#ffffff",
      heroGradient: "radial-gradient(ellipse at 50% 30%, rgba(26, 86, 209, 0.9) 0%, rgba(13, 63, 169, 0.55) 45%, rgba(6, 24, 74, 0) 100%)",
      slideBackground: "radial-gradient(ellipse at 50% 25%, #1a56d1 0%, #0d3fa9 40%, #06184a 100%)",
    },
  },
};

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);

/** A theme by id; anything unknown falls back to the default */
export const getTheme = (id: unknown): ThemeInfo => THEMES[isThemeId(id) ? id : DEFAULT_THEME];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** VHS Rewind's camcorder date stamp, as [date, time], e.g. ["OCT 04 2026", "8:05 PM"] */
export const camcorderDate = (now = new Date()): [string, string] => {
  const hours = now.getHours();
  const date = `${MONTHS[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")} ${now.getFullYear()}`;
  return [date, `${hours % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`];
};

/** "#rrggbb" plus an alpha, as rgba() */
export const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
