import { useState, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const MUSIC_KEY = "plex-wrapped-music-enabled";

// Local holiday background music (keeps playback reliable)
const CHRISTMAS_MUSIC_URL = "/audio/christmas.mp3";

export const ChristmasMusic = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleMusic = async () => {
    // Create audio on first interaction (avoids autoplay restrictions)
    const resolvedUrl = new URL(CHRISTMAS_MUSIC_URL, window.location.href).toString();

    // Recreate if Fast Refresh kept an old Audio instance around
    if (!audioRef.current || audioRef.current.src !== resolvedUrl) {
      audioRef.current?.pause();
      audioRef.current = new Audio(resolvedUrl);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      localStorage.setItem(MUSIC_KEY, "false");
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        localStorage.setItem(MUSIC_KEY, "true");
      } catch (err) {
        console.error("Audio playback failed:", err);
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleMusic}
      className="fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10"
      title={isPlaying ? "Mute music" : "Play music"}
    >
      {isPlaying ? (
        <Volume2 className="h-5 w-5 text-primary" />
      ) : (
        <VolumeX className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
};
