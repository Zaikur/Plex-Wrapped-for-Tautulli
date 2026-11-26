// Theme scenery for the hero screens: VHS Rewind's tape sleeve and CRT screen, Rental Night's
// store lighting and shelf of tapes. Purely decorative, and never part of an exported image.

import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "@/hooks/use-theme";
import { camcorderDate } from "@/lib/themes";

/** The current time, updated as each minute turns */
const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const date = new Date();
      const untilNextMinute = 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextMinute);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
};

const OSD: CSSProperties = { fontFamily: "'VT323', monospace", textShadow: "0 0 8px rgb(255 255 255 / 0.6)" };

// The tape sleeve's rainbow, hard-edged
const SLEEVE_STRIPES = "linear-gradient(180deg, #e8322f 0 20%, #f5821f 20% 40%, #ffc93c 40% 60%, #3fae49 60% 80%, #2f6fd8 80% 100%)";
// A CRT: fine dark lines and darker corners
const SCANLINES =
  "repeating-linear-gradient(180deg, rgb(0 0 0 / 0.28) 0 1px, transparent 1px 3px), radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.6) 100%)";
const STORE_LIGHT = "radial-gradient(ellipse at 50% 30%, #1a56d1 0%, #0d3fa9 40%, transparent 80%)";
// Rounded plastic: lit from the left
const SPINE_SHEEN = "linear-gradient(90deg, rgb(255 255 255 / 0.18) 0%, transparent 32%, transparent 68%, rgb(0 0 0 / 0.32) 100%)";
const COVER_GLOSS = "linear-gradient(115deg, rgb(255 255 255 / 0.24) 0 16%, transparent 32%)";

// ---------- Rental Night's shelf ----------

const SPINE_HEIGHT = 88;
const LEAN = 8; // degrees, for the last tape leaning on its neighbour
// Pivoting on its bottom-left corner, the leaning tape's top-left corner swings left by
// height·sin(lean): standing that far off, it rests against its neighbour instead of overlapping it
const LEAN_GAP = Math.ceil(SPINE_HEIGHT * Math.sin((LEAN * Math.PI) / 180)) + 1;

type ShelfItem =
  | { kind: "spine"; title: string; color: string; band: string; ink: string; lean?: boolean }
  | { kind: "cover"; title: string; art: string };

// Every tape the same height, a coloured band at the top, the title down the spine and the store's
// sticker at the bottom; two face out
const SHELF: ShelfItem[] = [
  { kind: "spine", title: "ALIENS", color: "#0b0b0b", band: "#c9c9c9", ink: "#e8e8e8" },
  { kind: "spine", title: "JAWS", color: "#0f2a5c", band: "#e8322f", ink: "#ffffff" },
  { kind: "spine", title: "GREASE", color: "#f1ece1", band: "#d94f8a", ink: "#1b1b1b" },
  { kind: "spine", title: "TOP GUN", color: "#111111", band: "#ffa903", ink: "#ffa903" },
  { kind: "spine", title: "GHOST", color: "#2b2b33", band: "#8fb1ff", ink: "#ffffff" },
  { kind: "cover", title: "DUNE", art: "radial-gradient(circle at 70% 28%, #ffe2a8 0 9px, transparent 10px), linear-gradient(180deg, #f6a04d 0%, #c8582a 55%, #6b2a14 100%)" },
  { kind: "spine", title: "BIG", color: "#e8322f", band: "#ffffff", ink: "#ffffff" },
  { kind: "spine", title: "HEAT", color: "#14161a", band: "#3a86ff", ink: "#d6d6d6" },
  { kind: "spine", title: "SPEED", color: "#ffd23f", band: "#111111", ink: "#111111" },
  { kind: "spine", title: "CLUE", color: "#4a1d5c", band: "#f4a261", ink: "#ffffff" },
  { kind: "spine", title: "ROCKY", color: "#0b0b0b", band: "#e8322f", ink: "#ffffff" },
  { kind: "cover", title: "WILD ROBOT", art: "radial-gradient(circle at 50% 36%, #ffe9a8 0 7px, transparent 8px), linear-gradient(180deg, #8fd3c8 0%, #3e8f6e 60%, #1f4d3a 100%)" },
  { kind: "spine", title: "TWISTER", color: "#2a3b2f", band: "#9ad19c", ink: "#ffffff" },
  { kind: "spine", title: "HOOK", color: "#f1ece1", band: "#0d3fa9", ink: "#0d3fa9" },
  { kind: "spine", title: "GREMLINS", color: "#111111", band: "#7ac74f", ink: "#ffffff", lean: true },
];

