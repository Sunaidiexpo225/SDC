import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, error } from "@/lib/api";
import { refreshAccount } from "@/lib/insightsStore";

export const maxDuration = 60;

// GET /api/cron/refresh-analytics
// Warms the analytics snapshot for every connected Instagram account so the
// Analytics screen always serves fresh data instantly. Protected by CRON_SECRET
// (Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`; an external
// scheduler can send the same header). Returns 503 until CRON_SECRET is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return error("Cron not configured — set CRON_SECRET", 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return error("Unauthorized", 401);
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      platform: { in: ["instagram", "facebook"] },
      connected: true,
      apiKey: { not: null },
      externalId: { not: null },
    },
  });

  const results = await Promise.all(
    accounts.map(async (a) => ({
      ok: await refreshAccount(a.externalId as string, a.apiKey as string, a.platform),
    })),
  );
  return json({ refreshed: results.filter((r) => r.ok).length, total: results.length });
}
