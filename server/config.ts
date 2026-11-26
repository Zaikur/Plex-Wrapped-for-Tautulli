// Server-side configuration (/data/config.json), including migration of older configs

import crypto from "node:crypto";
import { dataPath, readJson, writeJsonAtomic } from "./storage";
import { DEFAULT_ADMIN_SETTINGS, parseMonthDay, type AdminSettings, type EmailSettings } from "@/lib/adminStorage";
import { AUDIO_SLOT_NAMES, AUDIO_SLOTS, type AudioSlot } from "@/lib/audio";
import { isThemeId } from "@/lib/themes";
import type { PublicConfig, UserMappingOverride } from "@/types/api";

export const normalizeOverrides = (raw: unknown): UserMappingOverride[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((entry) => {
    const plexUsername = String(entry?.plexUsername || "").trim();
    const tautulliUserId = Number(entry?.tautulliUserId);
    const key = plexUsername.toLowerCase();
    if (!key || !Number.isInteger(tautulliUserId) || tautulliUserId <= 0 || seen.has(key)) return [];
    seen.add(key);
    return [{ plexUsername, tautulliUserId }];
  });
};

const CONFIG_FILE = dataPath("config.json");

export const DEFAULT_EMAIL_TEMPLATE = `Hi {{friendlyName}},

Your Plex Wrapped for {{serverName}} is ready!

Visit {{appUrl}} to see your personalized viewing statistics.

Sign in with your Plex account to view your report.

Enjoy reliving your year in entertainment!

Best regards,
The {{serverName}} Team`;

export interface StoredConfig {
  plexAuth: {
    adminPlexUsername: string;
    adminPlexUserId?: number;
    userMappingOverrides: UserMappingOverride[];
  };
  tautulli?: { url: string; apiKey: string };
  adminSettings: AdminSettings;
  emailSettings: EmailSettings;
  plexClientId: string;
  plexServer?: { machineId: string; name: string };
  /** Uploaded sounds (stored as /data/custom-<slot>); version = upload time */
  customAudio: Partial<Record<AudioSlot, CustomAudioFile>>;
}

export interface CustomAudioFile {
  fileName: string;
  contentType: string;
  version: number;
}

let config: StoredConfig | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeSettings = (raw: any): AdminSettings => {
  const s = raw && typeof raw === "object" ? raw : {};
  const time = typeof s.nightlySyncTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.nightlySyncTime) ? s.nightlySyncTime : DEFAULT_ADMIN_SETTINGS.nightlySyncTime;
  const height = Number(s.logoMaxHeight);
  return {
    accessMode: "plex",
    allowAllUsers: s.allowAllUsers === true,
    passwordProtectUsers: false,
    normalizeTautulliAnomalies: Boolean(s.normalizeTautulliAnomalies),
    useCustomTitle: Boolean(s.useCustomTitle),
    customTitle: typeof s.customTitle === "string" && s.customTitle ? s.customTitle.slice(0, 100) : DEFAULT_ADMIN_SETTINGS.customTitle,
    useCustomLogo: Boolean(s.useCustomLogo),
    logoMaxHeight: Number.isFinite(height) && height >= 20 && height <= 400 ? height : DEFAULT_ADMIN_SETTINGS.logoMaxHeight,
    enableGeolocation: Boolean(s.enableGeolocation),
    showLeaderboard: s.showLeaderboard !== false,
    showViewerRank: Boolean(s.showViewerRank),
    nightlySyncTime: time,
    // Not trimmed here: the admin panel saves while typing, trailing spaces included
    appName: typeof s.appName === "string" ? s.appName.slice(0, 60) : DEFAULT_ADMIN_SETTINGS.appName,
    currentYearFrom: parseMonthDay(s.currentYearFrom) ? s.currentYearFrom : DEFAULT_ADMIN_SETTINGS.currentYearFrom,
    musicEnabled: s.musicEnabled !== false,
    musicSource: s.musicSource === "custom" ? "custom" : "default",
    musicStartUnmuted: Boolean(s.musicStartUnmuted),
    unwrapSoundEnabled: s.unwrapSoundEnabled !== false,
    unwrapSoundSource: s.unwrapSoundSource === "custom" ? "custom" : "default",
    // Unknown ids fall back to the default, which also covers "classic" (the default theme's old id)
    theme: isThemeId(s.theme) ? s.theme : DEFAULT_ADMIN_SETTINGS.theme,
  };
};

