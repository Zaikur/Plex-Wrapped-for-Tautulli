import { format as formatDate } from "date-fns";
import { TautulliUser, WatchHistory, WrappedStats, TautulliConfig } from "@/types/tautulli";

// Use proxy endpoint instead of direct Tautulli calls
const buildProxyUrl = (cmd: string, params: Record<string, string> = {}) => {
  const url = new URL('/api/tautulli', window.location.origin);
  url.searchParams.set('cmd', cmd);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const normalizeUrl = (inputUrl: string): string => {
  let url = inputUrl.trim().replace(/\/$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url;
};

// Metadata cache types and helpers
interface MetadataCacheEntry {
  duration: number; // in milliseconds (as returned by Tautulli)
  title?: string;
  mediaType?: string;
  genres?: string[];
  actors?: string[];
  directors?: string[];
  cachedAt: number;
}

interface MetadataCache {
  version: number;
  metadata: Record<string, MetadataCacheEntry>;
  lastUpdated?: number;
}

// In-memory cache for the current session
let memoryCache: MetadataCache | null = null;
let pendingCacheUpdates: Record<string, MetadataCacheEntry> = {};
let cacheFlushTimeout: ReturnType<typeof setTimeout> | null = null;

// Load metadata cache from server
const loadMetadataCache = async (): Promise<MetadataCache> => {
  if (memoryCache) {
    return memoryCache;
  }
  
  try {
    const response = await fetch('/api/cache/metadata');
    if (response.ok) {
      memoryCache = await response.json();
      console.log(`[Cache] Loaded ${Object.keys(memoryCache?.metadata || {}).length} cached metadata entries`);
      return memoryCache!;
    }
  } catch (error) {
    console.error('[Cache] Failed to load metadata cache:', error);
  }
  
  memoryCache = { version: 1, metadata: {} };
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
    const response = await fetch('/api/cache/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: updates })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`[Cache] Saved ${Object.keys(updates).length} new entries (total: ${result.totalEntries})`);
    }
  } catch (error) {
    console.error('[Cache] Failed to save cache updates:', error);
    // Put the updates back for retry
    pendingCacheUpdates = { ...updates, ...pendingCacheUpdates };
  }
};

// Schedule a cache flush (debounced to batch updates)
const scheduleCacheFlush = (): void => {
  if (cacheFlushTimeout) {
    clearTimeout(cacheFlushTimeout);
  }
  cacheFlushTimeout = setTimeout(() => {
    flushCacheUpdates();
    cacheFlushTimeout = null;
  }, 2000); // Flush after 2 seconds of no new updates
};

// Add entry to cache
const addToCacheEntry = (ratingKey: number, entry: MetadataCacheEntry): void => {
  const key = ratingKey.toString();
  
  // Update memory cache
  if (memoryCache) {
    memoryCache.metadata[key] = entry;
  }
  
  // Queue for persistence
  pendingCacheUpdates[key] = entry;
  scheduleCacheFlush();
};

// Get entry from cache
const getFromCache = (ratingKey: number): MetadataCacheEntry | null => {
  if (!memoryCache) return null;
  return memoryCache.metadata[ratingKey.toString()] || null;
};

// Helper function to get runtime from metadata (returns seconds)
const getRuntimeSeconds = async (
  config: TautulliConfig, 
  ratingKey: number,
  useCache: boolean = true
): Promise<number | null> => {
  // Check cache first
  if (useCache) {
    const cached = getFromCache(ratingKey);
    if (cached && cached.duration > 0) {
      // Convert from milliseconds to seconds
      const seconds = Math.floor(cached.duration / 1000);
      return seconds;
    }
  }
  
  try {
    const url = buildProxyUrl('get_metadata', {
      rating_key: ratingKey.toString(),
    });
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.response?.result === 'success' && data.response.data) {
      const meta = data.response.data;
      const rawDuration = meta.duration;
      
      // Parse duration - it may come as a string or number
      const duration = typeof rawDuration === 'string' ? parseFloat(rawDuration) : rawDuration;
      
      // Extract genres, actors, directors
      const genres = meta.genres || [];
      const actors = (meta.actors || []).slice(0, 3).map((a: { tag: string } | string) => 
        typeof a === 'string' ? a : a.tag || ''
      ).filter(Boolean);
      const directors = (meta.directors || []).slice(0, 2).map((d: { tag: string } | string) => 
        typeof d === 'string' ? d : d.tag || ''
      ).filter(Boolean);
      
      if (duration && typeof duration === 'number' && !isNaN(duration) && duration > 0) {
        // Cache the raw duration (in milliseconds as returned by Tautulli) along with other metadata
        addToCacheEntry(ratingKey, {
          duration: duration,
          title: meta.title,
          mediaType: meta.media_type,
          genres,
          actors,
          directors,
          cachedAt: Date.now()
        });
        
        // Tautulli metadata duration is typically in milliseconds
        if (duration > 100000) {
          const seconds = Math.floor(duration / 1000);
          return seconds;
        } else if (duration > 1000) {
          return Math.floor(duration);
        } else {
          const seconds = Math.floor(duration * 60);
          return seconds;
        }
      } else {
        // Cache even without duration to store other metadata
        addToCacheEntry(ratingKey, {
          duration: 0,
          title: meta.title,
          mediaType: meta.media_type,
          genres,
          actors,
          directors,
          cachedAt: Date.now()
        });
      }
    }
    return null;
  } catch (error) {
    console.error(`[getRuntimeSeconds] Error fetching metadata for ${ratingKey}:`, error);
    return null;
  }
};

