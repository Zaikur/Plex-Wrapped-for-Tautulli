import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";
import { SPRING_POP, VIEWPORT } from "@/lib/motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface MonthlyTrendsProps {
  watchByMonth: { month: string; hours: number }[];
}

// Short enough for all 12 bars side by side on a phone: whole hours, thousands as "1.2k"
const shortHours = (hours: number) => (hours >= 1000 ? `${(hours / 1000).toFixed(1)}k` : `${Math.round(hours)}h`);

export const MonthlyTrends = ({ watchByMonth }: MonthlyTrendsProps) => {
  const maxHours = Math.max(...watchByMonth.map(m => m.hours), 1);
  // Use a small minimum scale so low-usage months still show some height
  const minVisibleHeight = 3; // minimum % height for non-zero values
  const peakMonth = [...watchByMonth].sort((a, b) => b.hours - a.hours)[0];
  // Watched on the row, not each bar: a bar shrinking to its base would slide back into view
  const bars = useScrollReveal(VIEWPORT);

  // Map month names to numbers
  const monthNameToNumber: Record<string, number> = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };

  return (
    <StatCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue/20">
          <TrendingUp className="w-5 h-5 text-blue" />
        </div>
        <div>
          <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">Monthly Activity</h3>
          {peakMonth && peakMonth.hours > 0 && (
            <p className="text-sm text-muted-foreground">
              Peak: <span className="text-primary font-semibold">{peakMonth.month}</span> with {Math.round(peakMonth.hours).toLocaleString()}h
            </p>
          )}
        </div>
      </div>

      <div ref={bars.ref} className="flex items-end justify-between gap-0.5 sm:gap-1 h-52 pt-8 w-full">
        {watchByMonth.map((month, index) => {
          // Calculate height with minimum visibility for non-zero values
          const rawHeight = maxHours > 0 ? (month.hours / maxHours) * 100 : 0;
          const height = month.hours > 0 ? Math.max(rawHeight, minVisibleHeight) : 6;
          const isPeak = peakMonth && peakMonth.hours > 0 && month.month === peakMonth.month;
          const hoursLabel = shortHours(month.hours);
          const monthNumber = monthNameToNumber[month.month] || (index + 1);

          return (
            <div key={month.month} className="group flex-1 min-w-0 flex flex-col items-center h-full">
              <span
                className={`text-[8px] sm:text-[9px] mb-1 font-medium truncate w-full text-center transition-colors ${
                  isPeak ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {hoursLabel}
              </span>

              <div className="relative w-full flex-1 flex items-end px-0.5">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: bars.shown ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 140, damping: 16, delay: index * 0.045 }}
                  style={{ height: `${height}%` }}
                  className={`relative w-full origin-bottom rounded-t-md transition-[filter] duration-300 group-hover:brightness-125 ${
                    isPeak
                      ? "bg-gradient-to-t from-pink via-orange to-yellow shadow-[0_0_24px_hsl(var(--orange)/0.55)]"
                      : "bg-gradient-to-t from-cyan/50 to-cyan"
                  }`}
                  title={`${month.month}: ${Math.round(month.hours).toLocaleString()}h`}
                >
                  {/* A marker pops onto the peak month once the bars are up */}
                  {isPeak && (
                    <motion.span
                      aria-hidden
                      initial={{ scale: 0, opacity: 0 }}
                      animate={bars.shown ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                      transition={{ ...SPRING_POP, delay: 0.9 }}
                      className="absolute -top-1 left-1/2 -ml-1 h-2 w-2 rounded-full bg-white shadow-[0_0_10px_3px_hsl(var(--yellow)/0.9)]"
                    />
                  )}
                </motion.div>
              </div>

              <span
                className={`text-[10px] sm:text-xs mt-2 transition-colors ${
                  isPeak ? "text-foreground font-semibold" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {monthNumber}
              </span>
            </div>
          );
        })}
      </div>
    </StatCard>
  );
};
