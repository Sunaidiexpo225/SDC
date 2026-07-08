import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan, canAccessEvent } from "@/lib/api";
import { publishPostToPlatforms } from "@/lib/publishing";
import { actorOf, clientIp } from "@/lib/audit";

export const runtime = "nodejs";
// Allow time for Instagram video (Reel) processing before publish.
export const maxDuration = 60;

// Publish a scheduled post to its connected platforms (design's "Publish now").
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "AsstManager", "Editor"])) {
    return forbidden("Viewers can't publish");
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { media: true, event: { include: { accounts: true } } },
  });
  if (!post) return error("Post not found", 404);
  if (!(await canAccessEvent(ctx, post.eventId))) {
    return forbidden("You don't have access to this event");
  }

  // Approval gate: a post must be approved before it can be published.
  if (post.approval !== "approved") {
    return error("This post needs approval before it can be published", 403);
  }

  const { ok, results } = await publishPostToPlatforms(post, actorOf(ctx), clientIp(req));
  return json({ ok, results });
}
