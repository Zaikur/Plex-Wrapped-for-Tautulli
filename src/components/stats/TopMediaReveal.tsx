import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Film, Tv, Clock, Users, Play } from "lucide-react";
import { formatDuration } from "@/lib/tautulli";
import { playSound } from "@/lib/sounds";

interface TopMediaRevealProps {
  type: "movie" | "show";
  title: string;
  subtitle?: string;
  watchTime: number;
  playCount?: number;
  userCount?: number;
  thumb?: string;
  imageUrl?: string;
  skipAnimations?: boolean;
}

export const TopMediaReveal = ({
  type,
  title,
  subtitle,
  watchTime,
  playCount,
  userCount,
  imageUrl,
  skipAnimations = false,
}: TopMediaRevealProps) => {
  const [isRevealed, setIsRevealed] = useState(skipAnimations);
  const ref = useRef<HTMLDivElement>(null);

  const Icon = type === "movie" ? Film : Tv;
  const accentColor = type === "movie" ? "orange" : "cyan";
  const gradientFrom = type === "movie" ? "from-orange/30" : "from-cyan/30";
  const gradientTo = type === "movie" ? "to-pink/30" : "to-purple/30";

  return (
    <div ref={ref} className="relative">
      <AnimatePresence mode="wait">
        {!isRevealed ? (
          <motion.div
            key="wrapped"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, rotateY: 90 }}
            transition={{ duration: 0.5 }}
            className="stat-card cursor-pointer group"
            onClick={() => {
              playSound("unwrap", 0.4);
              setIsRevealed(true);
            }}
          >
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <motion.div
                animate={{ 
                  rotate: [0, -5, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
                className={`relative w-32 h-40 mb-6`}
              >
                {/* Gift box */}
                <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} border-2 border-dashed border-${accentColor}/50`}>
                  {/* Ribbon vertical */}
                  <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-full bg-${accentColor}/40`} />
                  {/* Ribbon horizontal */}
                  <div className={`absolute top-1/2 -translate-y-1/2 w-full h-4 bg-${accentColor}/40`} />
                  {/* Bow */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Gift className={`w-10 h-10 text-${accentColor}`} />
                  </div>
                </div>
                
                {/* Sparkles */}
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -top-2 -right-2 text-2xl"
                >
                  ✨
                </motion.div>
                <motion.div
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className="absolute -bottom-1 -left-1 text-lg"
                >
                  ✨
                </motion.div>
              </motion.div>
              
              <p className="text-lg font-semibold text-foreground mb-2">
                Your #{1} {type === "movie" ? "Movie" : "TV Show"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Tap to unwrap your top pick!
              </p>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Play className="w-6 h-6 text-primary" />
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, rotateY: -90, scale: 0.8 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            transition={{ 
              duration: 0.6,
              type: "spring",
              stiffness: 100
            }}
            className="stat-card overflow-hidden"
          >
            {/* Background glow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-30`}
            />
            
            <div className="relative p-6">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 mb-6"
              >
                <div className={`p-2 rounded-lg bg-${accentColor}/20`}>
                  <Icon className={`w-5 h-5 text-${accentColor}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Your Top {type === "movie" ? "Movie" : "TV Show"}
                </span>
              </motion.div>

              <div className="flex gap-6">
                {/* Poster placeholder */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 150 }}
                  className={`relative w-28 h-40 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex-shrink-0 overflow-hidden shadow-2xl`}
                >
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className={`w-12 h-12 text-${accentColor}`} />
                    </div>
                  )}
                  {/* Shine effect */}
                  <motion.div
                    initial={{ x: "-100%", opacity: 0 }}
                    animate={{ x: "200%", opacity: [0, 0.5, 0] }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />
                </motion.div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <motion.h3
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-2xl md:text-3xl font-bold text-foreground mb-1 line-clamp-2"
                  >
                    {title}
                  </motion.h3>
                  
                  {subtitle && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-muted-foreground mb-4"
                    >
                      {subtitle}
                    </motion.p>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="flex flex-wrap items-center gap-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-bold text-lg">{formatDuration(watchTime)}</span>
                        <span className="ml-1">watched</span>
                      </span>
                    </div>
                    
                    {playCount && playCount > 1 && (
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" />
                        <span className="text-foreground font-semibold">{playCount}x</span>
                        <span className="text-muted-foreground">plays</span>
                      </div>
                    )}

                    {userCount && userCount >= 1 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="text-foreground font-semibold">{userCount}</span>
                        <span className="text-muted-foreground">{userCount === 1 ? 'viewer' : 'viewers'}</span>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Celebration particles */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute top-4 right-4 text-2xl"
              >
                🎉
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};