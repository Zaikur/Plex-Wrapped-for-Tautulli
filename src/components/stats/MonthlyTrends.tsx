import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";

interface MonthlyTrendsProps {
  watchByMonth: { month: string; hours: number }[];
}

export const MonthlyTrends = ({ watchByMonth }: MonthlyTrendsProps) => {
  const maxHours = Math.max(...watchByMonth.map(m => m.hours), 1);
  // Use a small minimum scale so low-usage months still show some height
  const minVisibleHeight = 3; // minimum % height for non-zero values
  const peakMonth = [...watchByMonth].sort((a, b) => b.hours - a.hours)[0];

  return (
    <StatCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue/20">
          <TrendingUp className="w-5 h-5 text-blue" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Monthly Activity</h3>
          {peakMonth && peakMonth.hours > 0 && (
            <p className="text-sm text-muted-foreground">
              Peak: <span className="text-primary font-semibold">{peakMonth.month}</span> with {peakMonth.hours}h
            </p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-0.5 sm:gap-1 h-48 pt-6 overflow-hidden w-full">
        {watchByMonth.map((month, index) => {
          // Calculate height with minimum visibility for non-zero values
          const rawHeight = maxHours > 0 ? (month.hours / maxHours) * 100 : 0;
          const height = month.hours > 0 ? Math.max(rawHeight, minVisibleHeight) : 6;
          const isPeak = peakMonth && month.month === peakMonth.month;
          const hoursLabel = `${month.hours.toFixed(2)}h`;

          return (
            <div key={month.month} className="flex-1 min-w-0 flex flex-col items-center h-full">
              <span className="text-[8px] sm:text-[9px] text-muted-foreground mb-1 font-medium truncate w-full text-center">
                {hoursLabel}
              </span>

              <div className="w-full flex-1 flex items-end px-0.5">
                <motion.div
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.5 }}
                  style={{ height: `${height}%` }}
                  className={`w-full origin-bottom rounded-t-md transition-colors ${
                    isPeak
                      ? "bg-gradient-to-t from-pink to-orange"
                      : "bg-gradient-to-t from-cyan/60 to-cyan"
                  }`}
                  title={`${month.month}: ${hoursLabel}`}
                />
              </div>

              <span className="text-[8px] sm:text-[10px] text-muted-foreground mt-2 rotate-45 origin-left whitespace-nowrap">
                {month.month.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </StatCard>
  );
};