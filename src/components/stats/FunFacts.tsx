import { motion } from "framer-motion";
import {
  Moon,
  CalendarDays,
  Flame,
  Sparkles,
  Sun,
  Clock,
  Sunrise,
  Zap,
  Heart,
  AlarmClock,
  Hourglass,
  Tv,
  Film,
  History,
  TrendingUp,
  Star,
  Compass,
  CircleCheck,
  Shuffle,
  Repeat,
  MonitorSmartphone,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { HoloCard } from "./HoloCard";
import { SectionHeader } from "./SectionHeader";
import { KineticText } from "@/components/motion/KineticText";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatDuration } from "@/lib/tautulli";
import {
  describePersonality,
  isGroupPersonality,
  personalityDef,
  personalityLabel,
  type PersonalityColor,
} from "@/lib/personality";
import type { PersonalityId, StreamingPersonality } from "@/types/tautulli";

import { VIEWPORT } from "@/lib/motion";
import { ScrollingText } from "@/components/motion/ScrollingText";
interface FunFactsProps {
  lateNightSessions: number;
  weekendPercentage: number;
  mostActiveDay: { day: string; hours: number } | null;
  uniqueTitles: number;
  avgDailyWatchTime: number;
  mostBingedDay: { date: string; duration: number } | null;
  earlyBirdSessions: number;
  isGroup: boolean;
  peakHour: number;
  longestBinge: { title: string; duration: number; date: string } | null;
  personality: StreamingPersonality | null | undefined;
}

const COLOR_CLASSES: Record<PersonalityColor, { bg: string; text: string }> = {
  purple: { bg: "bg-purple/20", text: "text-purple" },
  yellow: { bg: "bg-yellow/20", text: "text-yellow" },
  orange: { bg: "bg-orange/20", text: "text-orange" },
  cyan: { bg: "bg-cyan/20", text: "text-cyan" },
  pink: { bg: "bg-pink/20", text: "text-pink" },
  green: { bg: "bg-green/20", text: "text-green" },
};

const PERSONALITY_ICONS: Record<PersonalityId, LucideIcon> = {
  nightOwl: Moon,
  earlyBird: Sunrise,
  matineeFan: Sun,
  primeTimeViewer: Tv,
  weekendWarrior: CalendarDays,
  marathonRunner: Zap,
  bingeMaster: Flame,
  movieBuff: Film,
  retroLover: History,
  trendChaser: TrendingUp,
  superfan: Star,
  contentExplorer: Compass,
  comfortWatcher: Heart,
  completionist: CircleCheck,
  channelSurfer: Shuffle,
  creatureOfHabit: Repeat,
  platformHopper: MonitorSmartphone,
  balancedViewer: Scale,
};

