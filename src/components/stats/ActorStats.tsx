import { motion } from "framer-motion";
import { User, Clapperboard, Film } from "lucide-react";
import { StatCard } from "./StatCard";

interface ActorStatsProps {
  actors: { name: string; count: number; titleCount: number; watchTime: number }[];
  directors: { name: string; count: number; titleCount: number; watchTime: number }[];
}

export const ActorStats = ({ actors, directors }: ActorStatsProps) => {
  if (actors.length === 0 && directors.length === 0) return null;

  const maxActorCount = actors[0]?.count || 1;
  const maxDirectorCount = directors[0]?.count || 1;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          whileInView={{ rotate: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink/20 mb-4"
        >
          <User className="w-7 h-7 text-pink" />
        </motion.div>
        <h2 className="text-3xl font-bold gradient-text">Your Stars</h2>
        <p className="text-muted-foreground mt-2">The actors and directors you watched most</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {actors.length > 0 && (
          <StatCard>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-pink" />
              <h3 className="font-semibold text-foreground">Top Actors</h3>
            </div>
            <div className="space-y-3">
              {actors.map((actor, index) => (
                <motion.div
                  key={actor.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground truncate">{actor.name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {actor.titleCount} {actor.titleCount === 1 ? "title" : "titles"} across {actor.count} {actor.count === 1 ? "user" : "users"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(actor.count / maxActorCount) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
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
              <h3 className="font-semibold text-foreground">Top Directors</h3>
            </div>
            <div className="space-y-3">
              {directors.map((director, index) => (
                <motion.div
                  key={director.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground truncate">{director.name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {director.titleCount} {director.titleCount === 1 ? "title" : "titles"} across {director.count} {director.count === 1 ? "user" : "users"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(director.count / maxDirectorCount) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
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
