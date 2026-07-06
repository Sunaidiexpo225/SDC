import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { getAccountData } from "@/lib/insightsStore";
import { computeLiveAnalytics, type LiveAccount } from "@/lib/analytics";
import type { RangeKey } from "@/lib/types";

// Reads served from a stored snapshot are fast; only a cold/stale account
// triggers a live Graph fetch.
export const maxDuration = 60;

const RANGES = ["1d", "7d", "30d", "90d", "365d"];

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
      const data = await getAccountData(a.externalId as string, a.apiKey as string);
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
