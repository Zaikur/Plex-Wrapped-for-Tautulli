// src/lib/personality.ts
// Streaming personalities: the viewing habit that stands out most. The server picks one per
// report (see server/report.ts); the views only look up labels and taglines here.

import {
  dayNumber,
  getEventSeconds,
  getSessionSeconds,
  isVideoContent,
  longestStreakOf,
  zonedParts,
  type ZonedParts,
} from "@/lib/stats";
import { formatDuration } from "@/lib/tautulli";
import type { PersonalityId, StreamingPersonality, WatchHistory } from "@/types/tautulli";

export type PersonalityColor = "purple" | "yellow" | "orange" | "cyan" | "pink" | "green";

interface ViewerMetrics {
  watchTime: number;
  /** Shares of watch time by the hour a session started */
  nightShare: number; // 10pm-5am
  morningShare: number; // 5am-noon
  afternoonShare: number; // noon-6pm
  eveningShare: number; // 6pm-10pm
  /** Share of sessions on a Saturday or Sunday */
  weekendShare: number;
  /** Watch time per day with any watching */
  avgDailyWatch: number;
  movieShare: number;
  episodePlays: number;
  /** Share of episode sessions on a day with 3+ different episodes of the same show */
  bingeShare: number;
  /** Shares of the watch time on titles with a release year (null: none have one) */
  retroShare: number | null;
  freshShare: number | null;
  /** The show or movie with the most watch time */
  topTitle: { title: string; share: number } | null;
  /** Different shows and movies */
  titleCount: number;
  /** Episodes and movies started, and the share of them finished */
  startedCount: number;
  finishedShare: number;
  /** Finishes (one per item per day) and the share of them that repeat an earlier one */
  finishCount: number;
  rewatchShare: number;
  longestStreak: number;
  platformCount: number;
}

interface Rule {
  /** Qualifies at this value; the score grows until `extreme` */
  threshold: number;
  extreme: number;
  /** Highest score (default 1): below 1 for habits most viewers share, so they rarely win */
  maxScore?: number;
  /** null: not enough data to tell */
  value: (m: ViewerMetrics) => number | null;
}

interface PersonalityDef {
  label: string;
  plural: string;
  color: PersonalityColor;
  emoji: string;
  /** Balanced Viewer has none: it is what's left when no rule qualifies */
  rule?: Rule;
  /** Tagline for one viewer, from the stat that earned it */
  describe: (value: number, title?: string) => string;
  /** The Everyone tagline after "7 of your 15 viewers" (`one`: a single viewer) */
  describeGroup: (threshold: number, one: boolean) => string;
}

const HOUR = 3600;
const MIN_BINGE_EPISODES = 20;
const MIN_FINISHES_FOR_REWATCH = 20;
const MIN_STARTED_FOR_COMPLETIONIST = 30;
const MIN_STARTED_FOR_CHANNEL_SURFER = 20;
const MIN_SUPERFAN_WATCH_TIME = 5 * HOUR;
const EXPLORER_MAX_TOP_SHARE = 0.1;
/** Everyone report: viewers with less watch time don't count (unless nobody has more) */
const MIN_GROUP_VIEWER_WATCH_TIME = 5 * HOUR;

const pct = (share: number) => `${Math.round(share * 100)}%`;
const verb = (one: boolean, singular: string, plural: string) => (one ? singular : plural);

