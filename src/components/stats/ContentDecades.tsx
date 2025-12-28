import { motion } from "framer-motion";
import { History } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatDuration } from "@/lib/tautulli";

interface ContentDecadesProps {
  decades: { decade: string; count: number; watchTime: number }[];
}

export const ContentDecades = ({ decades }: ContentDecadesProps) => {
  if (decades.length === 0) return null;

  const maxTime = Math.max(...decades.map(d => d.watchTime));

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          whileInView={{ rotate: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-bg mb-4"
        >
          <History className="w-7 h-7 text-primary" />
        </motion.div>
        <h2 className="text-3xl font-bold gradient-text">Your Time Machine</h2>
        <p className="text-muted-foreground mt-2">Which era do you love most?</p>
      </div>

      <StatCard>
        <div className="space-y-4">
          {decades.map((decade, index) => (
            <motion.div
              key={decade.decade}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
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
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(decade.watchTime / maxTime) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  className="h-full gradient-bg rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </StatCard>
    </div>
  );
};