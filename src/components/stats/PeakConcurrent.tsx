import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { StatCard } from "./StatCard";

interface PeakConcurrentProps {
  peakConcurrentStreams: { count: number; date: string; time: string } | null;
}

export const PeakConcurrent = ({ peakConcurrentStreams }: PeakConcurrentProps) => {
  if (!peakConcurrentStreams || peakConcurrentStreams.count < 2) return null;

  return (
    <StatCard delay={0.2}>
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
          <Users className="w-4 h-4 text-cyan" />
          <span>Peak Concurrent Streams</span>
        </div>
        <motion.p
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="text-5xl font-extrabold gradient-text"
        >
          {peakConcurrentStreams.count}
        </motion.p>
        <p className="text-sm text-muted-foreground mt-2">
          streams at once
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {peakConcurrentStreams.date} at {peakConcurrentStreams.time}
        </p>
      </div>
    </StatCard>
  );
};
