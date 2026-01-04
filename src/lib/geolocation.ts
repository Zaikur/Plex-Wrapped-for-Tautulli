// src/lib/geolocation.ts

import { WatchHistory, StreamingLocation } from "@/types/tautulli";

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
  query: string;
}

interface GeolocationCacheEntry {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  cachedAt: number;
}

interface GeolocationCache {
  version: number;
  locations: Record<string, GeolocationCacheEntry>;
  lastUpdated?: number;
}

// In-memory cache
let memoryCache: GeolocationCache | null = null;
let pendingCacheUpdates: Record<string, GeolocationCacheEntry> = {};
let cacheFlushTimeout: ReturnType<typeof setTimeout> | null = null;

// Load geolocation cache from server
const loadGeolocationCache = async (): Promise<GeolocationCache> => {
  if (memoryCache) {
    return memoryCache;
  }

  try {
    const response = await fetch('/api/cache/geolocation');
    if (response.ok) {
      memoryCache = await response.json();
      console.log(`[GeoCache] Loaded ${Object.keys(memoryCache?.locations || {}).length} cached IP locations`);
      return memoryCache!;
    }
  } catch (error) {
    console.error('[GeoCache] Failed to load geolocation cache:', error);
  }

  memoryCache = { version: 1, locations: {} };
  return memoryCache;
};

// Save pending cache updates to server (debounced)
const flushCacheUpdates = async (): Promise<void> => {
  if (Object.keys(pendingCacheUpdates).length === 0) {
    return;
  }

  const updates = { ...pendingCacheUpdates };
  pendingCacheUpdates = {};

  try {
    const response = await fetch('/api/cache/geolocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: updates })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[GeoCache] Saved ${Object.keys(updates).length} new entries (total: ${result.totalEntries})`);
    }
  } catch (error) {
    console.error('[GeoCache] Failed to save cache updates:', error);
    // Put the updates back for retry
    pendingCacheUpdates = { ...updates, ...pendingCacheUpdates };
  }
};

// Schedule a cache flush (debounced)
const scheduleCacheFlush = (): void => {
  if (cacheFlushTimeout) {
    clearTimeout(cacheFlushTimeout);
  }
  cacheFlushTimeout = setTimeout(() => {
    flushCacheUpdates();
    cacheFlushTimeout = null;
  }, 2000);
};

// Add entry to cache
const addToCacheEntry = (ip: string, entry: GeolocationCacheEntry): void => {
  if (memoryCache) {
    memoryCache.locations[ip] = entry;
  }
  pendingCacheUpdates[ip] = entry;
  scheduleCacheFlush();
};

// Get entry from cache
const getFromCache = (ip: string): GeolocationCacheEntry | null => {
  if (!memoryCache) return null;
  return memoryCache.locations[ip] || null;
};

// Normalize IP address
const normalizeIp = (raw: string): string => {
  let ip = raw.split(",")[0].trim();
  if (!ip) return "";

  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  ip = ip.split("%")[0];

  if (ip.toLowerCase().startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  const ipv4PortMatch = ip.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}):\d+$/);
  if (ipv4PortMatch) ip = ipv4PortMatch[1];

  return ip;
};

// Check if IP is public
const isPublicIp = (ip: string): boolean => {
  const ipv4 = ip.match(/^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const c = Number(ipv4[3]);
    const d = Number(ipv4[4]);
    if ([a, b, c, d].some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;

    if (a === 127) return false;
    if (a === 10) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 0) return false;

    return true;
  }

  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return false;
  if (lower.startsWith("fe80:")) return false;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false;

  const looksLikeIpv6 = lower.includes(":");
  return looksLikeIpv6;
};

