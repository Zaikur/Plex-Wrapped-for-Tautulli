import { motion } from "framer-motion";
import { Calendar, Play, Zap, Rocket } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatDuration } from "@/lib/tautulli";

interface JourneyStatsProps {
  firstWatch: { title: string; date: string } | null;
  lastWatch: { title: string; date: string } | null;
  longestStreak: number;
  totalSessions: number;
  isAllTime?: boolean;
}

export const JourneyStats = ({ firstWatch, lastWatch, longestStreak, totalSessions, isAllTime = false }: JourneyStatsProps) => {
  const startedText = isAllTime ? "Your journey started with" : "Your year started with";
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          whileInView={{ rotate: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/30 to-blue/30 mb-4"
        >
          <Rocket className="w-7 h-7 text-cyan" />
        </motion.div>
        <h2 className="text-3xl font-bold gradient-text">Your Journey</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {firstWatch && (
          <StatCard delay={0.1}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="w-4 h-4 text-green" />
                <span>{startedText}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{firstWatch.title}</p>
              <p className="text-sm text-muted-foreground">{firstWatch.date}</p>
            </div>
          </StatCard>
        )}

        {lastWatch && (
          <StatCard delay={0.2}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Calendar className="w-4 h-4 text-pink" />
                <span>Most recently watched</span>
              </div>
              <p className="text-xl font-bold text-foreground">{lastWatch.title}</p>
              <p className="text-sm text-muted-foreground">{lastWatch.date}</p>
            </div>
          </StatCard>
        )}

        <StatCard delay={0.3}>
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
              <Zap className="w-4 h-4 text-yellow" />
              <span>Longest Streak</span>
            </div>
            <motion.p
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
              className="text-5xl font-extrabold gradient-text"
            >
              {longestStreak}
            </motion.p>
            <p className="text-sm text-muted-foreground mt-2">consecutive days</p>
          </div>
        </StatCard>

        <StatCard delay={0.4}>
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
              <Play className="w-4 h-4 text-orange" />
              <span>Total Sessions</span>
            </div>
            <motion.p
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
              className="text-5xl font-extrabold gradient-text"
            >
              {totalSessions.toLocaleString()}
            </motion.p>
            <p className="text-sm text-muted-foreground mt-2">play sessions</p>
          </div>
        </StatCard>
      </div>
    </div>
  );
};
