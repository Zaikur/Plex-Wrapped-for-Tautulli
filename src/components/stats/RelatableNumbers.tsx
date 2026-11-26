import { motion } from "framer-motion";
import { StatCard } from "./StatCard";
import { getRelatableFacts } from "@/lib/relatable";
import { SPRING_POP, VIEWPORT } from "@/lib/motion";
import type { YearSelection } from "@/components/YearSelector";
import type { WrappedStats } from "@/types/tautulli";

interface RelatableNumbersProps {
  stats: Pick<WrappedStats, "totalWatchTime" | "movieWatchTime" | "topShow">;
  selection: YearSelection;
  isGroup: boolean;
}

export const RelatableNumbers = ({ stats, selection, isGroup }: RelatableNumbersProps) => {
  const facts = getRelatableFacts({ stats, selection, isGroup });
  if (facts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/60" />
        <p className="text-sm font-semibold text-primary tracking-[0.25em] uppercase">Picture this</p>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/60" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facts.map((fact, index) => (
          <StatCard key={fact.label} delay={0.1 + index * 0.1}>
            <div className="flex items-center gap-4">
              <motion.div
                className="text-4xl shrink-0"
                aria-hidden
                initial={{ scale: 0, rotate: -25 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={VIEWPORT}
                transition={{ ...SPRING_POP, delay: 0.3 + index * 0.1 }}
              >
                {fact.emoji}
              </motion.div>
              <div className="min-w-0">
                <p className="font-display text-3xl md:text-4xl font-extrabold tracking-tight gradient-value break-words">{fact.value}</p>
                <p className="text-sm text-muted-foreground">{fact.label}</p>
              </div>
            </div>
          </StatCard>
        ))}
      </div>
    </div>
  );
};