// Ties go to the earlier entry
export const PERSONALITIES: Record<PersonalityId, PersonalityDef> = {
  nightOwl: {
    label: "Night Owl",
    plural: "Night Owls",
    color: "purple",
    emoji: "🦉",
    rule: { threshold: 0.35, extreme: 0.75, value: (m) => m.nightShare },
    describe: (v) => `${pct(v)} of your watch time was between 10pm and 5am`,
    describeGroup: (t, one) => `${verb(one, "does", "do")} ${pct(t)}+ of their watching between 10pm and 5am`,
  },
  earlyBird: {
    label: "Early Bird",
    plural: "Early Birds",
    color: "yellow",
    emoji: "🐦",
    rule: { threshold: 0.35, extreme: 0.75, value: (m) => m.morningShare },
    describe: (v) => `${pct(v)} of your watch time was between 5am and noon`,
    describeGroup: (t, one) => `${verb(one, "does", "do")} ${pct(t)}+ of their watching between 5am and noon`,
  },
  matineeFan: {
    label: "Matinee Fan",
    plural: "Matinee Fans",
    color: "green",
    emoji: "🎟️",
    rule: { threshold: 0.4, extreme: 0.8, value: (m) => m.afternoonShare },
    describe: (v) => `${pct(v)} of your watch time was between noon and 6pm`,
    describeGroup: (t, one) => `${verb(one, "does", "do")} ${pct(t)}+ of their watching between noon and 6pm`,
  },
  primeTimeViewer: {
    label: "Prime Time Viewer",
    plural: "Prime Time Viewers",
    color: "orange",
    emoji: "📺",
    rule: { threshold: 0.45, extreme: 0.85, value: (m) => m.eveningShare },
    describe: (v) => `${pct(v)} of your watch time was between 6pm and 10pm`,
    describeGroup: (t, one) => `${verb(one, "does", "do")} ${pct(t)}+ of their watching between 6pm and 10pm`,
  },
  weekendWarrior: {
    label: "Weekend Warrior",
    plural: "Weekend Warriors",
    color: "orange",
    emoji: "⚔️",
    rule: { threshold: 0.6, extreme: 0.9, value: (m) => m.weekendShare },
    describe: (v) => `${pct(v)} of your sessions were on a Saturday or Sunday`,
    describeGroup: (t, one) => `${verb(one, "has", "have")} ${pct(t)}+ of their sessions on weekends`,
  },
  marathonRunner: {
    label: "Marathon Runner",
    plural: "Marathon Runners",
    color: "orange",
    emoji: "🏃",
    rule: { threshold: 4 * HOUR, extreme: 8 * HOUR, value: (m) => m.avgDailyWatch },
    describe: (v) => `You averaged ${formatDuration(v)} of watching on the days you streamed`,
    describeGroup: (t, one) => `${verb(one, "averages", "average")} ${t / HOUR}+ hours on the days they stream`,
  },
  bingeMaster: {
    label: "Binge Master",
    plural: "Binge Masters",
    color: "pink",
    emoji: "🍿",
    rule: {
      threshold: 0.5,
      extreme: 0.9,
      value: (m) => (m.episodePlays >= MIN_BINGE_EPISODES ? m.bingeShare : null),
    },
    describe: (v) => `${pct(v)} of your episodes were binged: 3+ of the same show in one day`,
    describeGroup: (t, one) => `${verb(one, "binges", "binge")} ${pct(t)}+ of their episodes, 3+ of the same show in one day`,
  },
  movieBuff: {
    label: "Movie Buff",
    plural: "Movie Buffs",
    color: "cyan",
    emoji: "🎬",
    rule: { threshold: 0.6, extreme: 0.95, value: (m) => m.movieShare },
    describe: (v) => `${pct(v)} of your watch time was movies`,
    describeGroup: (t, one) => `${verb(one, "spends", "spend")} ${pct(t)}+ of their watch time on movies`,
  },
  retroLover: {
    label: "Retro Lover",
    plural: "Retro Lovers",
    color: "yellow",
    emoji: "📼",
    rule: { threshold: 0.5, extreme: 0.9, value: (m) => m.retroShare },
    describe: (v) => `${pct(v)} of your watch time was on titles from before 2000`,
    describeGroup: (t, one) => `${verb(one, "spends", "spend")} ${pct(t)}+ of their watch time on titles from before 2000`,
  },
  trendChaser: {
    label: "Trend Chaser",
    plural: "Trend Chasers",
    color: "green",
    emoji: "🆕",
    rule: { threshold: 0.5, extreme: 0.9, value: (m) => m.freshShare },
    describe: (v) => `${pct(v)} of your watch time was on titles released that year or the year before`,
    describeGroup: (t, one) =>
      `${verb(one, "spends", "spend")} ${pct(t)}+ of their watch time on titles released that year or the year before`,
  },
  superfan: {
    label: "Superfan",
    plural: "Superfans",
    color: "pink",
    emoji: "⭐",
    rule: {
      threshold: 0.4,
      extreme: 0.8,
      value: (m) => (m.watchTime >= MIN_SUPERFAN_WATCH_TIME && m.topTitle ? m.topTitle.share : null),
    },
    describe: (v, title) => `${title || "One favorite"} took up ${pct(v)} of your watch time`,
    describeGroup: (t, one) => `${verb(one, "spends", "spend")} ${pct(t)}+ of their watch time on one favorite`,
  },
  contentExplorer: {
    label: "Content Explorer",
    plural: "Content Explorers",
    color: "cyan",
    emoji: "🧭",
    rule: {
      threshold: 30,
      extreme: 150,
      value: (m) => (m.topTitle && m.topTitle.share <= EXPLORER_MAX_TOP_SHARE ? m.titleCount : null),
    },
    describe: (v) => `You watched ${v} different shows and movies, none taking over ${pct(EXPLORER_MAX_TOP_SHARE)} of your time`,
    describeGroup: (t, one) => `${verb(one, "spreads", "spread")} their time over ${t}+ shows and movies`,
  },
  comfortWatcher: {
    label: "Comfort Watcher",
    plural: "Comfort Watchers",
    color: "pink",
    emoji: "🛋️",
    rule: {
      threshold: 0.2,
      extreme: 0.6,
      value: (m) => (m.finishCount >= MIN_FINISHES_FOR_REWATCH ? m.rewatchShare : null),
    },
    describe: (v) => `${pct(v)} of what you finished was a rewatch`,
    describeGroup: (t, one) => `${verb(one, "rewatches", "rewatch")} a lot: ${pct(t)}+ of what they finish is a repeat`,
  },
  completionist: {
    label: "Completionist",
    plural: "Completionists",
    color: "green",
    emoji: "✅",
    rule: {
      threshold: 0.98,
      extreme: 1,
      maxScore: 0.5,
      value: (m) => (m.startedCount >= MIN_STARTED_FOR_COMPLETIONIST ? m.finishedShare : null),
    },
    describe: (v) => `You finished ${pct(v)} of the episodes and movies you started`,
    describeGroup: (t, one) => `${verb(one, "finishes", "finish")} ${pct(t)}+ of what they start`,
  },
  channelSurfer: {
    label: "Channel Surfer",
    plural: "Channel Surfers",
    color: "yellow",
    emoji: "🏄",
    rule: {
      threshold: 0.3,
      extreme: 0.6,
      value: (m) => (m.startedCount >= MIN_STARTED_FOR_CHANNEL_SURFER ? 1 - m.finishedShare : null),
    },
    describe: (v) => `You stopped partway through ${pct(v)} of the episodes and movies you started`,
    describeGroup: (t, one) => `${verb(one, "stops", "stop")} partway through ${pct(t)}+ of what they start`,
  },
  creatureOfHabit: {
    label: "Creature of Habit",
    plural: "Creatures of Habit",
    color: "purple",
    emoji: "📅",
    rule: { threshold: 21, extreme: 120, value: (m) => m.longestStreak },
    describe: (v) => `You streamed ${v} days in a row`,
    describeGroup: (t) => `streamed ${t}+ days in a row`,
  },
  platformHopper: {
    label: "Platform Hopper",
    plural: "Platform Hoppers",
    color: "cyan",
    emoji: "📱",
    rule: { threshold: 4, extreme: 8, value: (m) => m.platformCount },
    describe: (v) => `You streamed from ${v} different platforms`,
    describeGroup: (t, one) => `${verb(one, "uses", "use")} ${t}+ different platforms`,
  },
  balancedViewer: {
    label: "Balanced Viewer",
    plural: "Balanced Viewers",
    color: "cyan",
    emoji: "⚖️",
    describe: () => "No single habit stood out: you mix it all up",
    describeGroup: (_t, one) => `${verb(one, "has", "have")} no single habit that stands out`,
  },
};

