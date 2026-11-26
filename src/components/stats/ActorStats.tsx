import { motion } from "framer-motion";
import { User, Clapperboard, Film } from "lucide-react";
import { StatCard } from "./StatCard";
import { EASE_OUT_EXPO, VIEWPORT } from "@/lib/motion";
import { SectionHeader } from "./SectionHeader";

import { ScrollingText } from "@/components/motion/ScrollingText";
interface ActorStatsProps {
  actors: { name: string; count: number; titleCount: number; score: number; watchTime: number }[];
  directors: { name: string; count: number; titleCount: number; score: number; watchTime: number }[];
  /** The everyone report, where the number of users is shown too */
  isGroup?: boolean;
}

export const ActorStats = ({ actors, directors, isGroup = false }: ActorStatsProps) => {
  if (actors.length === 0 && directors.length === 0) return null;

  // Bars show the ranking score (titles x users; just titles for a single user), so the first is the longest
  const maxActorScore = actors[0]?.score || 1;
  const maxDirectorScore = directors[0]?.score || 1;

  const describe = (person: { count: number; titleCount: number }) => {
    const titles = `${person.titleCount} ${person.titleCount === 1 ? "title" : "titles"}`;
    return isGroup ? `${titles} across ${person.count} ${person.count === 1 ? "user" : "users"}` : titles;
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={User} title="Your Stars" subtitle="The actors and directors you watched most" badgeClassName="bg-pink/20" iconClassName="text-pink" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {actors.length > 0 && (
          <StatCard>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-pink" />
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">Top Actors</h3>
            </div>
            <div className="space-y-3">
              {actors.map((actor, index) => (
                <motion.div
                  key={actor.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ delay: index * 0.1, duration: 0.7, ease: EASE_OUT_EXPO }}
                  className="space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <ScrollingText text={actor.name} className="flex-1 font-medium text-foreground" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {describe(actor)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(actor.score / maxActorScore) * 100}%` }}
                      viewport={VIEWPORT}
                      transition={{ delay: index * 0.1 + 0.2, duration: 1, ease: EASE_OUT_EXPO }}
                      className="h-full bg-gradient-to-r from-pink to-orange rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </StatCard>
        )}

        {directors.length > 0 && (
          <StatCard>
            <div className="flex items-center gap-2 mb-4">
              <Clapperboard className="w-5 h-5 text-cyan" />
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">Top Directors</h3>
            </div>
            <div className="space-y-3">
              {directors.map((director, index) => (
                <motion.div
                  key={director.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ delay: index * 0.1, duration: 0.7, ease: EASE_OUT_EXPO }}
                  className="space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <ScrollingText text={director.name} className="flex-1 font-medium text-foreground" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {describe(director)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(director.score / maxDirectorScore) * 100}%` }}
                      viewport={VIEWPORT}
                      transition={{ delay: index * 0.1 + 0.2, duration: 1, ease: EASE_OUT_EXPO }}
                      className="h-full bg-gradient-to-r from-cyan to-purple rounded-full"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </StatCard>
        )}
      </div>
    </div>
  );
};
