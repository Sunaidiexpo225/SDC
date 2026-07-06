// Deterministic analytics model — ported from the design's renderVals().
// Pure functions over real backend data (event follower counts): the numbers
// are modelled from audience size so they scale when real data is plugged in.

import type { AccountDTO, RangeKey } from "./types";
import type { Translation } from "./i18n";
import type { SuffixKey } from "./content";

const bars7base = [
  [48, 61, 55, 82, 100, 74, 66],
  [52, 70, 63, 58, 90, 100, 80],
  [40, 55, 72, 66, 88, 100, 61],
  [60, 52, 74, 68, 100, 84, 70],
  [45, 63, 58, 100, 77, 69, 54],
];
const bars30base = [
  [58, 71, 64, 100],
  [62, 80, 73, 100],
  [55, 68, 90, 100],
  [70, 64, 88, 100],
  [60, 84, 72, 100],
];

interface RangeMeta {
  vm: number;
  em: number;
  fm: number;
  p: (dI: number) => number;
  dv: (dI: number) => number;
  de: (dI: number) => number;
  df: (dI: number) => number;
  subKey: keyof Translation;
  deltaKey: keyof Translation;
  bars: (dI: number) => number[];
}

const RANGES: Record<RangeKey, RangeMeta> = {
  "1d": {
    vm: 0.24, em: 0.014, fm: 0.003,
    p: () => 2, dv: (d) => 9 + d, de: (d) => 6 + d, df: () => 4,
    subKey: "today2", deltaKey: "dWeek",
    bars: () => [30, 45, 40, 55, 48, 70, 100],
  },
  "7d": {
    vm: 1.6, em: 0.092, fm: 0.02,
    p: (d) => 8 + d * 2, dv: (d) => 14 + d * 2, de: (d) => 8 + d, df: (d) => 5 + d,
    subKey: "thisWeek", deltaKey: "dWeek",
    bars: (d) => bars7base[d % 5],
  },
  "30d": {
    vm: 6.1, em: 0.35, fm: 0.075,
    p: (d) => 34 + d * 5, dv: (d) => 20 + d * 2, de: (d) => 13 + d, df: (d) => 9 + d,
    subKey: "thisMonth", deltaKey: "dMonth",
    bars: (d) => bars30base[d % 5],
  },
  "90d": {
    vm: 17, em: 1.0, fm: 0.2,
    p: (d) => 96 + d * 8, dv: (d) => 26 + d, de: (d) => 18 + d, df: (d) => 14 + d,
    subKey: "thisQuarter", deltaKey: "dQuarter",
    bars: () => [50, 62, 58, 74, 88, 100],
  },
  "365d": {
    vm: 64, em: 3.6, fm: 0.78,
    p: (d) => 340 + d * 20, dv: (d) => 38 + d, de: (d) => 27 + d, df: (d) => 21 + d,
    subKey: "thisYear", deltaKey: "dYear",
    bars: () => [40, 48, 52, 60, 58, 66, 72, 70, 80, 86, 92, 100],
  },
};

export const TOP_SEED: [SuffixKey, string, number][] = [
  ["highlights", "instagram", 1.0],
  ["teaser", "tiktok", 0.82],
  ["tickets", "instagram", 0.7],
  ["speaker", "linkedin", 0.55],
  ["bts", "tiktok", 0.44],
];

export interface AnalyticsModel {
  range: RangeKey;
  // "estimated" = modelled from follower count; "live" = real Instagram data.
  source: "estimated" | "live";
  stat: { v: number; e: number; f: number; p: number; dv: number; de: number; df: number };
  subKey: keyof Translation;
  deltaKey: keyof Translation;
  bars: number[];
  accountPerf: {
    platform: string;
    handle: string;
    followers: number;
    viewsN: number;
    engN: number;
    growth: string;
  }[];
  platSplit: { platform: string; pct: number }[];
  topPosts: {
    rank: number;
    suffixKey: SuffixKey;
    platformKey: string;
    viewsN: number;
    rate: string;
    // Present only for live posts — the real caption + link + per-post metrics.
    title?: string;
    permalink?: string;
    likes?: number;
    comments?: number;
    saves?: number | null;
    shares?: number | null;
    mediaType?: string;
  }[];
  fmtSplit: { typeKey: "typeReel" | "typeVideo" | "typeImage"; pct: number; color: string }[];
  bestTimeRaw: string;
  engRateOverall: string;
  // Live-only extras.
  saves?: number;
  shares?: number;
  newFollowers?: number; // followers gained in the window (not total)
  followerGrowth?: { date: string; value: number }[];
  audience?: IgAudience | null;
  hasPrior?: boolean; // was there a previous period to compare against?
}

