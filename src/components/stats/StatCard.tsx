import { motion } from "framer-motion";
import { ReactNode } from "react";
import { EASE_OUT_EXPO, CARD_VIEWPORT, CARD_HIDDEN, CARD_SHOWN } from "@/lib/motion";
import { spotlightHandlers } from "@/lib/spotlight";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface StatCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const StatCard = ({ children, delay = 0, className = "" }: StatCardProps) => {
  const { ref, shown } = useScrollReveal(CARD_VIEWPORT);

  return (
    <motion.div
      ref={ref}
      initial={CARD_HIDDEN}
      animate={shown ? CARD_SHOWN : CARD_HIDDEN}
      transition={{ duration: 0.9, delay, ease: EASE_OUT_EXPO }}
      {...spotlightHandlers}
      className={`stat-card ${className}`}
    >
      {children}
    </motion.div>
  );
};
