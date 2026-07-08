import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { publishToInstagram } from "./publishers/instagram";
import { publishToX } from "./publishers/x";
import { publishToFacebook } from "./publishers/facebook";
import { publishToLinkedIn } from "./publishers/linkedin";
import { platformPublishUrl } from "./cloudinaryUrl";
import { CLOUDINARY_CLOUD } from "./cloudinary";
import { audit, type AuditActor } from "./audit";

// A post with the relations the publisher needs.
export type PublishablePost = Prisma.PostGetPayload<{
  include: { media: true; event: { include: { accounts: true } } };
}>;

export interface PublishResult {
  platform: string;
  ok: boolean;
  detail: string;
}

// Publish a post to all its connected platforms. Shared by the "Publish now"
// route and the auto-publish cron so the two behave identically. Marks the post
// `posted` if at least one platform succeeded. Does NOT check auth/approval —
// callers must gate that first.
export async function publishPostToPlatforms(
  post: PublishablePost,
  actor: AuditActor,
  ip: string | null,
): Promise<{ ok: boolean; results: PublishResult[] }> {
  const platforms = post.platformsCsv ? post.platformsCsv.split(",") : [];
  const results: PublishResult[] = [];

  const hasCloudMedia = !!(post.media && post.media.driver === "cloudinary" && post.media.storageKey);
  const isVideo = post.media?.mimeType.startsWith("video/") ?? false;
  const mediaFor = (platform: string) =>
    hasCloudMedia
      ? platformPublishUrl(CLOUDINARY_CLOUD, isVideo ? "video" : "image", post.media!.storageKey as string, platform, post.format)
      : null;

  const logOk = (platform: string, id: string) =>
    audit({ action: "post.publish", actor, target: `${platform} · ${post.event.nameEn}`, detail: `post ${post.id} → id ${id}`, ip });
  const logFail = (platform: string, msg: string) =>
    audit({ action: "post.publish_failed", actor, target: `${platform} · ${post.event.nameEn}`, detail: msg, level: "error", ip });

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
        const res = await publishToInstagram({ igUserId: account.externalId, accessToken: account.apiKey, caption: post.captionEn || "", mediaUrl: mediaFor("instagram") as string, isVideo });
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
        const res = await publishToX({ creds: { consumerKey, consumerSecret, accessToken, accessTokenSecret }, caption: post.captionEn || "", mediaUrl: mediaFor("x"), mimeType: post.media?.mimeType, isVideo });
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
        const res = await publishToFacebook({ pageId: account.externalId, accessToken: account.apiKey, message: post.captionEn || "", mediaUrl: mediaFor("facebook"), isVideo });
        results.push({ platform, ok: true, detail: `Posted (id ${res.id})` });
        await logOk(platform, res.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Publish failed";
        results.push({ platform, ok: false, detail: msg });
        await logFail(platform, msg);
      }
      continue;
    }

    if (platform === "linkedin") {
      if (!account?.apiKey || !account.externalId) {
        results.push({ platform, ok: false, detail: "Not connected — use Connect with LinkedIn in Integrations" });
        continue;
      }
      if (!post.captionEn && !hasCloudMedia) {
        results.push({ platform, ok: false, detail: "Add a caption or media to post to LinkedIn" });
        continue;
      }
      try {
        const res = await publishToLinkedIn({ accessToken: account.apiKey, authorUrn: account.externalId, text: post.captionEn || "", mediaUrl: mediaFor("linkedin"), isVideo });
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

  const ok = results.some((r) => r.ok);
  if (ok) {
    await prisma.post.update({ where: { id: post.id }, data: { status: "posted" } });
  }
  return { ok, results };
}
