import { motion } from "framer-motion";
import { Users, Film, Tv } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatDuration } from "@/lib/tautulli";
interface PopularWithGroupProps {
  topMoviesByUsers: {
    title: string;
    userCount: number;
    totalTime: number;
  }[];
  topShowsByUsers: {
    title: string;
    userCount: number;
    totalTime: number;
  }[];
}
export const PopularWithGroup = ({
  topMoviesByUsers,
  topShowsByUsers
}: PopularWithGroupProps) => {
  const hasMovies = topMoviesByUsers.length > 0;
  const hasShows = topShowsByUsers.length > 0;
  if (!hasMovies && !hasShows) return null;
  return <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div initial={{
        rotate: -10,
        scale: 0
      }} whileInView={{
        rotate: 0,
        scale: 1
      }} viewport={{
        once: true
      }} transition={{
        type: "spring",
        stiffness: 200
      }} className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-bg mb-4">
          <Users className="w-7 h-7 text-primary" />
        </motion.div>
        <h2 className="text-3xl font-bold gradient-text">Crowd Favorites</h2>
        <p className="text-muted-foreground mt-2">What everyone's been watching</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasMovies && <StatCard>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-orange/20">
                <Film className="w-5 h-5 text-orange" />
              </div>
              <span className="text-muted-foreground text-sm font-medium">Movies Everyone Loves</span>
            </div>
            <div className="space-y-3">
              {topMoviesByUsers.slice(0, 5).map((movie, index) => <motion.div key={movie.title} initial={{
            opacity: 0,
            x: -20
          }} whileInView={{
            opacity: 1,
            x: 0
          }} viewport={{
            once: true
          }} transition={{
            delay: index * 0.1
          }} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <span className="text-2xl font-bold text-primary/50 w-8">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {movie.userCount} users · {formatDuration(movie.totalTime)}
                    </p>
                  </div>
                </motion.div>)}
            </div>
          </StatCard>}

        {hasShows && <StatCard>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-cyan/20">
                <Tv className="w-5 h-5 text-cyan" />
              </div>
              <span className="text-muted-foreground text-sm font-medium">Shows Everyone Loves</span>
            </div>
            <div className="space-y-3">
              {topShowsByUsers.slice(0, 5).map((show, index) => <motion.div key={show.title} initial={{
            opacity: 0,
            x: -20
          }} whileInView={{
            opacity: 1,
            x: 0
          }} viewport={{
            once: true
          }} transition={{
            delay: index * 0.1
          }} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <span className="text-2xl font-bold text-primary/50 w-8">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{show.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {show.userCount} users · {formatDuration(show.totalTime)}
                    </p>
                  </div>
                </motion.div>)}
            </div>
          </StatCard>}
      </div>
    </div>;
};