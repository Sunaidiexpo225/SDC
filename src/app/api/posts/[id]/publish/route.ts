import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { publishToInstagram } from "@/lib/publishers/instagram";
import { platformPublishUrl } from "@/lib/cloudinaryUrl";
import { CLOUDINARY_CLOUD } from "@/lib/cloudinary";
import { audit, actorOf, clientIp } from "@/lib/audit";

export const runtime = "nodejs";
// Allow time for Instagram video (Reel) processing before publish.
export const maxDuration = 60;

interface Result {
  platform: string;
  ok: boolean;
  detail: string;
}

// Publish a scheduled post to its connected platforms. Instagram is wired to
// the real Graph API; other platforms are reported as not-yet-supported.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "Editor"])) {
    return forbidden("Viewers can't publish");
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { media: true, event: { include: { accounts: true } } },
  });
  if (!post) return error("Post not found", 404);

  const platforms = post.platformsCsv ? post.platformsCsv.split(",") : [];
  const results: Result[] = [];

  for (const platform of platforms) {
    const account = post.event.accounts.find(
      (a) => a.platform === platform && a.connected,
    );

    if (platform !== "instagram") {
      results.push({ platform, ok: false, detail: "Publisher not available yet" });
      continue;
    }
    if (!account?.apiKey || !account.externalId) {
      results.push({
        platform,
        ok: false,
        detail: "Not connected (needs access token + IG account ID)",
      });
      continue;
    }
    if (!post.media || post.media.driver !== "cloudinary" || !post.media.storageKey) {
      results.push({
        platform,
        ok: false,
        detail: "Instagram needs Cloudinary-hosted media on the post",
      });
      continue;
    }

    const isVideo = post.media.mimeType.startsWith("video/");
    const mediaUrl = platformPublishUrl(
      CLOUDINARY_CLOUD,
      isVideo ? "video" : "image",
      post.media.storageKey,
      "instagram",
      post.format,
    );
    try {
      const res = await publishToInstagram({
        igUserId: account.externalId,
        accessToken: account.apiKey,
        caption: post.captionEn || "",
        mediaUrl,
        isVideo,
      });
      results.push({ platform, ok: true, detail: `Published (id ${res.id})` });
      await audit({
        action: "post.publish",
        actor: actorOf(ctx),
        target: `${platform} · ${post.event.nameEn}`,
        detail: `post ${post.id} → id ${res.id}`,
        ip: clientIp(req),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      results.push({ platform, ok: false, detail: msg });
      await audit({
        action: "post.publish_failed",
        actor: actorOf(ctx),
        target: `${platform} · ${post.event.nameEn}`,
        detail: msg,
        level: "error",
        ip: clientIp(req),
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  if (anyOk) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "posted" },
    });
  }

  return json({ ok: anyOk, results });
}