const PERSONALITY_ORDER = Object.keys(PERSONALITIES) as PersonalityId[];

// ============ Display ============

/** Unknown or missing personalities (e.g. older cached reports) show as Balanced Viewer */
export const personalityDef = (p: StreamingPersonality | null | undefined): PersonalityDef =>
  (p && PERSONALITIES[p.id]) || PERSONALITIES.balancedViewer;

/** The Everyone report's personality: the one most of its viewers share */
export const isGroupPersonality = (p: StreamingPersonality | null | undefined) =>
  p?.viewers != null && p.totalViewers != null;

export const personalityLabel = (p: StreamingPersonality | null | undefined) => {
  const def = personalityDef(p);
  return isGroupPersonality(p) ? def.plural : def.label;
};

export const describePersonality = (p: StreamingPersonality | null | undefined): string => {
  const def = personalityDef(p);
  if (p && isGroupPersonality(p)) {
    const k = p.viewers!;
    const n = p.totalViewers!;
    const who = k < n ? `${k} of your ${n} viewers` : n === 2 ? "Both of your viewers" : `All ${n} of your viewers`;
    return `${who} ${def.describeGroup(def.rule?.threshold ?? 0, k === 1)}`;
  }
  return def.describe(p?.value ?? 0, p?.title);
};