// Get cached metadata for a rating key
export const getCachedMetadata = (ratingKey: number): MetadataCacheEntry | null => {
  return getFromCache(ratingKey);
};

export const testConnection = async (config: TautulliConfig): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedConfig = {
      ...config,
      url: normalizeUrl(config.url)
    };
    
    const saveResponse = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tautulli: normalizedConfig })
    });
    
    if (!saveResponse.ok) {
      return { success: false, error: 'Failed to save configuration' };
    }

    const response = await fetch(buildProxyUrl('get_server_info'), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const data = await response.json();
    return { success: data.response?.result === 'success', error: data.response?.result !== 'success' ? 'Invalid API response' : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: `Connection failed: ${message}. Make sure Tautulli is accessible from the server.`
    };
  }
};

export const getUsers = async (config: TautulliConfig): Promise<TautulliUser[]> => {
  try {
    const response = await fetch(buildProxyUrl('get_users'));
    const data = await response.json();
    if (data.response?.result === 'success') {
      return data.response.data || [];
    }
    return [];
  } catch {
    return [];
  }
};

export const getHistory = async (
  config: TautulliConfig,
  userId?: number,
  startDate?: string,
  endDate?: string,
  pageSize: number = 5000,
  normalizeAnomalies: boolean = false
): Promise<WatchHistory[]> => {
  try {
    const normalizeEpochSeconds = (value?: number) => {
      if (!value || !Number.isFinite(value)) return 0;
      return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
    };

    const startTimestamp = startDate
      ? Math.floor(new Date(`${startDate}T00:00:00`).getTime() / 1000)
      : null;
    const endTimestamp = endDate
      ? Math.floor(new Date(`${endDate}T23:59:59`).getTime() / 1000)
      : null;

    const getItemTime = (item: WatchHistory) => {
      const started = normalizeEpochSeconds(item.started);
      const date = normalizeEpochSeconds(item.date);
      return started > 0 ? started : date;
    };

    const parseNumber = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const s = v.trim();
        if (!s) return 0;
        if (/^\d+$/.test(s)) return Number(s);
        const ms = Date.parse(s);
        return Number.isFinite(ms) ? ms : 0;
      }
      return 0;
    };

    const getHistoryKey = (h: WatchHistory) => {
      const uid = Number(h.user_id) || 0;
      const rowId = Number(h.row_id);
      if (Number.isFinite(rowId) && rowId > 0) return `row:${uid}:${rowId}`;
      const refId = Number(h.reference_id);
      if (Number.isFinite(refId) && refId > 0) return `ref:${uid}:${refId}`;
      const id = Number(h.id);
      if (Number.isFinite(id) && id > 0) return `id:${uid}:${id}`;
      return `fallback:${h.user_id}:${h.started}:${h.date}:${h.rating_key}:${h.stopped}:${h.duration}`;
    };

    const fetchAll = async (grouping: "0" | "1") => {
      const baseParams: Record<string, string> = {
        length: pageSize.toString(),
        order_column: "started",
        order_dir: "desc",
        include_activity: "0",
        grouping,
      };

      if (userId != null) {
        baseParams.user_id = userId.toString();
      }

      const all: WatchHistory[] = [];
      const seen = new Set<string>();

      let start = 0;

      while (true) {
        const params = { ...baseParams, start: start.toString() };
        const response = await fetch(buildProxyUrl("get_history", params));
        const data = await response.json();

        if (data.response?.result !== "success") {
          break;
        }

        const table = data.response?.data;
        const pageRaw = (table?.data || []) as any[];

        if (pageRaw.length === 0) {
          break;
        }

        const page: WatchHistory[] = pageRaw.map((item) => ({
          ...item,
          reference_id: parseNumber(item.reference_id),
          row_id: parseNumber(item.row_id),
          id: parseNumber(item.id),
          date: parseNumber(item.date),
          started: parseNumber(item.started),
          stopped: parseNumber(item.stopped),
          duration: parseNumber(item.duration),
          play_duration: parseNumber(item.play_duration),
          paused_counter: parseNumber(item.paused_counter),
          user_id: parseNumber(item.user_id),
          rating_key: parseNumber(item.rating_key),
          parent_rating_key: parseNumber(item.parent_rating_key),
          grandparent_rating_key: parseNumber(item.grandparent_rating_key),
          group_count: parseNumber(item.group_count),
          percent_complete: parseNumber(item.percent_complete),
          live: parseNumber(item.live),
          relayed: parseNumber(item.relayed),
          secure: parseNumber(item.secure),
          watched_status: parseNumber(item.watched_status),
          media_index: parseNumber(item.media_index),
          parent_media_index: parseNumber(item.parent_media_index),
          year: parseNumber(item.year),
        }));

        let added = 0;
        for (const item of page) {
          const key = getHistoryKey(item);
          if (seen.has(key)) continue;
          seen.add(key);
          all.push(item);
          added++;
        }

        if (added === 0) {
          break;
        }

        start += page.length;

        if (startTimestamp != null) {
          const oldestInPage = getItemTime(page[page.length - 1]);
          if (oldestInPage > 0 && oldestInPage < startTimestamp) {
            break;
          }
        }

        if (start >= 100000) {
          break;
        }
      }

      const filtered =
        startTimestamp == null && endTimestamp == null
          ? all
          : all.filter((item) => {
              const t = getItemTime(item);
              if (!t) return false;
              if (startTimestamp != null && t < startTimestamp) return false;
              if (endTimestamp != null && t > endTimestamp) return false;
              return true;
            });

      const groupedRows = filtered.filter((h) => {
        const gc = Number(h.group_count);
        const gids = String(h.group_ids ?? "");
        return (Number.isFinite(gc) && gc > 1) || gids.includes(",");
      });

      return {
        grouping,
        all,
        filtered,
        grouped: groupedRows.length,
        groupedSample: groupedRows[0],
      };
    };

    const r0 = await fetchAll("0");
    const r1 = r0.grouped > 0 ? await fetchAll("1") : null;
    const best = r1 && r1.grouped < r0.grouped ? r1 : r0;

    // Normalize anomalies if enabled
    if (normalizeAnomalies && best.filtered.length > 0) {
      console.log("[Normalization] Starting anomaly detection and correction...");
      console.log(`[Normalization] Processing ${best.filtered.length} history items`);
      
      // Load the metadata cache first
      await loadMetadataCache();
      
      // Get unique rating keys
      const uniqueRatingKeys = new Set<number>();
      best.filtered.forEach(h => {
        if (h.rating_key) uniqueRatingKeys.add(h.rating_key);
      });

      console.log(`[Normalization] Found ${uniqueRatingKeys.size} unique items to check`);

      // Check which items are already cached
      const ratingKeyArray = Array.from(uniqueRatingKeys);
      const uncachedKeys = ratingKeyArray.filter(key => !getFromCache(key));
      
      console.log(`[Normalization] ${ratingKeyArray.length - uncachedKeys.length} items found in cache, ${uncachedKeys.length} need fetching`);

      // Fetch runtimes only for uncached items (with rate limiting)
      const runtimeCache = new Map<number, number>();
      
      // First, populate from memory cache
      ratingKeyArray.forEach(key => {
        const cached = getFromCache(key);
        if (cached && cached.duration > 0) {
          const seconds = Math.floor(cached.duration / 1000);
          runtimeCache.set(key, seconds);
        }
      });
      
      // Then fetch uncached items
      if (uncachedKeys.length > 0) {
        const batchSize = 10;
        
        for (let i = 0; i < uncachedKeys.length; i += batchSize) {
          const batch = uncachedKeys.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (ratingKey) => {
              const runtime = await getRuntimeSeconds(config, ratingKey, false); // Don't check cache again
              if (runtime) {
                runtimeCache.set(ratingKey, runtime);
              }
            })
          );
          
          // Progress logging for large fetches
          if (uncachedKeys.length > 50 && (i + batchSize) % 100 === 0) {
            console.log(`[Normalization] Fetched ${Math.min(i + batchSize, uncachedKeys.length)}/${uncachedKeys.length} metadata entries...`);
          }
          
          if (i + batchSize < uncachedKeys.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Ensure cache is flushed after fetching
        await flushCacheUpdates();
      }

      console.log(`[Normalization] Have runtimes for ${runtimeCache.size} unique items`);

      // Normalize durations
      let correctedCount = 0;
      const corrections: string[] = [];
      
      best.filtered.forEach(h => {
        const runtime = runtimeCache.get(h.rating_key);
        if (!runtime || runtime <= 0) return;
        
        let wasCorrected = false;
        const title = h.grandparent_title 
          ? `${h.grandparent_title} - ${h.title}` 
          : (h.full_title || h.title || 'Unknown');
        
        // Check duration - if it's more than 1.5x the runtime, it's anomalous
        if (h.duration && h.duration > runtime * 1.5) {
          const originalMinutes = Math.round(h.duration / 60);
          const runtimeMinutes = Math.round(runtime / 60);
          corrections.push(`"${title}": duration ${originalMinutes}min → ${runtimeMinutes}min`);
          h.duration = runtime;
          wasCorrected = true;
        }
        
        // Check play_duration
        if (h.play_duration && h.play_duration > runtime * 1.5) {
          const originalMinutes = Math.round(h.play_duration / 60);
          const runtimeMinutes = Math.round(runtime / 60);
          if (!wasCorrected) {
            corrections.push(`"${title}": play_duration ${originalMinutes}min → ${runtimeMinutes}min`);
          }
          h.play_duration = runtime;
          wasCorrected = true;
        }
        
        // Check wall clock time (stopped - started)
        const started = normalizeEpochSeconds(h.started);
        const stopped = normalizeEpochSeconds(h.stopped);
        if (started > 0 && stopped > started) {
          const wallClock = stopped - started;
          if (wallClock > runtime * 1.5) {
            h.stopped = started + runtime;
            wasCorrected = true;
          }
        }
        
        if (wasCorrected) {
          correctedCount++;
        }
      });

      console.log(`[Normalization] Corrected ${correctedCount} anomalies out of ${best.filtered.length} history items`);
      if (corrections.length > 0) {
        console.log("[Normalization] Corrections made:");
        corrections.slice(0, 20).forEach(c => console.log(`  - ${c}`));
        if (corrections.length > 20) {
          console.log(`  ... and ${corrections.length - 20} more`);
        }
      }
    }

    console.debug("[getHistory] fetched+filtered", {
      userId,
      startDate,
      endDate,
      grouping: best.grouping,
      groupedRows: best.grouped,
      fetched: best.all.length,
      filtered: best.filtered.length,
      normalized: normalizeAnomalies,
    });

    return best.filtered;
  } catch {
    return [];
  }
};

