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
}

export interface IgAccountData {
  followersCount: number;
  mediaCount: number;
  media: IgMedia[];
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
  }));

  // Best-effort reach for the most recent posts (needs manage_insights).
  await Promise.all(
    media.slice(0, insightsFor).map(async (m) => {
      if (!m.id) return;
      const ins = await ig(`${m.id}/insights`, { metric: "reach", access_token: token }, 6000);
      const arr = Array.isArray((ins as { data?: unknown })?.data)
        ? ((ins as { data: Record<string, unknown>[] }).data)
        : [];
      for (const metric of arr) {
        if (metric?.name !== "reach") continue;
        const values = metric.values as { value?: unknown }[] | undefined;
        const totalValue = (metric.total_value as { value?: unknown } | undefined)?.value;
        const v = values?.[0]?.value ?? totalValue;
        if (typeof v === "number") m.reach = v;
      }
    }),
  );

  return {
    followersCount: typeof profile.followers_count === "number" ? profile.followers_count : 0,
    mediaCount: typeof profile.media_count === "number" ? profile.media_count : 0,
    media,
  };
}
