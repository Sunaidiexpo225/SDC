import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import {
  fetchInstagramAccountData,
  type IgAccountData,
} from "@/lib/publishers/instagramInsights";
import { computeLiveAnalytics, type LiveAccount } from "@/lib/analytics";
import type { RangeKey } from "@/lib/types";
import { cacheGet, cacheSet } from "@/lib/cache";

// Fetching real Instagram data (profile + media + per-post insights) can take a
// few seconds across several accounts.
export const maxDuration = 60;

const RANGES = ["1d", "7d", "30d", "90d", "365d"];
// The raw per-account pull is range-independent (we always fetch the recent
// posts; the range only filters at compute time). Cache it per account so
// switching ranges recomputes instantly without new Graph API calls.
const RAW_TTL = 300_000; // 5 min

// GET /api/analytics?eventId=...&range=7d
// Returns a live AnalyticsModel built from real Instagram data for the event's
// connected Instagram accounts. When nothing is connected (or all lookups
// fail), returns { source: "estimated" } so the screen falls back to the
// modelled numbers.
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId") || "";
  const rangeRaw = searchParams.get("range") || "7d";
  const range = (RANGES.includes(rangeRaw) ? rangeRaw : "7d") as RangeKey;
  if (!eventId) return error("eventId is required", 400);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { accounts: true },
  });
  if (!event) return error("Event not found", 404);

  const igAccounts = event.accounts.filter(
    (a) => a.platform === "instagram" && a.connected && a.apiKey && a.externalId,
  );
  if (igAccounts.length === 0) return json({ source: "estimated" });

  const live: LiveAccount[] = [];
  await Promise.all(
    igAccounts.map(async (a) => {
      // Reuse the range-independent raw pull if it's warm; otherwise fetch
      // reach/saves/shares for every post so Views populate for all Top posts.
      const rawKey = `igraw:${a.externalId}`;
      let data = cacheGet<IgAccountData>(rawKey, RAW_TTL);
      if (!data) {
        data = await fetchInstagramAccountData(a.externalId as string, a.apiKey as string, 200, 60);
        if (data) cacheSet(rawKey, data);
      }
      if (data) {
        live.push({
          platform: a.platform,
          handle: a.handle,
          followers: data.followersCount || a.followers,
          media: data.media,
          followerGrowth: data.followerGrowth,
          audience: data.audience,
        });
      }
    }),
  );
  if (live.length === 0) return json({ source: "estimated" });

  const model = computeLiveAnalytics(live, range, Date.now());
  return json(model);
}
