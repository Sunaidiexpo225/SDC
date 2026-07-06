import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { fetchInstagramAccountData } from "@/lib/publishers/instagramInsights";
import { cacheGet, cacheSet } from "@/lib/cache";

export const maxDuration = 60;
const TTL = 300_000; // 5 min — heavier (all accounts)

// GET /api/analytics/overview — one row per connected Instagram account across
// every event, so the team can compare brands side by side (followers,
// last-30-day engagement + posts, and engagement growth vs the prior 30 days).
export async function GET(_req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const cached = cacheGet<unknown>("overview", TTL);
  if (cached) return json(cached);

  const events = await prisma.event.findMany({
    orderBy: { order: "asc" },
    include: { accounts: true },
  });

  const now = Date.now();
  const WIN = 30 * 86400000;
  const tsOf = (t: string) => {
    const p = Date.parse(t);
    return Number.isNaN(p) ? 0 : p;
  };

  const rows = await Promise.all(
    events.flatMap((e) =>
      e.accounts
        .filter((a) => a.platform === "instagram" && a.connected && a.apiKey && a.externalId)
        .map(async (a) => {
          // Keep the overview light: skip per-post insight calls (insightsFor=0),
          // so engagement here is likes + comments only across many accounts.
          const data = await fetchInstagramAccountData(a.externalId as string, a.apiKey as string, 40, 0);
          if (!data) return null;
          const eng = (m: { likes: number; comments: number; saves: number | null; shares: number | null }) =>
            m.likes + m.comments + (m.saves ?? 0) + (m.shares ?? 0);
          const curr = data.media.filter((m) => tsOf(m.timestamp) >= now - WIN);
          const prev = data.media.filter(
            (m) => tsOf(m.timestamp) >= now - 2 * WIN && tsOf(m.timestamp) < now - WIN,
          );
          const engC = curr.reduce((s, m) => s + eng(m), 0);
          const engP = prev.reduce((s, m) => s + eng(m), 0);
          const growth = engP > 0 ? Math.round(((engC - engP) / engP) * 100) : engC > 0 ? 100 : 0;
          return {
            eventId: e.id,
            eventNameEn: e.nameEn,
            eventNameAr: e.nameAr,
            color: e.color,
            handle: a.handle,
            followers: data.followersCount,
            posts: curr.length,
            engagement: engC,
            growth,
          };
        }),
    ),
  );

  const payload = { accounts: rows.filter(Boolean) };
  cacheSet("overview", payload);
  return json(payload);
}
