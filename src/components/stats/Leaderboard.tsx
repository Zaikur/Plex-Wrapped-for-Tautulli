import { motion } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import { StatCard } from "./StatCard";
import { SectionHeader } from "./SectionHeader";
import { formatDuration, formatHours } from "@/lib/tautulli";
import { EASE_OUT_EXPO, SPRING_POP, VIEWPORT } from "@/lib/motion";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import type { LeaderboardEntry } from "@/types/api";

import { ScrollingText } from "@/components/motion/ScrollingText";
interface LeaderboardProps {
  userStats: LeaderboardEntry[];
}

// Podium places by rank (0 = first): column height, colours and when it rises (3rd, then 2nd, then 1st)
const PODIUM = [
  { height: "h-32 md:h-40", pillar: "from-yellow/35 to-yellow/5 ring-yellow/50", avatar: "from-yellow to-orange", numeral: "gold-text", delay: 0.6 },
  { height: "h-24 md:h-28", pillar: "from-slate-300/25 to-slate-300/5 ring-slate-300/40", avatar: "from-slate-200 to-slate-500", numeral: "text-slate-200/80", delay: 0.35 },
  { height: "h-16 md:h-20", pillar: "from-orange/30 to-orange/5 ring-orange/40", avatar: "from-orange to-amber-800", numeral: "text-orange/80", delay: 0.1 },
];

// A place's avatar and name, before and after they pop up onto the pillar
const AVATAR_HIDDEN = { opacity: 0, y: 20, scale: 0.6 };
const AVATAR_SHOWN = { opacity: 1, y: 0, scale: 1 };

const displayName = (user: LeaderboardEntry) => user.friendlyName || user.username;

// Up to two letters from the name ("Jane Doe" → "JD")
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("") || "?";

const PodiumPlace = ({ user, rank }: { user: LeaderboardEntry; rank: number }) => {
  const place = PODIUM[rank];
  const name = displayName(user);
  // Watched on the place as a whole, which stays put: a pillar shrinking to its base would slide back into view
  const { ref, shown } = useScrollReveal(VIEWPORT);

  return (
    <div ref={ref} className="flex min-w-0 flex-col items-center">
      <motion.div
        initial={AVATAR_HIDDEN}
        animate={shown ? AVATAR_SHOWN : AVATAR_HIDDEN}
        transition={{ ...SPRING_POP, delay: place.delay + 0.35 }}
        className="relative flex flex-col items-center mb-3 min-w-0 w-full"
      >
        {rank === 0 && (
          <motion.div
            aria-hidden
            animate={{ y: [0, -5, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="mb-1"
          >
            <Crown className="w-7 h-7 text-yellow fill-yellow/40 drop-shadow-[0_0_10px_hsl(var(--yellow)/0.7)]" />
          </motion.div>
        )}
        <div className={`rounded-full bg-gradient-to-br ${place.avatar} p-[2px] shadow-lg`}>
          <div
            className={`flex items-center justify-center rounded-full bg-card font-display font-bold text-foreground ${
              rank === 0 ? "w-16 h-16 text-xl" : "w-12 h-12 text-base"
            }`}
          >
            {initials(name)}
          </div>
        </div>
        <ScrollingText text={name} className="mt-2 w-full text-center text-sm font-semibold text-foreground" />
        <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDuration(user.totalWatchTime)}</p>
      </motion.div>

      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: shown ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 15, delay: place.delay }}
        className={`w-full origin-bottom rounded-t-xl bg-gradient-to-b ring-1 ring-inset ${place.pillar} ${place.height} flex items-start justify-center pt-2`}
      >
        <span className={`font-display text-4xl md:text-5xl font-extrabold leading-none ${place.numeral}`}>{rank + 1}</span>
      </motion.div>
    </div>
  );
};

export const Leaderboard = ({ userStats }: LeaderboardProps) => {
  const sortedUsers = [...userStats].sort((a, b) => b.totalWatchTime - a.totalWatchTime);
  const maxTime = sortedUsers[0]?.totalWatchTime || 1;

  if (sortedUsers.length <= 1) return null;

  // Shown 2nd, 1st, 3rd, like a real podium
  const podium = sortedUsers.slice(0, 3).map((user, rank) => ({ user, rank }));
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : [podium[1], podium[0]];
  const rest = sortedUsers.slice(3, 10);

  return (
    <StatCard className="py-8">
      <SectionHeader icon={Trophy} title="Leaderboard" subtitle="Who watched the most?" badgeClassName="bg-yellow/20" iconClassName="text-yellow" />

      <div className={`grid items-end gap-2 md:gap-4 mx-auto ${podium.length === 3 ? "grid-cols-3 max-w-xl" : "grid-cols-2 max-w-sm"}`}>
        {podiumOrder.map(({ user, rank }) => (
          <PodiumPlace key={user.userId} user={user} rank={rank} />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="space-y-4 max-w-2xl mx-auto mt-8">
          {rest.map((user, offset) => {
            const index = offset + 3;
            return (
              <motion.div
                key={user.userId}
                initial={{ x: -20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={VIEWPORT}
                transition={{ delay: offset * 0.08, duration: 0.7, ease: EASE_OUT_EXPO }}
                className="flex items-center gap-4"
              >
                <span className="w-10 shrink-0 text-center font-display text-2xl font-extrabold text-ghost">{index + 1}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <ScrollingText text={displayName(user)} className="flex-1 font-semibold text-foreground" />
                    <span className="text-sm text-muted-foreground ml-2 whitespace-nowrap">
                      {formatDuration(user.totalWatchTime)}
                    </span>
                  </div>

                  <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: user.totalWatchTime / maxTime }}
                      viewport={VIEWPORT}
                      transition={{ delay: 0.2 + offset * 0.08, duration: 1, ease: EASE_OUT_EXPO }}
                      className="h-full w-full origin-left rounded-full bg-gradient-to-r from-cyan to-purple"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT}
        transition={{ delay: 0.5 }}
        className="mt-8 pt-6 border-t border-border text-center"
      >
        <p className="text-muted-foreground">
          Combined watch time: <span className="text-primary font-bold">{formatHours(sortedUsers.reduce((sum, u) => sum + u.totalWatchTime, 0))} hours</span>
        </p>
      </motion.div>
    </StatCard>
  );
};
