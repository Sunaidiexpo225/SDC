import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { publishToInstagram } from "@/lib/publishers/instagram";
import { publishToX } from "@/lib/publishers/x";
import { publishToFacebook } from "@/lib/publishers/facebook";
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

  // Approval gate: a post must be approved by a Manager/Admin before it can be
  // published to any platform.
  if (post.approval !== "approved") {
    return error("This post needs approval before it can be published", 403);
  }

  const platforms = post.platformsCsv ? post.platformsCsv.split(",") : [];
  const results: Result[] = [];

  const hasCloudMedia = !!(post.media && post.media.driver === "cloudinary" && post.media.storageKey);
  const isVideo = post.media?.mimeType.startsWith("video/") ?? false;
  const mediaFor = (platform: string) =>
    hasCloudMedia
      ? platformPublishUrl(CLOUDINARY_CLOUD, isVideo ? "video" : "image", post.media!.storageKey as string, platform, post.format)
      : null;

  const logOk = (platform: string, id: string) =>
    audit({ action: "post.publish", actor: actorOf(ctx), target: `${platform} · ${post.event.nameEn}`, detail: `post ${post.id} → id ${id}`, ip: clientIp(req) });
  const logFail = (platform: string, msg: string) =>
    audit({ action: "post.publish_failed", actor: actorOf(ctx), target: `${platform} · ${post.event.nameEn}`, detail: msg, level: "error", ip: clientIp(req) });

  for (const platform of platforms) {
    const account = post.event.accounts.find((a) => a.platform === platform && a.connected);

    if (platform === "instagram") {
      if (!account?.apiKey || !account.externalId) {
        results.push({ platform, ok: false, detail: "Not connected (needs access token + IG account ID)" });
        continue;
      }
      if (!hasCloudMedia) {
        results.push({ platform, ok: false, detail: "Instagram needs Cloudinary-hosted media on the post" });
        continue;
      }
      try {
        const res = await publishToInstagram({
          igUserId: account.externalId,
          accessToken: account.apiKey,
          caption: post.captionEn || "",
          mediaUrl: mediaFor("instagram") as string,
          isVideo,
        });
        results.push({ platform, ok: true, detail: `Published (id ${res.id})` });
        await logOk(platform, res.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Publish failed";
        results.push({ platform, ok: false, detail: msg });
        await logFail(platform, msg);
      }
      continue;
    }

    if (platform === "x") {
      if (!account?.apiKey) {
        results.push({ platform, ok: false, detail: "Not connected (needs X access token + secret)" });
        continue;
      }
      const [accessToken, accessTokenSecret] = account.apiKey.split("\n");
      const consumerKey = process.env.X_API_KEY || "";
      const consumerSecret = process.env.X_API_SECRET || "";
      if (!consumerKey || !consumerSecret) {
        results.push({ platform, ok: false, detail: "X app keys not set (X_API_KEY / X_API_SECRET)" });
        continue;
      }
      if (!accessToken || !accessTokenSecret) {
        results.push({ platform, ok: false, detail: "X credentials incomplete — reconnect the account" });
        continue;
      }
      if (!post.captionEn && !hasCloudMedia) {
        results.push({ platform, ok: false, detail: "Add a caption or media to post to X" });
        continue;
      }
      try {
        const res = await publishToX({
          creds: { consumerKey, consumerSecret, accessToken, accessTokenSecret },
          caption: post.captionEn || "",
          mediaUrl: mediaFor("x"),
          mimeType: post.media?.mimeType,
          isVideo,
        });
        results.push({ platform, ok: true, detail: `Posted (id ${res.id})` });
        await logOk(platform, res.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Publish failed";
        results.push({ platform, ok: false, detail: msg });
        await logFail(platform, msg);
      }
      continue;
    }

    if (platform === "facebook") {
      if (!account?.apiKey || !account.externalId) {
        results.push({ platform, ok: false, detail: "Not connected (needs Page token + Page ID)" });
        continue;
      }
      if (!post.captionEn && !hasCloudMedia) {
        results.push({ platform, ok: false, detail: "Add a caption or media to post to Facebook" });
        continue;
      }
      try {
        const res = await publishToFacebook({
          pageId: account.externalId,
          accessToken: account.apiKey,
          message: post.captionEn || "",
          mediaUrl: mediaFor("facebook"),
          isVideo,
        });
        results.push({ platform, ok: true, detail: `Posted (id ${res.id})` });
        await logOk(platform, res.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Publish failed";
        results.push({ platform, ok: false, detail: msg });
        await logFail(platform, msg);
      }
      continue;
    }

    results.push({ platform, ok: false, detail: "Publisher not available yet" });
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
