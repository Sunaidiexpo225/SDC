import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, error } from "@/lib/api";
import { publishPostToPlatforms } from "@/lib/publishing";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Scheduled times are wall-clock in the brand's timezone. No per-post tz is
// stored, so we interpret them in one offset (KSA by default; override with
// PUBLISH_TZ, e.g. "+00:00").
const TZ = process.env.PUBLISH_TZ || "+03:00";
const SYSTEM_ACTOR = { id: null, email: "auto-publish", role: "system" };
// Don't publish posts scheduled absurdly far in the past (e.g. a backlog that
// pre-dates auto-publish being switched on) — only fire within this window.
const MAX_LATE_MS = 24 * 60 * 60 * 1000;
const BATCH = 15;

// GET /api/cron/publish-due
// Publishes every approved post whose scheduled time has arrived and hasn't
// been posted yet. Protected by CRON_SECRET (Bearer). Returns 503 until set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return error("Cron not configured — set CRON_SECRET", 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return error("Unauthorized", 401);
  }

  const now = Date.now();
  const candidates = await prisma.post.findMany({
    where: { status: { not: "posted" }, approval: "approved" },
    include: { media: true, event: { include: { accounts: true } } },
    orderBy: { createdAt: "asc" },
  });

  const due = candidates.filter((p) => {
    const at = Date.parse(`${p.date}T${p.time}:00${TZ}`);
    if (Number.isNaN(at)) return false;
    if (at > now) return false; // not time yet
    if (now - at > MAX_LATE_MS) return false; // too stale to auto-fire
    // Only attempt when at least one target platform has a connected account,
    // so we don't retry impossible posts every run.
    const platforms = p.platformsCsv ? p.platformsCsv.split(",") : [];
    return p.event.accounts.some((a) => a.connected && platforms.includes(a.platform));
  });

  let published = 0;
  const outcomes: { id: string; ok: boolean }[] = [];
  for (const post of due.slice(0, BATCH)) {
    try {
      const { ok } = await publishPostToPlatforms(post, SYSTEM_ACTOR, null);
      if (ok) published++;
      outcomes.push({ id: post.id, ok });
    } catch (e) {
      await audit({ action: "post.publish_failed", actor: SYSTEM_ACTOR, target: post.titleEn, detail: e instanceof Error ? e.message : "auto-publish error", level: "error" });
      outcomes.push({ id: post.id, ok: false });
    }
  }

  return json({ due: due.length, attempted: outcomes.length, published, outcomes });
}
