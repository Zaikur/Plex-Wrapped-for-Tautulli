import { useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { KineticText } from "@/components/motion/KineticText";
import { useMagnetic } from "@/hooks/use-magnetic";
import { fireConfetti } from "@/lib/confetti";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";

interface FinaleProps {
  /** The viewer's name, or null for everyone's report */
  name: string | null;
  showExport: boolean;
  isExporting: boolean;
  onExport: () => void;
}

/** The end of the report: "That's a wrap", a confetti send-off and the slide export */
export const Finale = ({ name, showExport, isExporting, onExport }: FinaleProps) => {
  const headlineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headlineRef, { once: true, amount: 0.6 });
  const magnet = useMagnetic(10);

  // Two confetti cannons, once, when the headline comes into view
  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => {
      const rect = headlineRef.current?.getBoundingClientRect();
      if (!rect) return;
      fireConfetti({ x: rect.left + rect.width * 0.15, y: rect.top + rect.height / 2 }, { angle: 65, spread: 50, count: 70 });
      fireConfetti({ x: rect.left + rect.width * 0.85, y: rect.top + rect.height / 2 }, { angle: 115, spread: 50, count: 70 });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [inView]);

  return (
    <footer className="relative text-center px-4 pt-16 pb-24">
      <div ref={headlineRef}>
        <KineticText
          as="h2"
          text="That's a wrap."
          gradient
          className="font-display text-5xl md:text-7xl font-extrabold tracking-tighter leading-none"
        />
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ delay: 0.5, duration: 0.8, ease: EASE_OUT_EXPO }}
          className="mt-5 text-lg md:text-xl text-muted-foreground"
        >
          {name ? `See you next year, ${name}.` : "See you next year."}
        </motion.p>
      </div>

      {showExport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ delay: 0.7, duration: 0.8, ease: EASE_OUT_EXPO }}
          className="mt-12"
        >
          <motion.button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            style={magnet.style}
            {...magnet.handlers}
            className="group relative inline-flex overflow-hidden rounded-full p-[2px] shadow-[0_10px_40px_-10px_hsl(var(--purple)/0.8)] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-80"
          >
            {/* The ring: brand colours chasing around the button */}
            <span
              aria-hidden
              className="absolute -inset-full animate-spin-slow"
              style={{
                animationDuration: "4s",
                background: "conic-gradient(from 0deg, hsl(var(--cyan)), hsl(var(--purple)), hsl(var(--pink)), hsl(var(--cyan)))",
              }}
            />
            <span className="shine relative flex items-center gap-2 rounded-full bg-background/90 px-8 py-4 text-lg font-semibold text-foreground transition-colors group-hover:bg-background/75">
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                  Export Slides
                </>
              )}
            </span>
          </motion.button>
          <p className="text-sm text-muted-foreground mt-4">Download your wrapped report as shareable story slides</p>
        </motion.div>
      )}

      <p className="text-sm text-muted-foreground/50 mt-14">Powered by Tautulli</p>
    </footer>
  );
};