export const getOldestHistoryYear = async (config: TautulliConfig): Promise<number | null> => {
  try {
    const response = await fetch(buildProxyUrl('get_history', {
      length: '1',
      order_column: 'started',
      order_dir: 'asc',
    }));
    const data = await response.json();
    
    if (data.response?.result === 'success') {
      const table = data.response?.data;
      const rows = table?.data || [];
      if (rows.length > 0) {
        const oldest = rows[0];
        const started = oldest.started;
        const epochSeconds = started > 10_000_000_000 ? Math.floor(started / 1000) : started;
        const date = new Date(epochSeconds * 1000);
        return date.getFullYear();
      }
    }
    return null;
  } catch {
    return [];
  }
};

export const getMetadata = async (
  config: TautulliConfig,
  ratingKey: number
): Promise<{ genres: string[]; actors: string[]; directors: string[] } | null> => {
  // Check cache first
  const cached = getFromCache(ratingKey);
  if (cached && (cached.genres || cached.actors || cached.directors)) {
    return {
      genres: cached.genres || [],
      actors: cached.actors || [],
      directors: cached.directors || [],
    };
  }
  
  try {
    const response = await fetch(buildProxyUrl('get_metadata', {
      rating_key: ratingKey.toString(),
    }));
    const data = await response.json();
    if (data.response?.result === 'success' && data.response.data) {
      const meta = data.response.data;
      
      const genres = meta.genres || [];
      const actors = (meta.actors || []).slice(0, 1).map((a: { tag: string }) => a.tag || a);
      const directors = (meta.directors || []).slice(0, 1).map((d: { tag: string }) => d.tag || d);
      
      // Update cache with this metadata
      const existingCache = getFromCache(ratingKey);
      addToCacheEntry(ratingKey, {
        duration: existingCache?.duration || 0,
        title: meta.title,
        mediaType: meta.media_type,
        genres,
        actors,
        directors,
        cachedAt: Date.now()
      });
      
      return { genres, actors, directors };
    }
    return null;
  } catch {
    return null;
  }
};