// ============ Calculation ============

const viewerMetrics = (rows: WatchHistory[], partsOf: (h: WatchHistory) => ZonedParts): ViewerMetrics | null => {
  let plays = 0;
  let watchTime = 0;
  let night = 0;
  let morning = 0;
  let afternoon = 0;
  let evening = 0;
  let weekendPlays = 0;
  let movieTime = 0;
  let datedTime = 0;
  let retroTime = 0;
  let freshTime = 0;
  let episodePlays = 0;
  const days: number[] = [];
  const titles = new Map<string, { title: string; time: number }>();
  // Days each episode or movie was finished: a viewing finished over several sittings on
  // one day only counts once
  const finishDays = new Map<number, Set<number>>();
  // Episodes of each show per day, for binges
  const showDays = new Map<string, { episodes: Set<number>; plays: number }>();
  const platforms = new Set<string>();

  for (const h of rows) {
    if (!isVideoContent(h.media_type)) continue;
    const seconds = getSessionSeconds(h);
    const p = partsOf(h);
    const day = dayNumber(p);
    plays++;
    watchTime += seconds;
    days.push(day);

    if (p.hour >= 5 && p.hour < 12) morning += seconds;
    else if (p.hour >= 12 && p.hour < 18) afternoon += seconds;
    else if (p.hour >= 18 && p.hour < 22) evening += seconds;
    else night += seconds;
    if (p.weekday === 0 || p.weekday === 6) weekendPlays++;

    if (h.year > 0) {
      datedTime += seconds;
      if (h.year < 2000) retroTime += seconds;
      if (h.year >= p.year - 1) freshTime += seconds;
    }

    const isMovie = h.media_type === "movie";
    if (isMovie) {
      movieTime += seconds;
    } else {
      episodePlays++;
      const key = `${day}:${h.grandparent_rating_key}`;
      let run = showDays.get(key);
      if (!run) {
        run = { episodes: new Set(), plays: 0 };
        showDays.set(key, run);
      }
      run.episodes.add(h.rating_key);
      run.plays++;
    }

    const titleKey = isMovie ? `m${h.rating_key}` : `s${h.grandparent_rating_key}`;
    let title = titles.get(titleKey);
    if (!title) {
      title = { title: (isMovie ? h.full_title : h.grandparent_title) || h.title, time: 0 };
      titles.set(titleKey, title);
    }
    title.time += seconds;

    let finished = finishDays.get(h.rating_key);
    if (!finished) {
      finished = new Set();
      finishDays.set(h.rating_key, finished);
    }
    if (h.watched_status >= 1) finished.add(day);

    if (h.platform) platforms.add(h.platform);
  }

  if (plays === 0) return null;

  const share = (seconds: number) => (watchTime > 0 ? seconds / watchTime : 0);

  let bingedPlays = 0;
  for (const run of showDays.values()) {
    if (run.episodes.size >= 3) bingedPlays += run.plays;
  }

  let top: { title: string; time: number } | null = null;
  for (const title of titles.values()) {
    if (!top || title.time > top.time) top = title;
  }

  let finishedItems = 0;
  let finishCount = 0;
  for (const finished of finishDays.values()) {
    if (finished.size > 0) finishedItems++;
    finishCount += finished.size;
  }

  return {
    watchTime,
    nightShare: share(night),
    morningShare: share(morning),
    afternoonShare: share(afternoon),
    eveningShare: share(evening),
    weekendShare: weekendPlays / plays,
    avgDailyWatch: watchTime / new Set(days).size,
    movieShare: share(movieTime),
    episodePlays,
    bingeShare: episodePlays > 0 ? bingedPlays / episodePlays : 0,
    retroShare: datedTime > 0 ? retroTime / datedTime : null,
    freshShare: datedTime > 0 ? freshTime / datedTime : null,
    topTitle: top ? { title: top.title, share: share(top.time) } : null,
    titleCount: titles.size,
    startedCount: finishDays.size,
    finishedShare: finishDays.size > 0 ? finishedItems / finishDays.size : 0,
    finishCount,
    rewatchShare: finishCount > 0 ? (finishCount - finishedItems) / finishCount : 0,
    longestStreak: longestStreakOf(days),
    platformCount: platforms.size,
  };
};

