// Real Facebook Page data for the Analytics screen, shaped to match the
// Instagram IgAccountData so it flows through the same computeLiveAnalytics:
//   • followers_count (fan_count fallback)
//   • published posts with reactions (likes) + comments + shares
//   • best-effort per-post reach (post_impressions_unique — needs
//     pages_read_engagement, which the publishing token already has)
//
// Facebook no longer exposes Page follower demographics or a reliable daily
// follower series, so audience + followerGrowth come back empty (Instagram
// still provides those).

import type { IgAccountData, IgMedia } from "./instagramInsights";

const GRAPH = "https://graph.facebook.com/v21.0";

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = new Array(Math.min(size, items.length || 1)).fill(0).map(async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

async function fb(
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

function fbType(attachments: unknown): IgMedia["mediaType"] {
  const d = (attachments as { data?: { media_type?: string }[] } | undefined)?.data?.[0];
  const t = (d?.media_type || "").toLowerCase();
  if (t === "video") return "VIDEO";
  return "IMAGE"; // photo / album / link / status → treated as image
}

export async function fetchFacebookAccountData(
  pageId: string,
  token: string,
  mediaLimit = 100,
  insightsFor = 40,
): Promise<IgAccountData | null> {
  const profile = await fb(pageId, { fields: "followers_count,fan_count", access_token: token });
  if (!profile) return null;
  const followersCount =
    (typeof profile.followers_count === "number" && profile.followers_count) ||
    (typeof profile.fan_count === "number" && profile.fan_count) ||
    0;

  const items: Record<string, unknown>[] = [];
  let after: string | undefined;
  for (let page = 0; page < 3 && items.length < mediaLimit; page++) {
    const params: Record<string, string> = {
      fields:
        "id,message,created_time,permalink_url,shares,reactions.summary(total_count),comments.summary(total_count),attachments{media_type}",
      limit: "50",
      access_token: token,
    };
    if (after) params.after = after;
    const resp = await fb(`${pageId}/published_posts`, params);
    const batch = Array.isArray((resp as { data?: unknown })?.data)
      ? ((resp as { data: Record<string, unknown>[] }).data)
      : [];
    if (!batch.length) break;
    items.push(...batch);
    const cursor = (resp as { paging?: { cursors?: { after?: unknown } } })?.paging?.cursors?.after;
    after = typeof cursor === "string" ? cursor : undefined;
    if (!after) break;
  }

  const media: IgMedia[] = items.slice(0, mediaLimit).map((it) => ({
    id: String(it.id ?? ""),
    caption: typeof it.message === "string" ? it.message : "",
    mediaType: fbType(it.attachments),
    timestamp: typeof it.created_time === "string" ? it.created_time : "",
    permalink: typeof it.permalink_url === "string" ? it.permalink_url : "",
    likes: (it.reactions as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0,
    comments: (it.comments as { summary?: { total_count?: number } } | undefined)?.summary?.total_count ?? 0,
    reach: null,
    saves: null, // Facebook Pages have no "saves" metric
    shares: (it.shares as { count?: number } | undefined)?.count ?? null,
  }));

  // Best-effort reach per post.
  await pool(media.slice(0, insightsFor), 5, async (m) => {
    if (!m.id) return;
    const ins = await fb(`${m.id}/insights`, { metric: "post_impressions_unique", access_token: token }, 6000);
    const arr = Array.isArray((ins as { data?: unknown })?.data)
      ? ((ins as { data: Record<string, unknown>[] }).data)
      : [];
    const v = (arr[0]?.values as { value?: unknown }[] | undefined)?.[0]?.value;
    if (typeof v === "number") m.reach = v;
  });

  return { followersCount, mediaCount: media.length, media, followerGrowth: [], audience: null };
}