export const getImageUrl = (config: TautulliConfig, thumb: string): string => {
  if (!thumb) return '';
  return buildProxyUrl('pms_image_proxy', {
    img: thumb,
    width: '300',
    height: '450',
  });
};

export const calculateWrappedStats = (history: WatchHistory[]): WrappedStats => {
  if (!history.length) {
    return {
      totalWatchTime: 0,
      totalMovies: 0,
      totalShows: 0,
      totalEpisodes: 0,
      topMovie: null,
      topShow: null,
      topMovies: [],
      topShows: [],
      watchByDay: [],
      watchByHour: [],
      watchByMonth: [],
      watchByYear: [],
      longestBinge: null,
      lateNightSessions: 0,
      weekendPercentage: 0,
      mostActiveDay: null,
      uniqueTitles: 0,
      avgDailyWatchTime: 0,
      avgSessionLength: 0,
      mostBingedDay: null,
      earlyBirdSessions: 0,
      platforms: [],
      firstWatch: null,
      lastWatch: null,
      longestStreak: 0,
      totalSessions: 0,
      peakHour: 0,
      morningWatchTime: 0,
      afternoonWatchTime: 0,
      eveningWatchTime: 0,
      nightWatchTime: 0,
      topGenres: [],
      topActors: [],
      topDirectors: [],
      contentDecades: [],
      mostRewatched: null,
      topMoviesByUsers: [],
      topShowsByUsers: [],
      peakConcurrentStreams: null,
    };
  }

  const normalizeEpochSeconds = (value?: number) => {
    if (!value || !Number.isFinite(value)) return 0;
    return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  };

  // Duration values from Tautulli history are in SECONDS
  // We do NOT apply any automatic caps here - if normalization is needed,
  // it should be done in getHistory with the normalizeAnomalies option
  const normalizeDurationSeconds = (value?: number) => {
    if (!value || !Number.isFinite(value)) return 0;
    // Only convert if it looks like milliseconds (> 10 million = > 115 days in seconds)
    if (value > 10_000_000) {
      return Math.round(value / 1000);
    }
    return value;
  };

  const getEventSeconds = (h: WatchHistory) => {
    const started = normalizeEpochSeconds(h.started);
    const date = normalizeEpochSeconds(h.date);
    return started > 0 ? started : date;
  };

  const getSessionSeconds = (h: WatchHistory) => {
    // Try play_duration first (this is what Tautulli uses for "Watch Time")
    const playDuration = normalizeDurationSeconds(h.play_duration);
    if (playDuration > 0) {
      return playDuration;
    }

    // Fallback to wall-clock time
    const started = normalizeEpochSeconds(h.started);
    const stopped = normalizeEpochSeconds(h.stopped);
    if (started > 0 && stopped > started) {
      return stopped - started;
    }

    // Last resort: duration field
    const duration = normalizeDurationSeconds(h.duration);
    if (duration > 0) {
      return duration;
    }

    return 0;
  };

  const totalWatchTime = history.reduce((sum, item) => sum + getSessionSeconds(item), 0);

  const movies = history.filter((h) => h.media_type === 'movie');
  const episodes = history.filter((h) => h.media_type === 'episode');
  
  const uniqueMovies = new Set(movies.map(m => m.rating_key));
  const uniqueShows = new Set(episodes.map(e => e.grandparent_rating_key));
  const uniqueTitles = new Set(history.map(h => h.rating_key));

  // Top movies by watch time
  const movieCounts: Record<string, { count: number; time: number; year: number; thumb: string; users: Set<number> }> = {};
  movies.forEach(m => {
    const key = m.full_title || m.title;
    if (!movieCounts[key]) {
      movieCounts[key] = { count: 0, time: 0, year: m.year, thumb: m.thumb, users: new Set() };
    }
    movieCounts[key].count++;
    movieCounts[key].time += getSessionSeconds(m);
    movieCounts[key].users.add(m.user_id);
  });

  const sortedMovies = Object.entries(movieCounts).sort((a, b) => b[1].time - a[1].time);
  const topMovieEntry = sortedMovies[0];
  const topMovie = topMovieEntry ? {
    title: topMovieEntry[0],
    year: topMovieEntry[1].year,
    watchCount: topMovieEntry[1].count,
    totalTime: topMovieEntry[1].time,
    thumb: topMovieEntry[1].thumb,
    userCount: topMovieEntry[1].users.size,
  } : null;

  const topMovies = sortedMovies.slice(0, 5).map(([title, data]) => ({
    title,
    year: data.year,
    watchCount: data.count,
    totalTime: data.time,
    thumb: data.thumb,
  }));

  // Top shows by watch time
  const showCounts: Record<string, { count: number; time: number; episodes: Set<number>; thumb: string; users: Set<number> }> = {};
  episodes.forEach(e => {
    const key = e.grandparent_title || e.title;
    if (!showCounts[key]) {
      showCounts[key] = { count: 0, time: 0, episodes: new Set(), thumb: e.thumb, users: new Set() };
    }
    showCounts[key].count++;
    showCounts[key].time += getSessionSeconds(e);
    showCounts[key].episodes.add(e.rating_key);
    showCounts[key].users.add(e.user_id);
  });

  const sortedShows = Object.entries(showCounts).sort((a, b) => b[1].time - a[1].time);
  const topShowEntry = sortedShows[0];
  const topShow = topShowEntry ? {
    title: topShowEntry[0],
    watchCount: topShowEntry[1].count,
    totalTime: topShowEntry[1].time,
    episodeCount: topShowEntry[1].episodes.size,
    thumb: topShowEntry[1].thumb,
    userCount: topShowEntry[1].users.size,
  } : null;

  const topShows = sortedShows.slice(0, 5).map(([title, data]) => ({
    title,
    watchCount: data.count,
    totalTime: data.time,
    episodeCount: data.episodes.size,
    thumb: data.thumb,
  }));

  // Watch by day of week - starting with Monday
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayStats: Record<string, number> = {};
  dayNames.forEach(day => { dayStats[day] = 0; });
  
  // Map JavaScript day (0=Sunday) to our day names
  const jsDayToName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  history.forEach(h => {
    const date = new Date(getEventSeconds(h) * 1000);
    const day = jsDayToName[date.getDay()];
    dayStats[day] += getSessionSeconds(h);
  });

  const watchByDay = dayNames.map(day => ({
    day,
    hours: Math.round((dayStats[day] / 3600) * 10) / 10,
  }));

  // Watch by hour
  const hourStats: Record<number, number> = {};
  for (let i = 0; i < 24; i++) { hourStats[i] = 0; }
  
  history.forEach(h => {
    const date = new Date(getEventSeconds(h) * 1000);
    const hour = date.getHours();
    hourStats[hour] += getSessionSeconds(h);
  });

  const watchByHour = Object.entries(hourStats).map(([hour, seconds]) => ({
    hour: parseInt(hour),
    minutes: Math.round(seconds / 60),
  }));

  // Watch by month
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStats: Record<string, number> = {};
  monthNames.forEach(m => { monthStats[m] = 0; });
  
  history.forEach(h => {
    const date = new Date(getEventSeconds(h) * 1000);
    const month = monthNames[date.getMonth()];
    monthStats[month] += getSessionSeconds(h);
  });

  const watchByMonth = monthNames.map(month => ({
    month,
    hours: Math.round((monthStats[month] / 3600) * 100) / 100,
  }));

  // Watch by year
  const yearStats: Record<number, number> = {};
  history.forEach(h => {
    const date = new Date(getEventSeconds(h) * 1000);
    const year = date.getFullYear();
    if (!yearStats[year]) yearStats[year] = 0;
    yearStats[year] += getSessionSeconds(h);
  });

  const watchByYear = Object.entries(yearStats)
    .map(([year, seconds]) => ({
      year: parseInt(year),
      hours: Math.round((seconds / 3600) * 100) / 100,
    }))
    .sort((a, b) => a.year - b.year);

  // Late night sessions (after midnight, before 5am)
  const lateNightSessions = history.filter(h => {
    const hour = new Date(getEventSeconds(h) * 1000).getHours();
    return hour >= 0 && hour < 5;
  }).length;

  // Early bird sessions (5am - 8am)
  const earlyBirdSessions = history.filter(h => {
    const hour = new Date(getEventSeconds(h) * 1000).getHours();
    return hour >= 5 && hour < 8;
  }).length;

  // Weekend percentage
  const weekendHistory = history.filter(h => {
    const day = new Date(getEventSeconds(h) * 1000).getDay();
    return day === 0 || day === 6;
  });
  const weekendPercentage = Math.round((weekendHistory.length / history.length) * 100);

  // Find longest single session
  const sessionsWithDuration = history.map(h => ({
    item: h,
    duration: getSessionSeconds(h)
  })).filter(s => s.duration > 0);
  
  const sortedByDuration = sessionsWithDuration.sort((a, b) => b.duration - a.duration);
  const longestSession = sortedByDuration[0];
  const longestBinge = longestSession ? {
    title: longestSession.item.full_title || longestSession.item.title,
    duration: longestSession.duration,
    date: formatDate(new Date(getEventSeconds(longestSession.item) * 1000), "MMMM do yyyy"),
  } : null;

  // Most active day
  const mostActiveDay = [...watchByDay].sort((a, b) => b.hours - a.hours)[0];

  // Daily watch time for average calculation
  const dailyWatchTime: Record<string, number> = {};
  history.forEach(h => {
    const dateKey = new Date(getEventSeconds(h) * 1000).toDateString();
    dailyWatchTime[dateKey] = (dailyWatchTime[dateKey] || 0) + getSessionSeconds(h);
  });
  const daysWatched = Object.keys(dailyWatchTime).length;
  const avgDailyWatchTime = daysWatched > 0 ? totalWatchTime / daysWatched : 0;

  // Most binged day
  const mostBingedDayEntry = Object.entries(dailyWatchTime).sort((a, b) => b[1] - a[1])[0];
  const mostBingedDay = mostBingedDayEntry ? {
    date: mostBingedDayEntry[0],
    duration: mostBingedDayEntry[1],
  } : null;

  // Platform stats
  const platformCounts: Record<string, number> = {};
  history.forEach(h => {
    const platform = h.platform || 'Unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });
  const platforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / history.length) * 100) }));

  // First and last watch
  const sortedByDate = [...history].sort((a, b) => getEventSeconds(a) - getEventSeconds(b));
  const firstWatchItem = sortedByDate[0];
  const lastWatchItem = sortedByDate[sortedByDate.length - 1];
  
  const firstWatch = firstWatchItem ? {
    title: firstWatchItem.full_title || firstWatchItem.title,
    date: formatDate(new Date(getEventSeconds(firstWatchItem) * 1000), "MMMM do yyyy"),
  } : null;
  
  const lastWatch = lastWatchItem ? {
    title: lastWatchItem.full_title || lastWatchItem.title,
    date: formatDate(new Date(getEventSeconds(lastWatchItem) * 1000), "MMMM do yyyy"),
  } : null;

  // Longest streak
  const watchDateTimestamps = [...new Set(history.map(h => {
    const d = new Date(getEventSeconds(h) * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }))].sort((a, b) => a - b);
  
  let currentStreak = 1;
  let longestStreak = watchDateTimestamps.length > 0 ? 1 : 0;
  
  for (let i = 1; i < watchDateTimestamps.length; i++) {
    const prevTime = watchDateTimestamps[i - 1];
    const currTime = watchDateTimestamps[i];
    const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  // Average session length
  const avgSessionLength = history.length > 0 ? totalWatchTime / history.length : 0;

  // Peak hour
  const peakHourEntry = Object.entries(hourStats).sort((a, b) => b[1] - a[1])[0];
  const peakHour = peakHourEntry ? parseInt(peakHourEntry[0]) : 0;

  // Watch time by time of day
  let morningWatchTime = 0;
  let afternoonWatchTime = 0;
  let eveningWatchTime = 0;
  let nightWatchTime = 0;

  Object.entries(hourStats).forEach(([hourStr, seconds]) => {
    const hour = parseInt(hourStr);
    if (hour >= 5 && hour < 12) {
      morningWatchTime += seconds;
    } else if (hour >= 12 && hour < 18) {
      afternoonWatchTime += seconds;
    } else if (hour >= 18 && hour < 22) {
      eveningWatchTime += seconds;
    } else {
      nightWatchTime += seconds;
    }
  });

  // Content decades
  const decadeCounts: Record<string, { count: number; time: number }> = {};
  history.forEach(h => {
    if (h.year) {
      const decade = `${Math.floor(h.year / 10) * 10}s`;
      if (!decadeCounts[decade]) {
        decadeCounts[decade] = { count: 0, time: 0 };
      }
      decadeCounts[decade].count++;
      decadeCounts[decade].time += getSessionSeconds(h);
    }
  });
  const contentDecades = Object.entries(decadeCounts)
    .sort((a, b) => b[1].time - a[1].time)
    .slice(0, 5)
    .map(([decade, data]) => ({ decade, count: data.count, watchTime: data.time }));

  // Most rewatched
  const titlePlayCounts: Record<string, number> = {};
  history.forEach(h => {
    const title = h.grandparent_title || h.full_title || h.title;
    titlePlayCounts[title] = (titlePlayCounts[title] || 0) + 1;
  });
  const mostRewatchedEntry = Object.entries(titlePlayCounts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])[0];
  const mostRewatched = mostRewatchedEntry 
    ? { title: mostRewatchedEntry[0], rewatchCount: mostRewatchedEntry[1] }
    : null;

  // Top movies by users
  const movieUserCounts: Record<string, { users: Set<number>; time: number }> = {};
  movies.forEach(m => {
    const title = m.full_title || m.title;
    if (!movieUserCounts[title]) {
      movieUserCounts[title] = { users: new Set(), time: 0 };
    }
    movieUserCounts[title].users.add(m.user_id);
    movieUserCounts[title].time += getSessionSeconds(m);
  });
  const topMoviesByUsers = Object.entries(movieUserCounts)
    .filter(([, data]) => data.users.size > 1)
    .sort((a, b) => b[1].users.size - a[1].users.size)
    .slice(0, 5)
    .map(([title, data]) => ({ title, userCount: data.users.size, totalTime: data.time }));

  // Top shows by users
  const showUserCounts: Record<string, { users: Set<number>; time: number }> = {};
  episodes.forEach(e => {
    const title = e.grandparent_title || e.title;
    if (!showUserCounts[title]) {
      showUserCounts[title] = { users: new Set(), time: 0 };
    }
    showUserCounts[title].users.add(e.user_id);
    showUserCounts[title].time += getSessionSeconds(e);
  });
  const topShowsByUsers = Object.entries(showUserCounts)
    .filter(([, data]) => data.users.size > 1)
    .sort((a, b) => b[1].users.size - a[1].users.size)
    .slice(0, 5)
    .map(([title, data]) => ({ title, userCount: data.users.size, totalTime: data.time }));

  // Peak concurrent streams
  let peakConcurrentStreams: { count: number; date: string; time: string } | null = null;

  const getConcurrencyWindow = (h: WatchHistory) => {
    const started = normalizeEpochSeconds(h.started);
    const stopped = normalizeEpochSeconds(h.stopped);
    const duration = normalizeDurationSeconds(h.duration);

    const start =
      started > 0
        ? started
        : stopped > 0 && duration > 0
          ? Math.max(1, stopped - duration)
          : normalizeEpochSeconds(h.date);

    const rawEnd = stopped > start ? stopped : start + duration;
    const end = rawEnd > start ? rawEnd : 0;

    return start > 0 && end > start ? { start, end } : null;
  };

  const sessionsForConcurrency = history
    .map(getConcurrencyWindow)
    .filter((s): s is { start: number; end: number } => Boolean(s));

  if (sessionsForConcurrency.length > 0) {
    const events: { time: number; delta: number }[] = [];
    sessionsForConcurrency.forEach((s) => {
      events.push({ time: s.start, delta: 1 });
      events.push({ time: s.end, delta: -1 });
    });

    events.sort((a, b) => a.time - b.time || b.delta - a.delta);

    let currentConcurrent = 0;
    let maxConcurrent = 0;
    let maxTime = 0;

    for (const event of events) {
      currentConcurrent += event.delta;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
        maxTime = event.time;
      }
    }

    if (maxConcurrent > 1) {
      const peakDate = new Date(maxTime * 1000);
      peakConcurrentStreams = {
        count: maxConcurrent,
        date: formatDate(peakDate, "MMMM do yyyy"),
        time: peakDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
    }
  }

  const topGenres: { genre: string; count: number; watchTime: number }[] = [];
  const topActors: { name: string; count: number; titleCount: number; watchTime: number }[] = [];
  const topDirectors: { name: string; count: number; titleCount: number; watchTime: number }[] = [];

  return {
    totalWatchTime,
    totalMovies: uniqueMovies.size,
    totalShows: uniqueShows.size,
    totalEpisodes: episodes.length,
    topMovie,
    topShow,
    topMovies,
    topShows,
    watchByDay,
    watchByHour,
    watchByMonth,
    watchByYear,
    longestBinge,
    lateNightSessions,
    weekendPercentage,
    mostActiveDay,
    uniqueTitles: uniqueTitles.size,
    avgDailyWatchTime,
    avgSessionLength,
    mostBingedDay,
    earlyBirdSessions,
    platforms,
    firstWatch,
    lastWatch,
    longestStreak,
    totalSessions: history.length,
    peakHour,
    morningWatchTime,
    afternoonWatchTime,
    eveningWatchTime,
    nightWatchTime,
    topGenres,
    topActors,
    topDirectors,
    contentDecades,
    mostRewatched,
    topMoviesByUsers,
    topShowsByUsers,
    peakConcurrentStreams,
  };
};