/** The rule a viewer passes by the widest margin (relative to how far its scale goes) */
const pickPersonality = (m: ViewerMetrics): StreamingPersonality => {
  let best: { id: PersonalityId; value: number; score: number } | null = null;
  for (const id of PERSONALITY_ORDER) {
    const rule = PERSONALITIES[id].rule;
    if (!rule) continue;
    const value = rule.value(m);
    if (value === null || !(value >= rule.threshold)) continue;
    const score = (rule.maxScore ?? 1) * Math.min(1, (value - rule.threshold) / (rule.extreme - rule.threshold));
    if (!best || score > best.score) best = { id, value, score };
  }
  if (!best) return { id: "balancedViewer" };
  if (best.id === "superfan" && m.topTitle) return { id: best.id, value: best.value, title: m.topTitle.title };
  return { id: best.id, value: best.value };
};

/**
 * One viewer's personality, or for the Everyone report (`group`) the personality most of its
 * viewers have. Balanced Viewer only wins that vote when nobody has anything else.
 */
export const calculatePersonality = (history: WatchHistory[], tz: string, group: boolean): StreamingPersonality | null => {
  const partsCache = new Map<number, ZonedParts>();
  const partsOf = (h: WatchHistory) => {
    const t = getEventSeconds(h);
    let p = partsCache.get(t);
    if (!p) {
      p = zonedParts(t, tz);
      partsCache.set(t, p);
    }
    return p;
  };

  if (!group) {
    const metrics = viewerMetrics(history, partsOf);
    return metrics ? pickPersonality(metrics) : null;
  }

  const byViewer = new Map<number, WatchHistory[]>();
  for (const h of history) {
    if (!isVideoContent(h.media_type)) continue;
    let rows = byViewer.get(h.user_id);
    if (!rows) {
      rows = [];
      byViewer.set(h.user_id, rows);
    }
    rows.push(h);
  }

  let viewers = [...byViewer.values()]
    .map((rows) => viewerMetrics(rows, partsOf))
    .filter((m): m is ViewerMetrics => m !== null);
  const regulars = viewers.filter((m) => m.watchTime >= MIN_GROUP_VIEWER_WATCH_TIME);
  if (regulars.length > 0) viewers = regulars;
  if (viewers.length === 0) return null;
  if (viewers.length === 1) return pickPersonality(viewers[0]);

  const tally = new Map<PersonalityId, { viewers: number; watchTime: number }>();
  for (const m of viewers) {
    const { id } = pickPersonality(m);
    const entry = tally.get(id) ?? { viewers: 0, watchTime: 0 };
    entry.viewers++;
    entry.watchTime += m.watchTime;
    tally.set(id, entry);
  }
  const isBalanced = (id: PersonalityId) => (id === "balancedViewer" ? 1 : 0);
  const [id, entry] = [...tally.entries()].sort(
    ([idA, a], [idB, b]) => isBalanced(idA) - isBalanced(idB) || b.viewers - a.viewers || b.watchTime - a.watchTime
  )[0];
  return { id, viewers: entry.viewers, totalViewers: viewers.length };
};