export function computeAnalytics(
  accounts: Pick<AccountDTO, "platform" | "handle" | "followers">[],
  barIx: number,
  range: RangeKey,
): AnalyticsModel {
  const dI = barIx;
  const rk: RangeKey = RANGES[range] ? range : "7d";
  const m = RANGES[rk];
  const evF = accounts.reduce((s, a) => s + a.followers, 0);
  const totF = evF;
  const stat = {
    v: evF * m.vm,
    e: evF * m.em,
    f: evF * m.fm,
    p: m.p(dI),
    dv: m.dv(dI),
    de: m.de(dI),
    df: m.df(dI),
  };

  const accountPerf = accounts.map((s, i) => {
    const share = totF > 0 ? s.followers / totF : 1 / Math.max(1, accounts.length);
    return {
      platform: s.platform,
      handle: s.handle,
      followers: s.followers,
      viewsN: Math.round(stat.v * share),
      engN: Math.round(stat.e * share),
      growth: "+" + (4 + ((i * 3 + dI) % 12)) + "%",
    };
  });

  const platSplit = accounts.map((s) => ({
    platform: s.platform,
    pct: totF > 0 ? Math.round((s.followers / totF) * 100) : 0,
  }));

  const topPosts = TOP_SEED.map(([suffixKey, pk, factor], i) => {
    const has = accounts.some((s) => s.platform === pk);
    const platformKey = has ? pk : accounts[0]?.platform || "instagram";
    return {
      rank: i + 1,
      suffixKey,
      platformKey,
      viewsN: Math.round(stat.v * factor * 0.35),
      rate: (9 - i * 0.9).toFixed(1) + "%",
    };
  });

  const fmtSplit = (
    [
      ["typeReel", 52, "#e0457b"],
      ["typeVideo", 33, "#2563eb"],
      ["typeImage", 15, "#f59e0b"],
    ] as const
  ).map(([typeKey, pct, color], i) => ({
    typeKey,
    pct: Math.max(5, pct + (i === 0 ? dI : -dI)),
    color,
  }));

  const bestTimeRaw = ["18:00", "20:00", "21:00", "12:00", "19:30"][dI % 5];
  const engRateOverall = ((stat.e / (stat.v || 1)) * 100).toFixed(1) + "%";

  return {
    range: rk,
    source: "estimated",
    stat,
    subKey: m.subKey,
    deltaKey: m.deltaKey,
    bars: m.bars(dI),
    accountPerf,
    platSplit,
    topPosts,
    fmtSplit,
    bestTimeRaw,
    engRateOverall,
  };
}

// ── Live analytics from real Instagram data ────────────────────────────────

import type { IgMedia, IgAudience } from "./publishers/instagramInsights";

export interface LiveAccount {
  platform: string;
  handle: string;
  followers: number;
  media: IgMedia[];
  followerGrowth?: { date: string; value: number }[];
  audience?: IgAudience | null;
}

const RANGE_DAYS: Record<RangeKey, number> = {
  "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365,
};
const RANGE_BUCKETS: Record<RangeKey, number> = {
  "1d": 7, "7d": 7, "30d": 4, "90d": 6, "365d": 12,
};

const pctNum = (curr: number, prev: number): number => {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};
const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

