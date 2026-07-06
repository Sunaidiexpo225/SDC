// Real Instagram data fetchers for the Analytics screen.
//
// What needs which permission:
//   • followers_count, media_count, and per-post like_count / comments_count /
//     media_type / timestamp / caption / permalink  → instagram_basic (already
//     granted). This alone powers real audience, engagement, format split,
//     best-time and top-posts.
//   • per-post reach ( → "views" )                   → instagram_manage_insights
//     (a separate App Review permission). Fetched best-effort; if it isn't
//     granted the calls just fail and reach stays null.
//
// Every function is best-effort: on any failure (bad token, network, timeout,
// missing permission, unexpected shape) it returns null / partial data rather
// than throwing, so the Analytics screen can fall back to estimates.

const GRAPH = process.env.IG_API_BASE || "https://graph.facebook.com/v21.0";

async function ig(
  path: string,
  params: Record<string, string>,
  timeoutMs = 9000,
): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || (data as { error?: unknown }).error) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface IgProfile {
  username: string | null;
  followersCount: number;
  mediaCount: number;
}

// Lightweight profile lookup — used on connect to set the real @handle and the
// real follower count. instagram_basic is enough.
export async function fetchInstagramProfile(
  igId: string,
  token: string,
): Promise<IgProfile | null> {
  if (!igId || !token) return null;
  const data = await ig(igId, {
    fields: "username,followers_count,media_count",
    access_token: token,
  });
  if (!data) return null;
  return {
    username: typeof data.username === "string" ? data.username : null,
    followersCount: typeof data.followers_count === "number" ? data.followers_count : 0,
    mediaCount: typeof data.media_count === "number" ? data.media_count : 0,
  };
}

export interface IgMedia {
  id: string;
  caption: string;
  mediaType: "REELS" | "VIDEO" | "IMAGE" | "CAROUSEL_ALBUM";
  timestamp: string; // ISO 8601 from Instagram
  permalink: string;
  likes: number;
  comments: number;
  reach: number | null; // needs instagram_manage_insights
  saves: number | null; // needs instagram_manage_insights
  shares: number | null; // needs instagram_manage_insights
}

export interface IgDemographic {
  label: string;
  value: number;
}

export interface IgAudience {
  countries: IgDemographic[];
  cities: IgDemographic[];
  gender: IgDemographic[];
  ages: IgDemographic[];
  onlineByHour: number[] | null; // 24 values, when followers are online
}

export interface IgAccountData {
  followersCount: number;
  mediaCount: number;
  media: IgMedia[];
  followerGrowth: { date: string; value: number }[]; // daily new-follower counts
  audience: IgAudience | null;
}

function normType(mediaType: unknown, productType: unknown): IgMedia["mediaType"] {
  if (productType === "REELS") return "REELS";
  if (mediaType === "VIDEO") return "VIDEO";
  if (mediaType === "CAROUSEL_ALBUM") return "CAROUSEL_ALBUM";
  return "IMAGE";
}

// Full account pull: profile + recent media (with real likes/comments) + a
// best-effort reach number per recent post. `mediaLimit` caps the media page;
// `insightsFor` caps how many recent posts we ask reach for (each is one API
// call, run in parallel).
export async function fetchInstagramAccountData(
  igId: string,
  token: string,
  mediaLimit = 50,
  insightsFor = 25,
): Promise<IgAccountData | null> {
  const profile = await ig(igId, {
    fields: "followers_count,media_count",
    access_token: token,
  });
  if (!profile) return null;

  const mediaResp = await ig(`${igId}/media`, {
    fields:
      "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count",
    limit: String(mediaLimit),
    access_token: token,
  });
  const items = Array.isArray((mediaResp as { data?: unknown })?.data)
    ? ((mediaResp as { data: Record<string, unknown>[] }).data)
    : [];

  const media: IgMedia[] = items.map((it) => ({
    id: String(it.id ?? ""),
    caption: typeof it.caption === "string" ? it.caption : "",
    mediaType: normType(it.media_type, it.media_product_type),
    timestamp: typeof it.timestamp === "string" ? it.timestamp : "",
    permalink: typeof it.permalink === "string" ? it.permalink : "",
    likes: typeof it.like_count === "number" ? it.like_count : 0,
    comments: typeof it.comments_count === "number" ? it.comments_count : 0,
    reach: null,
    saves: null,
    shares: null,
  }));

  // Best-effort reach/saves/shares for the most recent posts (needs
  // manage_insights). One insights call per post, run in parallel.
  await Promise.all(
    media.slice(0, insightsFor).map(async (m) => {
      if (!m.id) return;
      const ins = await ig(
        `${m.id}/insights`,
        { metric: "reach,saved,shares", access_token: token },
        6000,
      );
      const arr = Array.isArray((ins as { data?: unknown })?.data)
        ? ((ins as { data: Record<string, unknown>[] }).data)
        : [];
      for (const metric of arr) {
        const values = metric.values as { value?: unknown }[] | undefined;
        const totalValue = (metric.total_value as { value?: unknown } | undefined)?.value;
        const v = values?.[0]?.value ?? totalValue;
        if (typeof v !== "number") continue;
        if (metric.name === "reach") m.reach = v;
        else if (metric.name === "saved") m.saves = v;
        else if (metric.name === "shares") m.shares = v;
      }
    }),
  );

  const [followerGrowth, audience] = await Promise.all([
    fetchFollowerGrowth(igId, token),
    fetchAudience(igId, token),
  ]);

  return {
    followersCount: typeof profile.followers_count === "number" ? profile.followers_count : 0,
    mediaCount: typeof profile.media_count === "number" ? profile.media_count : 0,
    media,
    followerGrowth,
    audience,
  };
}

