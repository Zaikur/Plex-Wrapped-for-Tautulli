// Sound effect utility for playing UI sounds
const SOUNDS = {
  unwrap: "/audio/unwrap.mp3",
} as const;

type SoundName = keyof typeof SOUNDS;

// Cache audio instances for reuse
const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {};

export const playSound = (name: SoundName, volume = 0.5) => {
  try {
    // Reuse cached audio or create new
    let audio = audioCache[name];
    if (!audio) {
      audio = new Audio(SOUNDS[name]);
      audioCache[name] = audio;
    }

    // Reset and play
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {
      // Autoplay blocked - ignore silently
    });
  } catch {
    // Audio not supported - ignore
  }
};