export const fetchMetadataStats = async (
  config: TautulliConfig,
  history: WatchHistory[]
): Promise<{
  topGenres: { genre: string; count: number; watchTime: number }[];
  topActors: { name: string; count: number; titleCount: number; watchTime: number }[];
  topDirectors: { name: string; count: number; titleCount: number; watchTime: number }[];
}> => {
  const movieAgg = new Map<number, { watchTime: number; users: Set<number> }>();
  const showAgg = new Map<number, { watchTime: number; users: Set<number> }>();

  const normalizeEpochSeconds = (value?: number) => {
    if (!value || !Number.isFinite(value)) return 0;
    return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  };

  const normalizeDurationSeconds = (value?: number) => {
    if (!value || !Number.isFinite(value)) return 0;
    if (value > 10_000_000) {
      return Math.round(value / 1000);
    }
    return value;
  };

  const addToAgg = (
    map: Map<number, { watchTime: number; users: Set<number> }>,
    key: number,
    userId: number,
    duration: number
  ) => {
    const existing = map.get(key);
    if (existing) {
      existing.watchTime += duration;
      existing.users.add(userId);
    } else {
      map.set(key, { watchTime: duration, users: new Set([userId]) });
    }
  };

  history.forEach((h) => {
    const playDuration = normalizeDurationSeconds(h.play_duration);
    let duration = playDuration;
    
    if (!duration || duration <= 0) {
      const started = normalizeEpochSeconds(h.started);
      const stopped = normalizeEpochSeconds(h.stopped);
      const diff = started > 0 && stopped > started ? stopped - started : 0;
      duration = diff > 0 ? diff : normalizeDurationSeconds(h.duration);
    }

    const userId = Number.isFinite(Number(h.user_id)) ? Number(h.user_id) : 0;

    if (h.media_type === "movie" && h.rating_key) {
      addToAgg(movieAgg, h.rating_key, userId, duration);
    } else if (h.media_type === "episode" && h.grandparent_rating_key) {
      addToAgg(showAgg, h.grandparent_rating_key, userId, duration);
    }
  });

  const genreCounts: Record<string, { titles: Set<number>; watchTime: number }> = {};
  const actorCounts: Record<
    string,
    { score: number; users: Set<number>; titles: Set<number>; watchTime: number }
  > = {};
  const directorCounts: Record<
    string,
    { score: number; users: Set<number>; titles: Set<number>; watchTime: number }
  > = {};

  const movieEntries = [...movieAgg.entries()]
    .sort((a, b) => b[1].watchTime - a[1].watchTime)
    .slice(0, 120);
  const showEntries = [...showAgg.entries()]
    .sort((a, b) => b[1].watchTime - a[1].watchTime)
    .slice(0, 80);

  const fetchPromises: Promise<void>[] = [];

  const applyCredits = (ratingKey: number, watchTime: number, users: Set<number>, meta: any) => {
    meta.genres?.forEach((genre: string) => {
      if (!genreCounts[genre]) genreCounts[genre] = { titles: new Set(), watchTime: 0 };
      genreCounts[genre].titles.add(ratingKey);
      genreCounts[genre].watchTime += watchTime;
    });

    meta.actors?.forEach((actor: string) => {
      if (!actorCounts[actor]) {
        actorCounts[actor] = { score: 0, users: new Set(), titles: new Set(), watchTime: 0 };
      }
      actorCounts[actor].score += users.size;
      users.forEach((u) => actorCounts[actor].users.add(u));
      actorCounts[actor].titles.add(ratingKey);
      actorCounts[actor].watchTime += watchTime;
    });

    meta.directors?.forEach((director: string) => {
      if (!directorCounts[director]) {
        directorCounts[director] = { score: 0, users: new Set(), titles: new Set(), watchTime: 0 };
      }
      directorCounts[director].score += users.size;
      users.forEach((u) => directorCounts[director].users.add(u));
      directorCounts[director].titles.add(ratingKey);
      directorCounts[director].watchTime += watchTime;
    });
  };

  for (const [ratingKey, data] of movieEntries) {
    fetchPromises.push(
      getMetadata(config, ratingKey).then((meta) => {
        if (!meta) return;
        applyCredits(ratingKey, data.watchTime, data.users, meta);
      })
    );
  }

  for (const [ratingKey, data] of showEntries) {
    fetchPromises.push(
      getMetadata(config, ratingKey).then((meta) => {
        if (!meta) return;
        applyCredits(ratingKey, data.watchTime, data.users, meta);
      })
    );
  }

  await Promise.all(fetchPromises);

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1].watchTime - a[1].watchTime)
    .slice(0, 8)
    .map(([genre, data]) => ({ genre, count: data.titles.size, watchTime: data.watchTime }));

  const topActors = Object.entries(actorCounts)
    .sort(
      (a, b) =>
        b[1].score - a[1].score ||
        b[1].users.size - a[1].users.size ||
        b[1].watchTime - a[1].watchTime
    )
    .slice(0, 8)
    .map(([name, data]) => ({
      name,
      count: data.users.size,
      titleCount: data.titles.size,
      watchTime: data.watchTime,
    }));

  const topDirectors = Object.entries(directorCounts)
    .sort(
      (a, b) =>
        b[1].score - a[1].score ||
        b[1].users.size - a[1].users.size ||
        b[1].watchTime - a[1].watchTime
    )
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      count: data.users.size,
      titleCount: data.titles.size,
      watchTime: data.watchTime,
    }));
    
  return { topGenres, topActors, topDirectors };
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
};

export const formatHours = (seconds: number): number => {
  return Math.round((seconds / 3600) * 10) / 10;
};