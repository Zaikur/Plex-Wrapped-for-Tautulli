// Compares the running version with the latest GitHub release.
// Checked at startup and then every hour, so a running server notices new releases on its own.

import { APP_VERSION, GITHUB_REPO } from "@/version";
import type { VersionInfo, VersionStatus } from "@/types/api";

const CHECK_EVERY_MS = 3600 * 1000;
// The admin panel checks again when the last check is older than this
// (GitHub allows 60 unauthenticated requests an hour)
const MAX_AGE_MS = 5 * 60 * 1000;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// Parses a JSON response from an external API (shape validated at the call site)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readBody = (response: Response): Promise<any> => response.json();

let latest: { tag: string; releaseUrl: string } | null = null;
/** Time of the last check, successful or not */
let checkedAt = 0;
let checking: Promise<void> | null = null;
/** The newest release already reported in the log */
let announced: string | null = null;

/** Parses tags like v2026.01.07 or 2026.1.7.2 into comparable numbers */
export const parseVersion = (tag: string): number[] | null => {
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[.-](\d+))?$/);
  if (!match) return null;
  return [match[1], match[2], match[3], match[4] ?? "0"].map(Number);
};

export const compareVersions = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
};

const statusFor = (current: string, latestTag: string): VersionStatus => {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latestTag);
  if (!currentParts || !latestParts) return "unknown";
  const cmp = compareVersions(currentParts, latestParts);
  return cmp < 0 ? "update-available" : cmp > 0 ? "develop" : "up-to-date";
};

const fetchLatest = async () => {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Plex-Wrapped-for-Tautulli" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  const data = await readBody(response);
  if (typeof data.tag_name !== "string") throw new Error("Unexpected GitHub response");
  return { tag: data.tag_name as string, releaseUrl: (data.html_url as string) || RELEASES_URL };
};

/** Asks GitHub for the latest release; calls made while a check is running share it */
const checkNow = (): Promise<void> => {
  if (checking) return checking;
  checking = fetchLatest()
    .then((result) => {
      latest = result;
      if (announced !== result.tag && statusFor(APP_VERSION, result.tag) === "update-available") {
        announced = result.tag;
        console.log(`[Version] Update available: ${result.tag} (running ${APP_VERSION}) ${result.releaseUrl}`);
      }
    })
    .catch((error) => {
      // The last good result (if any) is kept
      console.warn("[Version] Update check failed:", (error as Error).message);
    })
    .finally(() => {
      checkedAt = Date.now();
      checking = null;
    });
  return checking;
};

export const getVersionInfo = async (current = APP_VERSION): Promise<VersionInfo> => {
  if (Date.now() - checkedAt > MAX_AGE_MS) await checkNow();
  if (!latest) return { current, latest: null, status: "unknown", releaseUrl: RELEASES_URL };
  return { current, latest: latest.tag, status: statusFor(current, latest.tag), releaseUrl: latest.releaseUrl };
};

export const startVersionChecks = () => {
  checkNow();
  setInterval(checkNow, CHECK_EVERY_MS).unref();
};