// Daily new-follower counts for the last ~30 days (needs manage_insights).
// Returns [] on any failure.
async function fetchFollowerGrowth(
  igId: string,
  token: string,
): Promise<{ date: string; value: number }[]> {
  const ins = await ig(`${igId}/insights`, {
    metric: "follower_count",
    period: "day",
    access_token: token,
  });
  const arr = Array.isArray((ins as { data?: unknown })?.data)
    ? ((ins as { data: Record<string, unknown>[] }).data)
    : [];
  const series = arr.find((m) => m.name === "follower_count");
  const values = (series?.values as { value?: unknown; end_time?: unknown }[]) || [];
  return values
    .filter((v) => typeof v.value === "number")
    .map((v) => ({
      date: typeof v.end_time === "string" ? v.end_time.slice(0, 10) : "",
      value: v.value as number,
    }));
}

// Parse a follower_demographics breakdown response into label/value pairs.
function parseBreakdown(resp: Record<string, unknown> | null): IgDemographic[] {
  const arr = Array.isArray((resp as { data?: unknown })?.data)
    ? ((resp as { data: Record<string, unknown>[] }).data)
    : [];
  const metric = arr[0];
  const totalValue = metric?.total_value as { breakdowns?: unknown } | undefined;
  const breakdowns = Array.isArray(totalValue?.breakdowns)
    ? (totalValue!.breakdowns as Record<string, unknown>[])
    : [];
  const results = Array.isArray(breakdowns[0]?.results)
    ? (breakdowns[0].results as Record<string, unknown>[])
    : [];
  return results
    .map((r) => {
      const dims = r.dimension_values as unknown[] | undefined;
      return {
        label: Array.isArray(dims) ? String(dims.join(" · ")) : "",
        value: typeof r.value === "number" ? r.value : 0,
      };
    })
    .filter((d) => d.label && d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

// Audience demographics + when-online. All best-effort; a failed breakdown is
// simply omitted, and if nothing comes back the whole audience is null.
async function fetchAudience(igId: string, token: string): Promise<IgAudience | null> {
  const demo = (breakdown: string) =>
    ig(`${igId}/insights`, {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown,
      access_token: token,
    });

  const [country, city, gender, age, online] = await Promise.all([
    demo("country"),
    demo("city"),
    demo("gender"),
    demo("age"),
    ig(`${igId}/insights`, { metric: "online_followers", period: "lifetime", access_token: token }),
  ]);

  const countries = parseBreakdown(country);
  const cities = parseBreakdown(city);
  const genderD = parseBreakdown(gender);
  const ages = parseBreakdown(age);

  // online_followers → 24 hourly buckets (average across the returned days).
  let onlineByHour: number[] | null = null;
  const onArr = Array.isArray((online as { data?: unknown })?.data)
    ? ((online as { data: Record<string, unknown>[] }).data)
    : [];
  const onValues = (onArr.find((m) => m.name === "online_followers")?.values as
    | { value?: unknown }[]
    | undefined) || [];
  if (onValues.length) {
    const hours = new Array(24).fill(0);
    let counted = 0;
    for (const v of onValues) {
      const map = v.value as Record<string, number> | undefined;
      if (map && typeof map === "object") {
        for (let h = 0; h < 24; h++) hours[h] += map[String(h)] || 0;
        counted++;
      }
    }
    if (counted > 0) onlineByHour = hours.map((s) => Math.round(s / counted));
  }

  if (!countries.length && !cities.length && !genderD.length && !ages.length && !onlineByHour) {
    return null;
  }
  return { countries, cities, gender: genderD, ages, onlineByHour };
}