const StoreSticker = ({ className }: { className: string }) => (
  <div className={`absolute rounded-[1px] bg-[#ffa903] shadow-[inset_0_0_0_1.5px_#0d3fa9] ${className}`} />
);

const Shelf = () => (
  <div className="absolute inset-x-0 bottom-0">
    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#041034]/85" />
    <div className="relative flex items-end justify-center gap-px overflow-hidden px-4 pt-3">
      {SHELF.map((item, i) =>
        item.kind === "spine" ? (
          <div
            key={i}
            className="relative w-5 shrink-0 overflow-hidden rounded-[2px] shadow-[0_2px_4px_rgb(0_0_0/0.45)]"
            style={{
              height: SPINE_HEIGHT,
              background: item.color,
              ...(item.lean && { marginLeft: LEAN_GAP, transform: `rotate(-${LEAN}deg)`, transformOrigin: "0 100%" }),
            }}
          >
            <div className="absolute inset-x-0 top-0 h-3" style={{ background: item.band }} />
            <div
              className="absolute inset-x-0 top-4 bottom-5 flex items-center justify-center overflow-hidden whitespace-nowrap text-[9px] font-extrabold tracking-[0.04em] [writing-mode:vertical-rl]"
              style={{ color: item.ink }}
            >
              {item.title}
            </div>
            <StoreSticker className="inset-x-[3px] bottom-[5px] h-2.5" />
            <div className="absolute inset-0" style={{ background: SPINE_SHEEN }} />
          </div>
        ) : (
          <div
            key={i}
            className="relative mx-1 w-[60px] shrink-0 overflow-hidden rounded-[3px] shadow-[0_3px_8px_rgb(0_0_0/0.55),inset_0_0_0_2px_rgb(0_0_0/0.35)]"
            style={{ height: SPINE_HEIGHT, background: item.art }}
          >
            <div className="absolute inset-x-1 bottom-2 text-center text-[11px] font-extrabold leading-none tracking-[0.04em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
              {item.title}
            </div>
            <StoreSticker className="right-1 top-1 h-2 w-3" />
            <div className="absolute inset-0" style={{ background: COVER_GLOSS }} />
          </div>
        ),
      )}
    </div>
    <div
      className="relative flex h-[22px] items-center border-t-4 border-primary bg-gradient-to-b from-[#0d2c78] to-[#081d55] pl-5 text-[10px] tracking-[0.18em] text-primary shadow-[0_-6px_10px_rgb(0_0_0/0.35)]"
      style={{ fontFamily: "'Archivo Black', sans-serif" }}
    >
      NEW RELEASES
    </div>
  </div>
);

/** Scenery behind the hero's content */
export const HeroBackdrop = () => {
  const { decor } = useTheme();
  if (decor === "none") return null;

  return (
    <div aria-hidden data-html2canvas-ignore className="absolute inset-0 overflow-hidden pointer-events-none">
      {decor === "vhs" ? (
        // A band of the tape sleeve's stripes, slanting down across the lower half (clear of the date stamp)
        <div
          className="absolute -inset-x-1/3 bottom-[14%] h-20 rotate-12 shadow-[0_0_30px_rgb(0_0_0/0.6)]"
          style={{ background: SLEEVE_STRIPES }}
        />
      ) : (
        <>
          {/* The store's lights on the royal blue walls */}
          <div className="absolute inset-0" style={{ background: STORE_LIGHT }} />
          <Shelf />
        </>
      )}
    </div>
  );
};

/**
 * VHS Rewind's screen: the on-screen display, a camcorder date stamp showing the current date and time,
 * the tracking band and scanlines. The display sits below the corners, clear of the admin badge and buttons.
 */
const VhsScreen = () => {
  const [date, time] = camcorderDate(useClock());

  return (
    <div aria-hidden data-html2canvas-ignore className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="vhs-tracking" />
      <div className="absolute left-6 top-16 text-3xl leading-none text-white" style={OSD}>PLAY ►</div>
      <div className="absolute right-6 top-16 text-3xl leading-none text-white" style={OSD}>SP</div>
      <div
        className="absolute bottom-6 left-6 text-[28px] leading-[0.95] text-primary"
        style={{ ...OSD, textShadow: "0 0 6px hsl(var(--primary) / 0.7), 2px 2px 0 rgb(0 0 0 / 0.6)" }}
      >
        <div>{date}</div>
        <div>{time}</div>
      </div>
      <div className="absolute inset-0" style={{ background: SCANLINES }} />
    </div>
  );
};

/** The screen in front of the hero's content (VHS Rewind only) */
export const HeroScreen = () => {
  const { decor } = useTheme();
  return decor === "vhs" ? <VhsScreen /> : null;
};
