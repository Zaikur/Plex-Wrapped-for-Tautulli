import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Flag, Play, Zap, Rocket } from "lucide-react";
import { StatCard } from "./StatCard";
import { SectionHeader } from "./SectionHeader";
import { AnimatedNumber } from "./AnimatedNumber";
import { getImageUrl } from "@/lib/tautulli";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";

type JourneyWatch = { title: string; date: string; year: number; image?: string };

interface JourneyStatsProps {
  firstWatch: JourneyWatch | null;
  lastWatch: JourneyWatch | null;
  longestStreak: number;
  totalSessions: number;
  isAllTime?: boolean;
  isGroup?: boolean;
}

// A landscape image across the top of the card (episode still or movie background art).
// Left out when Plex has no such image for the title.
const Banner = ({ image, title }: { image: string; title: string }) => {
  // Remembered per image, so another report's image isn't hidden by an earlier failure
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (failedImage === image) return null;
  return (
    <div className="relative -mx-6 -mt-6 md:-mx-8 md:-mt-8 mb-5 aspect-video overflow-hidden bg-muted/30">
      {/* A slow Ken Burns push-in as the card arrives */}
      <motion.img
        src={getImageUrl(image, "landscape")}
        alt={title}
        loading="lazy"
        onError={() => setFailedImage(image)}
        initial={{ scale: 1.18 }}
        whileInView={{ scale: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 2.4, ease: EASE_OUT_EXPO }}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
    </div>
  );
};

const WatchCard = ({ watch, label, icon, delay }: { watch: JourneyWatch; label: string; icon: React.ReactNode; delay: number }) => (
  <StatCard delay={delay} className="overflow-hidden">
    {watch.image && <Banner image={watch.image} title={watch.title} />}
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <p className="font-display text-2xl font-bold tracking-tight text-foreground">{watch.title}</p>
      <p className="text-sm text-muted-foreground">{watch.date}</p>
    </div>
  </StatCard>
);

export const JourneyStats = ({
  firstWatch,
  lastWatch,
  longestStreak,
  totalSessions,
  isAllTime = false,
  isGroup = false,
}: JourneyStatsProps) => {
  // All Time: the first watch is the first session ever recorded
  const yearsAgo = firstWatch ? new Date().getFullYear() - firstWatch.year : 0;
  const firstWatchWithAge = firstWatch && isAllTime
    ? { ...firstWatch, date: `${firstWatch.date} · ${yearsAgo <= 0 ? "this year" : yearsAgo === 1 ? "1 year ago" : `${yearsAgo} years ago`}` }
    : firstWatch;
  const firstLabel = isAllTime
    ? isGroup ? "The server's first recorded session" : "Where it all began"
    : isGroup ? "The year started with" : "Your year started with";

  return (
    <div className="space-y-6">
      <SectionHeader icon={Rocket} title="Your Journey" badgeClassName="bg-gradient-to-br from-cyan/30 to-blue/30" iconClassName="text-cyan" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {firstWatchWithAge && (
          <WatchCard
            watch={firstWatchWithAge}
            label={firstLabel}
            icon={isAllTime ? <Flag className="w-4 h-4 text-green" /> : <Calendar className="w-4 h-4 text-green" />}
            delay={0.1}
          />
        )}

        {lastWatch && (
          <WatchCard watch={lastWatch} label="Most recently watched" icon={<Calendar className="w-4 h-4 text-pink" />} delay={0.2} />
        )}

        <StatCard delay={0.3}>
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
              <Zap className="w-4 h-4 text-yellow" />
              <span>Longest Streak</span>
            </div>
            <p className="font-display text-6xl font-extrabold tracking-tighter gradient-value">
              <AnimatedNumber value={longestStreak} duration={1.6} grouping />
            </p>
            <p className="text-sm text-muted-foreground mt-2">consecutive days</p>
          </div>
        </StatCard>

        <StatCard delay={0.4}>
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-3">
              <Play className="w-4 h-4 text-orange" />
              <span>Total Sessions</span>
            </div>
            <p className="font-display text-6xl font-extrabold tracking-tighter gradient-value">
              <AnimatedNumber value={totalSessions} duration={1.8} grouping />
            </p>
            <p className="text-sm text-muted-foreground mt-2">play sessions</p>
          </div>
        </StatCard>
      </div>
    </div>
  );
};
