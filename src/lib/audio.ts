// Replaceable sounds (background music, the unwrap sound effect), shared by the server and the web app.
// The defaults ship in public/audio; an uploaded file replaces one while it is selected.

import type { AdminSettings, AudioSource } from "./adminStorage";

export type AudioSlot = "music" | "unwrap";

/** Settings that pick a slot's source */
type SourceSetting = { [K in keyof AdminSettings]: AdminSettings[K] extends AudioSource ? K : never }[keyof AdminSettings];

export interface AudioSlotInfo {
  /** "song" or "sound", for labels and messages */
  noun: string;
  defaultUrl: string;
  defaultName: string;
  sourceSetting: SourceSetting;
}

export const AUDIO_SLOTS: Record<AudioSlot, AudioSlotInfo> = {
  music: { noun: "song", defaultUrl: "/audio/christmas.mp3", defaultName: "christmas.mp3", sourceSetting: "musicSource" },
  unwrap: { noun: "sound", defaultUrl: "/audio/unwrap.mp3", defaultName: "unwrap.mp3", sourceSetting: "unwrapSoundSource" },
};

export const AUDIO_SLOT_NAMES = Object.keys(AUDIO_SLOTS) as AudioSlot[];

export const isAudioSlot = (name: string): name is AudioSlot => (AUDIO_SLOT_NAMES as string[]).includes(name);

export const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

export const AUDIO_FORMATS = "MP3, M4A, AAC, OGG, WAV, FLAC";

/** File input filter (extensions too, since some systems report no audio MIME type) */
export const AUDIO_ACCEPT = "audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.flac";

/** An uploaded file; the version busts browser caches after a change */
export const customAudioUrl = (slot: AudioSlot, version: number) => `/api/audio/${slot}?v=${version}`;

/** The file to play: the uploaded one (by version) or the default when null */
export const audioUrl = (slot: AudioSlot, customVersion: number | null) =>
  customVersion === null ? AUDIO_SLOTS[slot].defaultUrl : customAudioUrl(slot, customVersion);
