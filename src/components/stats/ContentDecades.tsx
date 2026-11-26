import { motion } from "framer-motion";
import { History } from "lucide-react";
import { StatCard } from "./StatCard";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";
import { SectionHeader } from "./SectionHeader";
import { formatDuration } from "@/lib/tautulli";

interface ContentDecadesProps {
  decades: { decade: string; count: number; watchTime: number }[];
}

export const ContentDecades = ({ decades }: ContentDecadesProps) => {
  if (decades.length === 0) return null;

  const maxTime = Math.max(...decades.map(d => d.watchTime));

  return (
    <div className="space-y-6">
      <SectionHeader icon={History} title="Your Time Machine" subtitle="Which era do you love most?" />

      <StatCard>
        <div className="space-y-4">
          {decades.map((decade, index) => (
            <motion.div
              key={decade.decade}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VIEWPORT}
              transition={{ delay: index * 0.1, duration: 0.7, ease: EASE_OUT_EXPO }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-primary">{decade.decade}</span>
                  <span className="text-muted-foreground text-sm">
                    {decade.count} {decade.count === 1 ? 'play' : 'plays'}
                  </span>
                </div>
                <span className="text-foreground font-medium">{formatDuration(decade.watchTime)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(decade.watchTime / maxTime) * 100}%` }}
                  viewport={VIEWPORT}
                  transition={{ delay: index * 0.1, duration: 1, ease: EASE_OUT_EXPO }}
                  className="h-full bg-gradient-to-r from-cyan to-blue rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </StatCard>
    </div>
  );
};