export const loadConfig = async (): Promise<StoredConfig> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await readJson<any>(CONFIG_FILE, {});
  const loaded: StoredConfig = {
    plexAuth: {
      adminPlexUsername: String(raw.plexAuth?.adminPlexUsername || ""),
      adminPlexUserId: Number(raw.plexAuth?.adminPlexUserId) || undefined,
      userMappingOverrides: normalizeOverrides(raw.plexAuth?.userMappingOverrides),
    },
    tautulli: raw.tautulli?.url && raw.tautulli?.apiKey ? { url: raw.tautulli.url, apiKey: raw.tautulli.apiKey } : undefined,
    adminSettings: normalizeSettings(raw.adminSettings),
    emailSettings: {
      appUrl: raw.emailSettings?.appUrl ?? "",
      serverName: raw.emailSettings?.serverName ?? "Plex Server",
      emailTemplate: raw.emailSettings?.emailTemplate ?? DEFAULT_EMAIL_TEMPLATE,
    },
    plexClientId: typeof raw.plexClientId === "string" && raw.plexClientId ? raw.plexClientId : raw.plexAuth?.clientIdentifier || crypto.randomUUID(),
    plexServer: raw.plexServer?.machineId ? raw.plexServer : undefined,
    customAudio: Object.fromEntries(
      AUDIO_SLOT_NAMES.flatMap((slot) => {
        const file = raw.customAudio?.[slot];
        if (!Number.isFinite(file?.version) || typeof file?.contentType !== "string") return [];
        return [[slot, { fileName: String(file.fileName || `Custom ${AUDIO_SLOTS[slot].noun}`), contentType: file.contentType, version: file.version }]];
      })
    ),
  };
  config = loaded;

  // Persist migrations (renamed settings, generated client id) right away
  const migrated = JSON.stringify(raw.adminSettings) !== JSON.stringify(loaded.adminSettings) || raw.plexClientId !== loaded.plexClientId;
  if (migrated) await saveConfig();
  return loaded;
};

export const getConfig = (): StoredConfig => {
  if (!config) throw new Error("Config not loaded");
  return config;
};

export const saveConfig = async (): Promise<void> => {
  await writeJsonAtomic(CONFIG_FILE, getConfig(), true);
};

export const updateConfig = async (mutate: (c: StoredConfig) => void): Promise<StoredConfig> => {
  const c = getConfig();
  mutate(c);
  await saveConfig();
  return c;
};

export const getSettings = () => getConfig().adminSettings;


export const isTautulliConfigured = () => Boolean(getConfig().tautulli);

/** The uploaded file for a slot while it is selected (a missing upload falls back to the default) */
export const selectedCustomAudio = (c: StoredConfig, slot: AudioSlot) =>
  c.adminSettings[AUDIO_SLOTS[slot].sourceSetting] === "custom" ? c.customAudio[slot] : undefined;

export const getPublicConfig = (): PublicConfig => {
  const c = getConfig();
  const { nightlySyncTime, ...settings } = c.adminSettings;
  return {
    configured: Boolean(c.tautulli),
    adminClaimed: Boolean(c.plexAuth.adminPlexUsername),
    settings,
    plexServerName: c.plexServer?.name ?? null,
    customAudioVersions: Object.fromEntries(AUDIO_SLOT_NAMES.map((slot) => [slot, selectedCustomAudio(c, slot)?.version ?? null])) as Record<AudioSlot, number | null>,
  };
};
