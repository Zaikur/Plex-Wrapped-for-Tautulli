import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";

interface YearlyTrendsProps {
  watchByYear: { year: number; hours: number }[];
}

export const YearlyTrends = ({ watchByYear }: YearlyTrendsProps) => {
  const maxHours = Math.max(...watchByYear.map(y => y.hours), 1);
  const minVisibleHeight = 3;
  const peakYear = [...watchByYear].sort((a, b) => b.hours - a.hours)[0];

  return (
    <StatCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue/20">
          <TrendingUp className="w-5 h-5 text-blue" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Yearly Activity</h3>
          {peakYear && peakYear.hours > 0 && (
            <p className="text-sm text-muted-foreground">
              Peak: <span className="text-primary font-semibold">{peakYear.year}</span> with {Math.round(peakYear.hours)}h
            </p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 h-48 pt-6">
        {watchByYear.map((yearData, index) => {
          const rawHeight = maxHours > 0 ? (yearData.hours / maxHours) * 100 : 0;
          const height = yearData.hours > 0 ? Math.max(rawHeight, minVisibleHeight) : 6;
          const isPeak = peakYear && yearData.year === peakYear.year;
          const hoursLabel = `${Math.round(yearData.hours)}h`;

          return (
            <div key={yearData.year} className="flex-1 flex flex-col items-center h-full min-w-[40px]">
              <span className="text-[9px] text-muted-foreground mb-1 font-medium">
                {hoursLabel}
              </span>

              <div className="w-full flex-1 flex items-end">
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
                  title={`${yearData.year}: ${hoursLabel}`}
                />
              </div>

              <span className="text-[11px] text-muted-foreground mt-2 font-medium">
                {yearData.year}
              </span>
            </div>
          );
        })}
      </div>
    </StatCard>
  );
};
