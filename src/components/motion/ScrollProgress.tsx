import { motion, useScroll, useSpring } from "framer-motion";

/** A thin gradient bar across the top of the screen that fills as the report is scrolled */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden
      data-html2canvas-ignore
      style={{ scaleX }}
      className="fixed top-0 inset-x-0 z-40 h-[3px] origin-left pointer-events-none bg-gradient-to-r from-cyan via-purple to-pink shadow-[0_0_12px_hsl(var(--purple)/0.7)]"
    />
  );
};
