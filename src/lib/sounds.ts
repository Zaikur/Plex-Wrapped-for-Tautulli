// Sound effect utility for playing UI sounds
import { audioUrl } from "@/lib/audio";
import { getPublicConfig } from "@/lib/serverConfig";

// Each sound as configured by the admin (replaced or turned off), or null when off
const SOUNDS = {
  unwrap: () => {
    const config = getPublicConfig();
    if (config && !config.settings.unwrapSoundEnabled) return null;
    return audioUrl("unwrap", config?.customAudioVersions.unwrap ?? null);
  },
} satisfies Record<string, () => string | null>;

type SoundName = keyof typeof SOUNDS;

// Cache audio instances for reuse
const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {};

export const playSound = (name: SoundName, volume = 0.5) => {
  const url = SOUNDS[name]();
  if (!url) return;
  try {
    // Reuse cached audio, or create a new one (also when the admin changed the sound)
    const resolvedUrl = new URL(url, window.location.href).toString();
    let audio = audioCache[name];
    if (!audio || audio.src !== resolvedUrl) {
      audio = new Audio(resolvedUrl);
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

// The background music player, so other audio (the admin panel's song preview) can pause it
let backgroundMusic: HTMLAudioElement | null = null;

export const setBackgroundMusic = (audio: HTMLAudioElement | null) => {
  backgroundMusic = audio;
};

export const pauseBackgroundMusic = () => {
  backgroundMusic?.pause();
};
