import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { StatCard } from "./StatCard";

interface WatchHeatmapProps {
  watchByDay: { day: string; hours: number }[];
  watchByHour: { hour: number; minutes: number }[];
}

// Reorder days to start with Monday
const reorderDaysFromMonday = (watchByDay: { day: string; hours: number }[]) => {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return dayOrder.map(dayName => 
    watchByDay.find(d => d.day === dayName) || { day: dayName, hours: 0 }
  );
};

export const WatchHeatmap = ({ watchByDay, watchByHour }: WatchHeatmapProps) => {
  const maxDayHours = Math.max(...watchByDay.map(d => d.hours), 1);
  const maxHourMinutes = Math.max(...watchByHour.map(h => h.minutes), 1);
  
  // Reorder days to start with Monday
  const orderedWatchByDay = reorderDaysFromMonday(watchByDay);

  const getIntensityClass = (value: number, max: number) => {
    const ratio = value / max;
    if (ratio === 0) return "bg-muted/30";
    if (ratio < 0.25) return "bg-cyan/20";
    if (ratio < 0.5) return "bg-cyan/40";
    if (ratio < 0.75) return "bg-cyan/60";
    return "bg-cyan/80";
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return "12am";
    if (hour === 12) return "12pm";
    return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <StatCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-orange/20">
            <Calendar className="w-5 h-5 text-orange" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Watch by Day</h3>
        </div>

        <div className="space-y-3">
          {orderedWatchByDay.map((day, index) => (
            <motion.div
              key={day.day}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="w-12 text-sm text-muted-foreground">{day.day.slice(0, 3)}</span>
              <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(day.hours / maxDayHours) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-orange to-pink rounded-full"
                />
              </div>
              <span className="w-12 text-sm text-foreground text-right">{day.hours}h</span>
            </motion.div>
          ))}
        </div>
      </StatCard>

      <StatCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan/20">
            <Clock className="w-5 h-5 text-cyan" />
          </div>
          <h3 className="text-xl font-bold text-foreground">When You Watch</h3>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {watchByHour.map((hourData, index) => (
            <motion.div
              key={hourData.hour}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.02 }}
              className={`aspect-square rounded-md flex items-center justify-center text-xs ${getIntensityClass(hourData.minutes, maxHourMinutes)}`}
              title={`${formatHour(hourData.hour)}: ${hourData.minutes} min`}
            >
              <span className="text-[10px] text-muted-foreground">{formatHour(hourData.hour).replace('am', 'a').replace('pm', 'p')}</span>
            </motion.div>
          ))}
        </div>
        
        <div className="flex justify-between mt-4 text-xs text-muted-foreground">
          <span>Less active</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded bg-muted/30" />
            <div className="w-3 h-3 rounded bg-cyan/20" />
            <div className="w-3 h-3 rounded bg-cyan/40" />
            <div className="w-3 h-3 rounded bg-cyan/60" />
            <div className="w-3 h-3 rounded bg-cyan/80" />
          </div>
          <span>More active</span>
        </div>
      </StatCard>
    </div>
  );
};