// Types shared between the server API and the web app

import type { AdminSettings, EmailSettings } from "@/lib/adminStorage";
import type { AudioSlot } from "@/lib/audio";
import type { StreamingLocation, TautulliUser, WrappedStats } from "./tautulli";

export type PublicSettings = Omit<AdminSettings, "nightlySyncTime">;

export interface PublicConfig {
  configured: boolean;
  adminClaimed: boolean;
  settings: PublicSettings;
  plexServerName: string | null;
  /** Per sound: the version of the uploaded file when it is selected, or null for the default */
  customAudioVersions: Record<AudioSlot, number | null>;
}

export interface ViewerInfo {
  kind: "plex";
  userId: number;
  name: string;
  thumb?: string;
  plexUsername?: string;
  plexUserId?: number;
}

export interface SessionInfo {
  viewer: ViewerInfo | null;
  isAdmin: boolean;
  /** Viewer may pick any user (admin only) */
  canViewAnyone: boolean;
}

/** A report period: a calendar year ("2025"), the past 12 months, or all time */
export type ReportPeriod = string;

export interface LeaderboardEntry {
  userId: number;
  username: string;
  friendlyName: string;
  totalWatchTime: number;
}

export interface ReportUser {
  user_id: number;
  username: string;
  friendly_name: string;
  thumb: string;
}

/** Where a viewer stands among everyone who watched something in the period (only sent for the top half) */
export interface ViewerRank {
  /** Share of the other viewers who watched less */
  percentile: number;
  position: number;
  viewers: number;
}

export interface PeriodSummary {
  watchTime: number;
  movies: number;
  shows: number;
  episodes: number;
}

/** The same stretch of time one year before the report period */
export interface PreviousPeriod extends PeriodSummary {
  /** "year": a whole year; "yearToDate": the previous year up to today's date; "rolling": the 12 months before */
  kind: "year" | "yearToDate" | "rolling";
  year: number;
  /** The last day compared, for "yearToDate" */
  until: string | null;
}

export interface ReportHistory {
  /** Hours and viewers per year over the whole history (years without any as 0) */
  yearly: { year: number; hours: number; viewers: number }[];
  previous: PreviousPeriod | null;
}

export interface ReportResponse {
  stats: WrappedStats;
  user: ReportUser | null;
  leaderboard: LeaderboardEntry[];
  /** Only for a single user's report, when the admin shows rankings */
  rank: ViewerRank | null;
  /** Not sent for All Time reports */
  history: ReportHistory | null;
  oldestYear: number | null;
  generatedAt: number;
}

export interface LocationsResponse {
  locations: StreamingLocation[];
  totalIPs: number;
}

export interface BuildingResponse {
  building: true;
  rows: number;
  phase: string;
}

export type CacheState = "idle" | "syncing" | "metadata" | "geolocation" | "prewarm";

export interface CacheStatus {
  state: CacheState;
  phase: string;
  progress: { done: number; total: number } | null;
  rows: number;
  users: number;
  oldestYear: number | null;
  lastFullSync: number | null;
  lastIncrementalSync: number | null;
  lastError: string | null;
  nextRun: number | null;
  metadataEntries: number;
  geolocationEntries: number;
}

export interface UserMappingOverride {
  plexUsername: string;
  tautulliUserId: number;
}

export interface AdminConfig {
  tautulli: { url: string; apiKey: string } | null;
  settings: AdminSettings;
  emailSettings: EmailSettings;
  userMappings: UserMappingOverride[];
  adminPlexUsername: string;
  plexServer: { machineId: string; name: string } | null;
  /** Version of the uploaded app icon, or null when the default icon is used */
  appIconVersion: number | null;
  /** Per sound: the uploaded file (kept while the default is selected), or null */
  customAudio: Record<AudioSlot, CustomAudioInfo | null>;
}

export interface CustomAudioInfo {
  fileName: string;
  version: number;
}

/** An upload also selects the new file, so the updated settings come back too */
export interface AudioUploadResponse {
  customAudio: CustomAudioInfo;
  settings: AdminSettings;
}

export type VersionStatus = "update-available" | "up-to-date" | "develop" | "unknown";

export interface VersionInfo {
  current: string;
  latest: string | null;
  status: VersionStatus;
  releaseUrl: string;
}

export type ApiUser = Pick<TautulliUser, "user_id" | "username" | "friendly_name" | "thumb" | "email">;
