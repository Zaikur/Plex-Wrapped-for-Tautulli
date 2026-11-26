// Uploaded sounds (background music, unwrap sound): one file per slot in /data, details in config.json

import fs from "node:fs/promises";
import path from "node:path";
import { AUDIO_FORMATS, AUDIO_SLOT_NAMES, AUDIO_SLOTS, type AudioSlot } from "@/lib/audio";
import { getConfig, updateConfig } from "./config";
import { dataPath } from "./storage";

/** Absolute, as res.sendFile requires */
export const customAudioFile = (slot: AudioSlot) => path.resolve(dataPath(`custom-${slot}`));

/** Recognizes the audio formats browsers can play from their first bytes; null for anything else */
export const detectAudioType = (buf: Buffer): string | null => {
  if (buf.length < 12) return null;
  const ascii = (start: number, end: number) => buf.subarray(start, end).toString("latin1");

  if (ascii(0, 3) === "ID3") {
    // Skip the ID3 tag (syncsafe size, optional footer); tagged files are almost always MP3
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    const footer = buf[5] & 0x10 ? 10 : 0;
    return detectAudioType(buf.subarray(10 + size + footer)) ?? "audio/mpeg";
  }
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  if (ascii(0, 4) === "OggS") return "audio/ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 4) === "fLaC") return "audio/flac";
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    // Frame sync: layer bits 00 mean ADTS AAC, anything else MPEG audio (MP3)
    return (buf[1] & 0x06) === 0 ? "audio/aac" : "audio/mpeg";
  }
  return null;
};

/** Stores an uploaded file and selects it; returns an error message for unsupported files */
export const saveCustomAudio = async (slot: AudioSlot, buf: Buffer, fileName: string): Promise<string | null> => {
  const contentType = detectAudioType(buf);
  if (!contentType) return `Unsupported audio file. Use ${AUDIO_FORMATS}.`;
  const file = customAudioFile(slot);
  await fs.writeFile(`${file}.tmp`, buf);
  await fs.rename(`${file}.tmp`, file);
  await updateConfig((c) => {
    c.customAudio[slot] = { fileName: fileName.trim().slice(0, 200) || `Custom ${AUDIO_SLOTS[slot].noun}`, contentType, version: Date.now() };
    c.adminSettings[AUDIO_SLOTS[slot].sourceSetting] = "custom";
  });
  return null;
};

/** Deletes an uploaded file and goes back to the default one */
export const deleteCustomAudio = async (slot: AudioSlot) => {
  await fs.rm(customAudioFile(slot), { force: true });
  await updateConfig((c) => {
    delete c.customAudio[slot];
    c.adminSettings[AUDIO_SLOTS[slot].sourceSetting] = "default";
  });
};

/** Forgets uploads whose file has gone missing (e.g. a partly restored /data folder) */
export const loadCustomAudio = async () => {
  for (const slot of AUDIO_SLOT_NAMES) {
    if (!getConfig().customAudio[slot]) continue;
    try {
      await fs.access(customAudioFile(slot));
    } catch {
      console.warn(`[Audio] The uploaded ${AUDIO_SLOTS[slot].noun} (${slot}) is missing, using the default one`);
      await updateConfig((c) => {
        delete c.customAudio[slot];
        c.adminSettings[AUDIO_SLOTS[slot].sourceSetting] = "default";
      });
    }
  }
};