export const FunFacts = ({
  lateNightSessions,
  weekendPercentage,
  mostActiveDay,
  uniqueTitles,
  avgDailyWatchTime,
  mostBingedDay,
  earlyBirdSessions,
  isGroup,
  peakHour,
  longestBinge,
  personality,
}: FunFactsProps) => {
  const formatPeakHour = (hour: number) => {
    if (hour === 0) return "Midnight";
    if (hour === 12) return "Noon";
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const tone = COLOR_CLASSES[personalityDef(personality).color];
  const PersonalityIcon = PERSONALITY_ICONS[personality?.id ?? "balancedViewer"] ?? Scale;
  const personalityIntro = isGroupPersonality(personality)
    ? "Your streaming personalities are"
    : "Your streaming personality is";

  return (
    <div className="space-y-6">
      <SectionHeader icon={Sparkles} title="Fun Facts" />

      {/* Personality Card */}
      <HoloCard tint="gradient-bg opacity-60">
        <div className="relative text-center py-8">
          {/* The icon, with two rings orbiting it */}
          <div className="relative inline-flex mb-6">
            <div aria-hidden className="absolute -inset-4 rounded-full border border-dashed border-white/20 animate-spin-slow" />
            <div aria-hidden className="absolute -inset-8 rounded-full border border-white/10 animate-spin-slow-reverse">
              <span className="absolute -top-1 left-1/2 -ml-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.7)]" />
            </div>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={VIEWPORT}
              transition={{ type: "spring", stiffness: 150 }}
              className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card ring-1 ring-white/10"
            >
              <div className={`absolute inset-0 rounded-2xl ${tone.bg}`} />
              <PersonalityIcon className={`relative w-10 h-10 ${tone.text}`} />
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mb-3"
          >
            {personalityIntro}
          </motion.p>
          <KineticText
            as="h3"
            text={personalityLabel(personality)}
            gradient="value"
            delay={0.3}
            className="font-display text-4xl md:text-6xl font-extrabold tracking-tighter leading-[1.05] mb-3 px-2"
          />
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground px-2"
          >
            {describePersonality(personality)}
          </motion.p>
        </div>
      </HoloCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lateNightSessions > 0 && (
          <StatCard delay={0.1} className="group">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple/20 animate-pulse-glow transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Moon className="w-6 h-6 text-purple" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Night Owl Sessions</p>
                <p className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                  <AnimatedNumber value={lateNightSessions} />
                </p>
                <p className="text-xs text-muted-foreground">Watched between midnight and 5am</p>
              </div>
            </div>
          </StatCard>
        )}

        {earlyBirdSessions > 0 && (
          <StatCard delay={0.15} className="group">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Sunrise className="w-6 h-6 text-yellow" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Early Bird Sessions</p>
                <p className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                  <AnimatedNumber value={earlyBirdSessions} />
                </p>
                <p className="text-xs text-muted-foreground">Watched between 5am and 8am</p>
              </div>
            </div>
          </StatCard>
        )}

        <StatCard delay={0.2} className="group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <CalendarDays className="w-6 h-6 text-orange" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Weekend Streaming</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                <AnimatedNumber value={weekendPercentage} suffix="%" />
              </p>
              <p className="text-xs text-muted-foreground">of sessions on weekends</p>
            </div>
          </div>
        </StatCard>

        <StatCard delay={0.25} className="group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <Clock className="w-6 h-6 text-cyan" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Daily Average</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                {formatDuration(avgDailyWatchTime)}
              </p>
              <p className="text-xs text-muted-foreground">per day when active</p>
            </div>
          </div>
        </StatCard>

        <StatCard delay={0.27} className="group">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-pink/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <AlarmClock className="w-6 h-6 text-pink" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Prime Time</p>
              <p className="font-display text-4xl font-extrabold tracking-tight text-foreground">{formatPeakHour(peakHour)}</p>
              <p className="text-xs text-muted-foreground">{isGroup ? "the server's" : "your"} most-watched hour</p>
            </div>
          </div>
        </StatCard>

        {mostBingedDay && (
          <StatCard delay={0.3} className="group">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Sun className="w-6 h-6 text-green" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm mb-1">Most Epic Day</p>
                <p className="font-display text-3xl font-extrabold tracking-tight text-foreground">{formatDuration(mostBingedDay.duration)}</p>
                <p className="text-xs text-muted-foreground">{mostBingedDay.date}</p>
              </div>
            </div>
          </StatCard>
        )}

        {longestBinge && (
          <StatCard delay={0.35} className="group">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-cyan/20 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Hourglass className="w-6 h-6 text-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-sm mb-1">Longest Session</p>
                <p className="font-display text-3xl font-extrabold tracking-tight text-foreground">{formatDuration(longestBinge.duration)}</p>
                <ScrollingText text={longestBinge.title} className="text-sm text-foreground" />
                <p className="text-xs text-muted-foreground">{longestBinge.date}</p>
              </div>
            </div>
          </StatCard>
        )}

        {mostActiveDay && (
          <StatCard delay={0.4} className="group">
            <div className="text-center py-2">
              <p className="text-muted-foreground text-sm mb-2">Your Power Day</p>
              <p className="font-display text-5xl font-extrabold tracking-tight gradient-value">{mostActiveDay.day}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {mostActiveDay.hours}h total watch time
              </p>
            </div>
          </StatCard>
        )}

        <StatCard delay={0.5} className="group">
          <div className="text-center py-2">
            <p className="text-muted-foreground text-sm mb-2">Unique Titles</p>
            <p className="font-display text-5xl font-extrabold tracking-tight gradient-value">
              <AnimatedNumber value={uniqueTitles} grouping />
            </p>
            <p className="text-sm text-muted-foreground mt-2">You're quite the explorer!</p>
          </div>
        </StatCard>
      </div>
    </div>
  );
};
