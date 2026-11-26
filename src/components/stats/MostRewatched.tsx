import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Heart } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatDuration, getImageUrl } from "@/lib/tautulli";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";
import type { WrappedStats } from "@/types/tautulli";

interface MostRewatchedProps {
  mostRewatched: WrappedStats["mostRewatched"];
  isGroup?: boolean;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const MostRewatched = ({ mostRewatched, isGroup = false }: MostRewatchedProps) => {
  // Remembered per image, so another report's poster isn't hidden by an earlier failure
  const [failedThumb, setFailedThumb] = useState<string | null>(null);
  if (!mostRewatched) return null;
  const showPoster = Boolean(mostRewatched.thumb) && mostRewatched.thumb !== failedThumb;
  const byViewers = isGroup && mostRewatched.userCount > 1 ? `by ${plural(mostRewatched.userCount, "viewer")}` : "";
  const detail =
    mostRewatched.type === "show"
      ? `${plural(mostRewatched.episodeCount, "episode")} rewatched ${byViewers}`.trim()
      : byViewers && `Rewatched ${byViewers}`;

  return (
    <StatCard className="overflow-hidden">
      <div className="relative">
        <div className="absolute inset-0 gradient-bg opacity-30" />
        <div className="relative text-center py-8">
          {showPoster ? (
            <motion.div
              initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
              whileInView={{ scale: 1, rotate: 0, opacity: 1 }}
              viewport={VIEWPORT}
              transition={{ type: "spring", stiffness: 150 }}
              className="relative mx-auto w-28 h-[168px] mb-6"
            >
              {/* A dashed ring turning backwards behind the poster: rewind */}
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -ml-28 -mt-28 w-56 h-56 rounded-full border-2 border-dashed border-pink/30 animate-spin-slow-reverse"
              />
              <div aria-hidden className="absolute left-1/2 top-1/2 -ml-24 -mt-24 w-48 h-48 rounded-full bg-pink/10 blur-2xl" />
              <img
                src={getImageUrl(mostRewatched.thumb!)}
                alt={mostRewatched.title}
                loading="lazy"
                onError={() => setFailedThumb(mostRewatched.thumb ?? null)}
                className="relative w-full h-full object-cover rounded-lg shadow-2xl ring-1 ring-white/10"
              />
              <div className="absolute -bottom-2 -right-2 flex items-center justify-center w-9 h-9 rounded-xl bg-heart shadow-lg">
                <Heart className="w-5 h-5 text-white fill-white" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={VIEWPORT}
              transition={{ type: "spring", stiffness: 150 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-heart/20 mb-4"
            >
              <Heart className="w-10 h-10 text-heart" />
            </motion.div>
          )}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mb-2"
          >
            {isGroup ? "The server's comfort watch" : "Your comfort watch"}
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.3 }}
            className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter leading-[1.05] gradient-value mb-4 px-4"
          >
            {mostRewatched.title}
          </motion.h3>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground"
          >
            <div className="flex items-center justify-center gap-2">
              <motion.span
                className="inline-flex"
                initial={{ rotate: 0 }}
                whileInView={{ rotate: -360 }}
                viewport={VIEWPORT}
                transition={{ delay: 0.5, duration: 1.2, ease: EASE_OUT_EXPO }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.span>
              <span>
                <span className="text-foreground font-bold">{formatDuration(mostRewatched.rewatchTime)}</span> spent
                rewatching
              </span>
            </div>
            {detail && <p className="text-sm mt-1">{detail}</p>}
          </motion.div>
        </div>
      </div>
    </StatCard>
  );
};