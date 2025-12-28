import { motion } from "framer-motion";
import { Tv, Smartphone, Monitor, Tablet, Gamepad2, HelpCircle } from "lucide-react";
import { StatCard } from "./StatCard";

interface PlatformStatsProps {
  platforms: { name: string; count: number; percentage: number }[];
}

const getPlatformIcon = (platform: string) => {
  const lower = platform.toLowerCase();
  if (lower.includes('chrome') || lower.includes('firefox') || lower.includes('safari') || lower.includes('web')) {
    return <Monitor className="w-5 h-5" />;
  }
  if (lower.includes('android') || lower.includes('ios') || lower.includes('iphone') || lower.includes('mobile')) {
    return <Smartphone className="w-5 h-5" />;
  }
  if (lower.includes('tv') || lower.includes('roku') || lower.includes('fire') || lower.includes('apple tv') || lower.includes('chromecast')) {
    return <Tv className="w-5 h-5" />;
  }
  if (lower.includes('ipad') || lower.includes('tablet')) {
    return <Tablet className="w-5 h-5" />;
  }
  if (lower.includes('playstation') || lower.includes('xbox') || lower.includes('nintendo')) {
    return <Gamepad2 className="w-5 h-5" />;
  }
  return <HelpCircle className="w-5 h-5" />;
};

const getGradient = (index: number) => {
  const gradients = [
    "from-cyan to-blue",
    "from-pink to-purple",
    "from-orange to-yellow",
    "from-green to-cyan",
    "from-purple to-pink",
  ];
  return gradients[index % gradients.length];
};

export const PlatformStats = ({ platforms }: PlatformStatsProps) => {
  if (!platforms.length) return null;

  const topPlatform = platforms[0];

  return (
    <StatCard>
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-foreground mb-2">Your Favorite Devices</h3>
        <p className="text-muted-foreground text-sm">Where you watched</p>
      </div>

      {topPlatform && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 p-6 rounded-2xl gradient-bg"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            {getPlatformIcon(topPlatform.name)}
          </div>
          <p className="text-2xl font-bold text-foreground">{topPlatform.name}</p>
          <p className="text-4xl font-extrabold gradient-text mt-2">{topPlatform.percentage}%</p>
          <p className="text-sm text-muted-foreground">of your streams</p>
        </motion.div>
      )}

      <div className="space-y-3">
        {platforms.map((platform, index) => (
          <motion.div
            key={platform.name}
            initial={{ x: -20, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4"
          >
            <div className="w-10 flex items-center justify-center text-muted-foreground">
              {getPlatformIcon(platform.name)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground text-sm">{platform.name}</span>
                <span className="text-sm text-muted-foreground">{platform.percentage}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${platform.percentage}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
                  className={`h-full rounded-full bg-gradient-to-r ${getGradient(index)}`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </StatCard>
  );
};
