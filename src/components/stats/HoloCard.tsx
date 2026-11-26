import type { PointerEvent, ReactNode } from "react";
import { motion, useMotionTemplate, useTransform } from "framer-motion";
import { usePointerTilt } from "@/hooks/use-pointer-tilt";
import { spotlightHandlers } from "@/lib/spotlight";
import { EASE_OUT_EXPO, CARD_VIEWPORT, CARD_HIDDEN, CARD_SHOWN } from "@/lib/motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

/**
 * A card like a holographic trading card: it tilts toward the mouse, and a rainbow foil
 * slides across it as it moves.
 */
export const HoloCard = ({ children, className, tint }: {
  children: ReactNode;
  className?: string;
  /** Classes for a colour wash across the whole card, under the foil */
  tint?: string;
}) => {
  const { ref, shown } = useScrollReveal(CARD_VIEWPORT);
  const tilt = usePointerTilt(8);
  const foilPosition = useMotionTemplate`${tilt.glareX} ${tilt.glareY}`;
  const foilOpacity = useTransform(tilt.hover, [0, 1], [0.18, 0.55]);
  const glare = useMotionTemplate`radial-gradient(circle at ${tilt.glareX} ${tilt.glareY}, rgb(255 255 255 / 0.14), transparent 45%)`;

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    spotlightHandlers.onPointerMove(event);
    tilt.handlers.onPointerMove(event);
  };
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    spotlightHandlers.onPointerLeave(event);
    tilt.handlers.onPointerLeave();
  };

  return (
    <motion.div
      ref={ref}
      initial={CARD_HIDDEN}
      animate={shown ? CARD_SHOWN : CARD_HIDDEN}
      transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 1000 }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn("stat-card relative overflow-hidden", className)}
    >
      {tint && <div aria-hidden className={cn("absolute inset-0 pointer-events-none", tint)} />}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-color-dodge"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 15%, hsl(var(--cyan) / 0.55) 30%, hsl(var(--purple) / 0.5) 42%, hsl(var(--pink) / 0.55) 54%, hsl(var(--yellow) / 0.45) 66%, transparent 82%)",
          backgroundSize: "250% 250%",
          backgroundPosition: foilPosition,
          opacity: foilOpacity,
        }}
      />
      <motion.div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: glare, opacity: tilt.hover }} />
      <div className="relative">{children}</div>
    </motion.div>
  );
};
