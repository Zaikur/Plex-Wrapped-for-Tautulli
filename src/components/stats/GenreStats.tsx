import { motion } from "framer-motion";
import { Tag } from "lucide-react";
import { StatCard } from "./StatCard";
import { formatDuration } from "@/lib/tautulli";

interface GenreStatsProps {
  genres: { genre: string; count: number; watchTime: number }[];
}

export const GenreStats = ({ genres }: GenreStatsProps) => {
  if (genres.length === 0) return null;

  const maxTime = Math.max(...genres.map(g => g.watchTime));

  // Fun genre emojis
  const genreEmojis: Record<string, string> = {
    'Action': '💥',
    'Adventure': '🗺️',
    'Animation': '🎬',
    'Comedy': '😂',
    'Crime': '🔍',
    'Documentary': '📹',
    'Drama': '🎭',
    'Family': '👨‍👩‍👧‍👦',
    'Fantasy': '🧙',
    'Horror': '👻',
    'Mystery': '🕵️',
    'Romance': '💕',
    'Sci-Fi': '🚀',
    'Science Fiction': '🚀',
    'Thriller': '😱',
    'War': '⚔️',
    'Western': '🤠',
    'Music': '🎵',
    'History': '📜',
    'Sport': '⚽',
    'Biography': '📖',
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          whileInView={{ rotate: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple/20 mb-4"
        >
          <Tag className="w-7 h-7 text-purple" />
        </motion.div>
        <h2 className="text-3xl font-bold gradient-text">Your Genres</h2>
        <p className="text-muted-foreground mt-2">What kind of content you love most</p>
      </div>

      <StatCard>
        <div className="space-y-4">
          {genres.map((genre, index) => (
            <motion.div
              key={genre.genre}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <span>{genreEmojis[genre.genre] || '🎬'}</span>
                  {genre.genre}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDuration(genre.watchTime)} across {genre.count} titles
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(genre.watchTime / maxTime) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-purple to-pink rounded-full"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </StatCard>
    </div>
  );
};