// Build the AnalyticsModel from real Instagram data. `nowMs` is passed in so the
// function stays pure/deterministic (the caller supplies Date.now()).
export function computeLiveAnalytics(
  accounts: LiveAccount[],
  range: RangeKey,
  nowMs: number,
): AnalyticsModel {
  const rk: RangeKey = RANGES[range] ? range : "7d";
  const m = RANGES[rk];
  const windowMs = RANGE_DAYS[rk] * 86400000;
  const start = nowMs - windowMs;
  const prevStart = nowMs - 2 * windowMs;
  const tsOf = (md: IgMedia) => {
    const t = Date.parse(md.timestamp);
    return Number.isNaN(t) ? 0 : t;
  };

  const all = accounts.flatMap((a) =>
    a.media.map((md) => ({ md, platform: a.platform, followers: a.followers })),
  );
  const inWindow = (t: number) => t >= start && t <= nowMs;
  const inPrev = (t: number) => t >= prevStart && t < start;
  const curr = all.filter((x) => inWindow(tsOf(x.md)));
  const prev = all.filter((x) => inPrev(tsOf(x.md)));

  const reachOf = (x: { md: IgMedia }) => x.md.reach ?? 0;
  // Engagement counts every real interaction: likes + comments + saves + shares
  // (saves/shares are null without the insights permission → treated as 0).
  const engOf = (x: { md: IgMedia }) =>
    x.md.likes + x.md.comments + (x.md.saves ?? 0) + (x.md.shares ?? 0);
  const sum = (xs: typeof curr, f: (x: (typeof curr)[number]) => number) =>
    xs.reduce((s, x) => s + f(x), 0);

  const vCurr = sum(curr, reachOf), vPrev = sum(prev, reachOf);
  const eCurr = sum(curr, engOf), ePrev = sum(prev, engOf);
  const savesTotal = sum(curr, (x) => x.md.saves ?? 0);
  const sharesTotal = sum(curr, (x) => x.md.shares ?? 0);
  const followers = accounts.reduce((s, a) => s + a.followers, 0);

  const stat = {
    v: vCurr,
    e: eCurr,
    f: followers,
    p: curr.length,
    // In live mode dv/de carry percentage change vs the previous window.
    dv: pctNum(vCurr, vPrev),
    de: pctNum(eCurr, ePrev),
    df: 0,
  };

  // Time-series bars: split the window into equal slices, sum reach (or
  // engagement when reach is unavailable) per slice, normalise to 0–100.
  const nB = RANGE_BUCKETS[rk];
  const slice = windowMs / nB;
  const vals = new Array(nB).fill(0);
  for (const x of curr) {
    const idx = Math.min(nB - 1, Math.max(0, Math.floor((tsOf(x.md) - start) / slice)));
    vals[idx] += x.md.reach ?? engOf(x);
  }
  const maxBar = Math.max(1, ...vals);
  const bars = vals.map((v) => Math.round((v / maxBar) * 100));

  const accountPerf = accounts.map((a) => {
    const mine = a.media.filter((md) => inWindow(tsOf(md)));
    const minePrev = a.media.filter((md) => inPrev(tsOf(md)));
    const engC = mine.reduce((s, md) => s + md.likes + md.comments, 0);
    const engP = minePrev.reduce((s, md) => s + md.likes + md.comments, 0);
    return {
      platform: a.platform,
      handle: a.handle,
      followers: a.followers,
      viewsN: mine.reduce((s, md) => s + (md.reach ?? 0), 0),
      engN: engC,
      growth: (pctNum(engC, engP) >= 0 ? "+" : "") + pctNum(engC, engP) + "%",
    };
  });

  const totF = followers;
  const platSplit = accounts.map((a) => ({
    platform: a.platform,
    pct: totF > 0 ? Math.round((a.followers / totF) * 100) : Math.round(100 / Math.max(1, accounts.length)),
  }));

  const topPosts = [...curr]
    // Rank by reach (Views) so the list reads high→low in the Views column;
    // fall back to engagement when reach is unavailable (no insights permission).
    .sort((a, b) => (b.md.reach ?? 0) - (a.md.reach ?? 0) || engOf(b) - engOf(a))
    .slice(0, 5)
    .map((x, i) => {
      const eng = engOf(x);
      const denom = x.md.reach && x.md.reach > 0 ? x.md.reach : x.followers || 0;
      return {
        rank: i + 1,
        suffixKey: "highlights" as SuffixKey, // unused when title is present
        platformKey: x.platform,
        viewsN: x.md.reach ?? 0,
        rate: (denom > 0 ? (eng / denom) * 100 : 0).toFixed(1) + "%",
        title: x.md.caption ? truncate(x.md.caption, 60) : "(no caption)",
        permalink: x.md.permalink || undefined,
        likes: x.md.likes,
        comments: x.md.comments,
        saves: x.md.saves,
        shares: x.md.shares,
        mediaType: x.md.mediaType,
      };
    });

  let reel = 0, video = 0, image = 0;
  for (const x of curr) {
    if (x.md.mediaType === "REELS") reel++;
    else if (x.md.mediaType === "VIDEO") video++;
    else image++; // IMAGE + CAROUSEL_ALBUM
  }
  const totM = curr.length || 1;
  const fmtSplit = [
    { typeKey: "typeReel" as const, pct: Math.round((reel / totM) * 100), color: "#e0457b" },
    { typeKey: "typeVideo" as const, pct: Math.round((video / totM) * 100), color: "#2563eb" },
    { typeKey: "typeImage" as const, pct: Math.round((image / totM) * 100), color: "#f59e0b" },
  ];

  // Merge audience across accounts (sum per label; average the online curve).
  const audience = mergeAudience(accounts);

  // Best time: prefer the real "when followers are online" curve; otherwise
  // fall back to the hour that historically drew the most engagement.
  let bestH = 18;
  if (audience?.onlineByHour && audience.onlineByHour.some((v) => v > 0)) {
    let bestV = -1;
    audience.onlineByHour.forEach((v, h) => {
      if (v > bestV) { bestV = v; bestH = h; }
    });
  } else {
    const hourEng = new Array(24).fill(0);
    for (const x of curr) {
      const t = tsOf(x.md);
      if (t) hourEng[new Date(t).getHours()] += engOf(x);
    }
    let bestV = -1;
    hourEng.forEach((v, h) => {
      if (v > bestV) { bestV = v; bestH = h; }
    });
  }
  const bestTimeRaw = String(bestH).padStart(2, "0") + ":00";

  const denomOverall = vCurr > 0 ? vCurr : followers > 0 ? followers : 1;
  const engRateOverall = ((eCurr / denomOverall) * 100).toFixed(1) + "%";

  // Merge follower-growth series across accounts by date.
  const growthMap = new Map<string, number>();
  for (const a of accounts) {
    for (const g of a.followerGrowth || []) {
      if (g.date) growthMap.set(g.date, (growthMap.get(g.date) || 0) + g.value);
    }
  }
  const followerGrowth = [...growthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  // New followers gained within the window (Instagram's follower_count metric
  // covers ~the last 30 days, so longer ranges reflect that available window).
  const newFollowers = followerGrowth
    .filter((g) => {
      const t = Date.parse(g.date);
      return !Number.isNaN(t) && t >= start;
    })
    .reduce((s, g) => s + g.value, 0);

  return {
    range: rk,
    source: "live",
    stat,
    subKey: m.subKey,
    deltaKey: m.deltaKey,
    bars,
    accountPerf,
    platSplit,
    topPosts,
    fmtSplit,
    bestTimeRaw,
    engRateOverall,
    saves: savesTotal,
    shares: sharesTotal,
    newFollowers,
    followerGrowth,
    audience,
    hasPrior: prev.length > 0,
  };
}

// Combine several accounts' audience breakdowns into one (sum values per label,
// average the hourly online curve). Returns null if no account has audience.
function mergeAudience(accounts: LiveAccount[]): IgAudience | null {
  const withAud = accounts.map((a) => a.audience).filter(Boolean) as IgAudience[];
  if (!withAud.length) return null;
  const mergeDim = (pick: (a: IgAudience) => { label: string; value: number }[]) => {
    const map = new Map<string, number>();
    for (const a of withAud) for (const d of pick(a)) map.set(d.label, (map.get(d.label) || 0) + d.value);
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 6);
  };
  let onlineByHour: number[] | null = null;
  const curves = withAud.map((a) => a.onlineByHour).filter(Boolean) as number[][];
  if (curves.length) {
    onlineByHour = new Array(24).fill(0).map((_, h) => curves.reduce((s, c) => s + (c[h] || 0), 0));
  }
  return {
    countries: mergeDim((a) => a.countries),
    cities: mergeDim((a) => a.cities),
    gender: mergeDim((a) => a.gender),
    ages: mergeDim((a) => a.ages),
    onlineByHour,
  };
}

// Per-post metric grid — ported from `_metrics`.
export function postMetrics(v: number, seed: number) {
  const eng = Math.round(v * (0.05 + (seed % 4) * 0.007));
  return {
    views: v,
    reach: Math.round(v * 0.82),
    likes: Math.round(eng * 0.72),
    comments: Math.round(eng * 0.11),
    shares: Math.round(eng * 0.1),
    saves: Math.round(eng * 0.07),
    rate: ((eng / (v || 1)) * 100).toFixed(1) + "%",
    completion: 52 + ((seed * 7) % 36) + "%",
  };
}

export function barLabels(range: RangeKey, t: Translation): string[] {
  const rk: RangeKey = RANGES[range] ? range : "7d";
  switch (rk) {
    case "1d":
      return ["6a", "9a", "12p", "3p", "6p", "9p", "now"];
    case "7d":
      return [t.dows[1], t.dows[2], t.dows[3], t.dows[4], t.dows[5], t.dows[6], t.dows[0]];
    case "30d":
      return [1, 2, 3, 4].map((n) => t.weekLabel + " " + n);
    case "90d":
      return ["1", "2", "3", "4", "5", "6"];
    case "365d":
      return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  }
}
