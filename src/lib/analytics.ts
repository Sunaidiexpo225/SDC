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
  topPosts: { rank: number; suffixKey: SuffixKey; platformKey: string; viewsN: number; rate: string }[];
  fmtSplit: { typeKey: "typeReel" | "typeVideo" | "typeImage"; pct: number; color: string }[];
  bestTimeRaw: string;
  engRateOverall: string;
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
