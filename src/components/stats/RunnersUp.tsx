import { useState } from "react";
import { motion } from "framer-motion";
import { Film, Tv } from "lucide-react";
import { ScrollingText } from "@/components/motion/ScrollingText";
import { formatDuration, getImageUrl } from "@/lib/tautulli";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";

export interface RunnerUp {
  title: string;
  /** Year or episode count, plus viewers in everyone's report */
  detail: string;
  totalTime: number;
  plays?: number;
  thumb?: string;
}

const Thumb = ({ thumb, type }: { thumb?: string; type: "movie" | "show" }) => {
  // Remembered per image, so another report's poster isn't hidden by an earlier failure
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = type === "movie" ? Film : Tv;
  return (
    <div className="relative w-9 h-[54px] shrink-0 overflow-hidden rounded-md bg-muted/40 ring-1 ring-white/10">
      {thumb && failed !== thumb ? (
        <img src={getImageUrl(thumb)} alt="" loading="lazy" onError={() => setFailed(thumb)} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

/** Places 2–5 of a top 5, shown in the drawer that slides out under the #1 tile */
export const RunnersUp = ({ type, items, maxTime }: {
  type: "movie" | "show";
  items: RunnerUp[];
  /** Longest watch time in the top 5, for the bars */
  maxTime: number;
}) => {
  const bar = type === "movie" ? "from-orange to-pink" : "from-cyan to-purple";

  return (
    <div>
      <div className="space-y-1">
        {items.map((row, index) => (
          <motion.div
            key={row.title}
            initial={{ opacity: 0, y: -12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.12 + index * 0.07, duration: 0.6, ease: EASE_OUT_EXPO }}
            className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
          >
            <span className="w-7 shrink-0 text-center font-display text-3xl font-extrabold leading-none tracking-tighter text-ghost transition-transform duration-300 group-hover:scale-110">
              {index + 2}
            </span>
            <Thumb thumb={row.thumb} type={type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3">
                <ScrollingText text={row.title} className="flex-1 font-semibold text-foreground" />
                <span className="shrink-0 text-sm font-medium text-primary">{formatDuration(row.totalTime)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-xs text-muted-foreground">{row.detail}</span>
                {row.plays !== undefined && row.plays > 1 && (
                  <span className="shrink-0 text-xs text-muted-foreground">{row.plays}x plays</span>
                )}
              </div>
              {/* Watch time against the longest in the top 5 */}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/40">
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: row.totalTime / maxTime }}
                  viewport={VIEWPORT}
                  transition={{ delay: 0.3 + index * 0.07, duration: 1, ease: EASE_OUT_EXPO }}
                  className={`h-full w-full origin-left rounded-full bg-gradient-to-r ${bar} opacity-70 transition-opacity group-hover:opacity-100`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
