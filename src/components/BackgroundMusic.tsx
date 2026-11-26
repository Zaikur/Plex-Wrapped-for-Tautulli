import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setBackgroundMusic } from "@/lib/sounds";

// The visitor's last choice with the speaker button ("true"/"false"). A mute is
// respected on later visits, even when the admin starts the music unmuted.
const MUSIC_KEY = "plex-wrapped-music-enabled";

// Browsers only allow sound after one of these
const GESTURE_EVENTS = ["click", "keydown", "touchend"] as const;

const readChoice = () => {
  try {
    return localStorage.getItem(MUSIC_KEY);
  } catch {
    return null;
  }
};

const saveChoice = (playing: boolean) => {
  try {
    localStorage.setItem(MUSIC_KEY, String(playing));
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
};

interface BackgroundMusicProps {
  /** The song to play, or null when the admin turned music off */
  src: string | null;
  /** Start on the visitor's first interaction instead of waiting for the speaker button */
  startUnmuted: boolean;
}

export const BackgroundMusic = ({ src, startUnmuted }: BackgroundMusicProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelAutostart = useRef<() => void>(() => {});

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.onplay = audio.onpause = audio.onerror = null;
    audioRef.current = null;
    setBackgroundMusic(null);
    setIsPlaying(false);
  }, []);

  // Created on first play, so visitors who never play music don't download it
  const ensureAudio = useCallback(() => {
    if (!src) return null;
    const resolvedUrl = new URL(src, window.location.href).toString();
    // Recreate if the song changed (or Fast Refresh kept an old Audio instance around)
    if (audioRef.current?.src !== resolvedUrl) {
      releaseAudio();
      const audio = new Audio(resolvedUrl);
      audio.loop = true;
      audio.volume = 0.3;
      // Follow the element, so pauses from elsewhere (the admin preview) show up here
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => {
        console.error("Background music could not be loaded:", resolvedUrl);
        setIsPlaying(false);
      };
      audioRef.current = audio;
      setBackgroundMusic(audio);
    }
    return audioRef.current;
  }, [src, releaseAudio]);

  // A new song (e.g. the admin uploaded one) keeps playing if music was on; turning music off stops it
  useEffect(() => {
    const current = audioRef.current;
    if (!current || (src && current.src === new URL(src, window.location.href).toString())) return;
    const wasPlaying = !current.paused;
    releaseAudio();
    if (wasPlaying) ensureAudio()?.play().catch(() => {});
  }, [src, ensureAudio, releaseAudio]);

  useEffect(() => releaseAudio, [releaseAudio]);

  // Start unmuted: try right away, otherwise on the first click, tap or key press
  useEffect(() => {
    if (!src || !startUnmuted || readChoice() === "false") return;
    const audio = ensureAudio();
    if (!audio || !audio.paused) return;

    let active = true;
    const onGesture = (event: Event) => {
      // The speaker button handles its own clicks
      if (buttonRef.current?.contains(event.target as Node)) return;
      ensureAudio()?.play().then(stop, () => {});
    };
    const stop = () => {
      active = false;
      for (const name of GESTURE_EVENTS) window.removeEventListener(name, onGesture, true);
    };
    audio.play().then(stop, () => {
      if (active) for (const name of GESTURE_EVENTS) window.addEventListener(name, onGesture, true);
    });
    cancelAutostart.current = stop;
    return stop;
  }, [src, startUnmuted, ensureAudio]);

  const toggleMusic = async () => {
    // An explicit choice replaces any pending autostart
    cancelAutostart.current();
    const audio = ensureAudio();
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      saveChoice(false);
    } else {
      try {
        await audio.play();
        saveChoice(true);
      } catch (err) {
        console.error("Audio playback failed:", err);
      }
    }
  };

  if (!src) return null;

  return (
    <Button
      ref={buttonRef}
      variant="outline"
      size="icon"
      onClick={toggleMusic}
      className="fixed bottom-4 right-4 z-50 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary/10"
      title={isPlaying ? "Mute music" : "Play music"}
      aria-label={isPlaying ? "Mute music" : "Play music"}
    >
      {isPlaying ? (
        <Volume2 className="h-5 w-5 text-primary" />
      ) : (
        <VolumeX className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
};