// Extract unique IPs with their session counts, user info, and dates from watch history
export const extractUniqueIPs = (
  history: WatchHistory[]
): Map<string, { count: number; users: Set<string>; dates: string[] }> => {
  const ipData = new Map<string, { count: number; users: Set<string>; dates: string[] }>();

  const formatSessionDate = (timestamp: number): string => {
    const epochSeconds = timestamp > 10_000_000_000 ? Math.floor(timestamp / 1000) : timestamp;
    const date = new Date(epochSeconds * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  history.forEach((h) => {
    const rawIp = h.ip_address;
    const ip = rawIp ? normalizeIp(rawIp) : "";
    if (!ip || !isPublicIp(ip)) return;

    const existing = ipData.get(ip);
    const userName = h.friendly_name || h.user || "Unknown";
    const sessionLabel = `${formatSessionDate(h.started || h.date)} — ${userName}`;

    if (existing) {
      existing.count += 1;
      existing.users.add(userName);
      existing.dates.push(sessionLabel);
    } else {
      ipData.set(ip, { count: 1, users: new Set([userName]), dates: [sessionLabel] });
    }
  });

  return ipData;
};

// Progress payload for progressive loading
export type GeoLocationProgress = {
  locations: StreamingLocation[];
  processed: number;
  total: number;
  done: boolean;
};

export type GeoLocationProgressCallback = (progress: GeoLocationProgress) => void;

// Geolocate IPs with caching support
export const geolocateIPs = async (
  ipData: Map<string, { count: number; users: Set<string>; dates: string[] }>,
  onProgress?: GeoLocationProgressCallback
): Promise<StreamingLocation[]> => {
  const ips = Array.from(ipData.keys());
  const total = ips.length;

  const locations: StreamingLocation[] = [];

  const report = (processed: number, done: boolean) => {
    onProgress?.({ locations: [...locations], processed, total, done });
  };

  if (total === 0) {
    report(0, true);
    return [];
  }

  // Load cache first
  await loadGeolocationCache();

  // Separate cached and uncached IPs
  const cachedIps: string[] = [];
  const uncachedIps: string[] = [];

  ips.forEach(ip => {
    const cached = getFromCache(ip);
    if (cached) {
      cachedIps.push(ip);
    } else {
      uncachedIps.push(ip);
    }
  });

  console.log(`[Geolocation] ${cachedIps.length} IPs found in cache, ${uncachedIps.length} need lookup`);

  // Add cached locations immediately
  cachedIps.forEach(ip => {
    const cached = getFromCache(ip)!;
    const data = ipData.get(ip);
    locations.push({
      ip,
      city: cached.city,
      region: cached.region,
      country: cached.country,
      countryCode: cached.countryCode,
      lat: cached.lat,
      lon: cached.lon,
      sessionCount: data?.count || 1,
      sessionDates: data?.dates || [],
    });
  });

  // Report initial progress with cached data
  report(cachedIps.length, uncachedIps.length === 0);

  if (uncachedIps.length === 0) {
    return locations;
  }

  // Lookup uncached IPs
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // Helper to build location from API response
  const buildLocationFromResponse = (
    ip: string,
    fields: {
      city?: string;
      region?: string;
      country?: string;
      countryCode?: string;
      lat: number | null;
      lon: number | null;
    }
  ): StreamingLocation | null => {
    if (fields.lat == null || fields.lon == null) return null;

    const data = ipData.get(ip);
    
    // Cache the result
    addToCacheEntry(ip, {
      city: fields.city || "Unknown",
      region: fields.region || "",
      country: fields.country || "Unknown",
      countryCode: fields.countryCode || "",
      lat: fields.lat,
      lon: fields.lon,
      cachedAt: Date.now(),
    });

    return {
      ip,
      city: fields.city || "Unknown",
      region: fields.region || "",
      country: fields.country || "Unknown",
      countryCode: fields.countryCode || "",
      lat: fields.lat,
      lon: fields.lon,
      sessionCount: data?.count || 1,
      sessionDates: data?.dates || [],
    };
  };

  // Try batch API first (HTTP only)
  if (!isHttps && uncachedIps.length > 0) {
    const batchSize = 100;

    for (let i = 0; i < uncachedIps.length; i += batchSize) {
      const batch = uncachedIps.slice(i, i + batchSize);

      try {
        const response = await fetch(
          "http://ip-api.com/batch?fields=status,country,countryCode,region,regionName,city,lat,lon,query",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          }
        );

        if (response.ok) {
          const results: IpApiResponse[] = await response.json();

          results.forEach((result) => {
            if (result.status === "success") {
              const loc = buildLocationFromResponse(result.query, {
                city: result.city,
                region: result.regionName || result.region,
                country: result.country,
                countryCode: result.countryCode,
                lat: result.lat,
                lon: result.lon,
              });
              if (loc) locations.push(loc);
            }
          });
        }
      } catch (error) {
        console.warn("[Geolocation] Batch request failed:", error);
      }

      const processed = cachedIps.length + Math.min(i + batch.length, uncachedIps.length);
      report(processed, processed >= total);

      if (i + batchSize < uncachedIps.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // If batch didn't work (HTTPS or failed), use individual providers
  const remainingIps = uncachedIps.filter(ip => !locations.some(l => l.ip === ip));

  if (remainingIps.length > 0) {
    type IpWhoIsResponse = {
      success: boolean;
      city?: string;
      region?: string;
      country?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
      message?: string;
    };

    type IpApiCoResponse = {
      city?: string;
      region?: string;
      country_name?: string;
      country_code?: string;
      latitude?: number | string;
      longitude?: number | string;
      error?: boolean;
      reason?: string;
    };

    const toNumber = (v: unknown): number | null => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : null;
    };

    const geolocateOne = async (ip: string): Promise<StreamingLocation | null> => {
      // Provider 1: ipwho.is
      try {
        const r1 = await fetch(`https://ipwho.is/${ip}`, { cache: "no-store" });
        if (r1.ok) {
          const d1: IpWhoIsResponse = await r1.json();
          if (d1?.success) {
            return buildLocationFromResponse(ip, {
              city: d1.city,
              region: d1.region,
              country: d1.country,
              countryCode: d1.country_code,
              lat: toNumber(d1.latitude),
              lon: toNumber(d1.longitude),
            });
          }
        }
      } catch (error) {
        console.warn(`[Geolocation] ipwho.is failed for ${ip}:`, error);
      }

      // Provider 2: ipapi.co
      try {
        const r2 = await fetch(`https://ipapi.co/${ip}/json/`, { cache: "no-store" });
        if (r2.ok) {
          const d2: IpApiCoResponse = await r2.json();
          if (!d2?.error) {
            return buildLocationFromResponse(ip, {
              city: d2.city,
              region: d2.region,
              country: d2.country_name,
              countryCode: d2.country_code,
              lat: toNumber(d2.latitude),
              lon: toNumber(d2.longitude),
            });
          }
        }
      } catch (error) {
        console.warn(`[Geolocation] ipapi.co failed for ${ip}:`, error);
      }

      return null;
    };

    const chunkSize = 3;
    let processedCount = cachedIps.length + (uncachedIps.length - remainingIps.length);

    for (let chunkStart = 0; chunkStart < remainingIps.length; chunkStart += chunkSize) {
      const chunk = remainingIps.slice(chunkStart, chunkStart + chunkSize);

      const promises = chunk.map(async (ip, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 250));
        return geolocateOne(ip);
      });

      const results = await Promise.all(promises);
      results.forEach((loc) => {
        if (loc) locations.push(loc);
      });

      processedCount += chunk.length;
      report(processedCount, processedCount >= total);

      if (chunkStart + chunkSize < remainingIps.length) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  // Ensure cache is flushed
  await flushCacheUpdates();

  return locations;
};

// Calculate optimal map bounds based on locations
export const calculateMapBounds = (locations: StreamingLocation[]): {
  centerLat: number;
  centerLon: number;
  zoom: number;
} => {
  if (locations.length === 0) {
    return { centerLat: 20, centerLon: 0, zoom: 1 };
  }

  if (locations.length === 1) {
    return { centerLat: locations[0].lat, centerLon: locations[0].lon, zoom: 4 };
  }

  const lats = locations.map(l => l.lat);
  const lons = locations.map(l => l.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const maxSpan = Math.max(latSpan, lonSpan);

  let zoom: number;
  if (maxSpan < 2) zoom = 6;
  else if (maxSpan < 5) zoom = 5;
  else if (maxSpan < 15) zoom = 4;
  else if (maxSpan < 40) zoom = 3;
  else if (maxSpan < 80) zoom = 2;
  else zoom = 1;

  return { centerLat, centerLon, zoom };
};

// Generate fun text based on streaming locations
export const generateLocationInsight = (locations: StreamingLocation[]): string => {
  if (locations.length === 0) {
    return "Looks like you're streaming from a secret location! 🕵️";
  }

  const countries = [...new Set(locations.map(l => l.country))];
  const cities = [...new Set(locations.map(l => l.city).filter(c => c !== 'Unknown'))];
  const totalSessions = locations.reduce((sum, l) => sum + l.sessionCount, 0);

  const sortedByCount = [...locations].sort((a, b) => b.sessionCount - a.sessionCount);
  const topLocation = sortedByCount[0];

  if (countries.length === 1) {
    if (cities.length === 1) {
      return `Home sweet home! All ${totalSessions} streams from ${cities[0]}, ${countries[0]}`;
    }
    return `A true ${countries[0]} explorer! Streamed from ${cities.length} different cities`;
  }

  if (countries.length === 2) {
    return `Living the dual-timezone life! Streams from ${countries.join(' and ')}`;
  }

  if (countries.length >= 5) {
    return `World traveler alert! Streamed from ${countries.length} different countries`;
  }

  if (countries.length >= 3) {
    return `International viewer! Streams from ${countries.join(', ')}`;
  }

  return `Your streaming HQ: ${topLocation.city}, ${topLocation.country}`;
};