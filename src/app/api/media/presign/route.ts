import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import {
  ALLOWED_MIME,
  MEDIA_DRIVER,
  kindFromMime,
  maxUploadBytes,
  maxUploadMb,
  objectKey,
  presignUpload,
} from "@/lib/media";
import { signUpload } from "@/lib/cloudinary";

export const runtime = "nodejs";

const Body = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  eventId: z.string().optional(),
});

// Starts an upload. In S3 mode it registers a pending Media row and returns a
// presigned PUT URL so the browser uploads straight to the bucket (no function
// body limit). In db mode it just validates and tells the client to use the
// multipart /api/media route.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "Editor"])) {
    return forbidden("Viewers can't upload media");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid upload request", 400);
  const { filename, contentType, size } = parsed.data;
  // eventId flows into S3 object keys / Cloudinary folder names — strip anything
  // that isn't a safe id char so a value like "../x" can't escape the prefix.
  const eventId = parsed.data.eventId
    ? parsed.data.eventId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || null
    : null;

  if (!ALLOWED_MIME.test(contentType)) {
    return error("Unsupported file type — upload an image or video", 415);
  }
  if (size <= 0) return error("That file is empty", 400);
  if (size > maxUploadBytes(contentType)) {
    return error(`File is too large (max ${maxUploadMb(contentType)} MB)`, 413);
  }

  if (MEDIA_DRIVER === "db") return json({ mode: "db" });

  const kind = kindFromMime(contentType);

  // Cloudinary: register a pending row (public_id is set on complete) and hand
  // the browser a signed direct-upload ticket. Cloudinary both stores and
  // resizes, so this unlocks the per-platform renditions.
  if (MEDIA_DRIVER === "cloudinary") {
    const media = await prisma.media.create({
      data: {
        eventId: eventId ?? null,
        filename,
        mimeType: contentType,
        size,
        kind,
        driver: "cloudinary",
        status: "pending",
      },
      select: { id: true, kind: true },
    });
    const resourceType = contentType.startsWith("video/") ? "video" : "image";
    const sig = signUpload(`sdc/${eventId || "shared"}`, resourceType);
    return json({ mode: "cloudinary", mediaId: media.id, ...sig });
  }

  const key = objectKey(eventId ?? null, filename);
  const media = await prisma.media.create({
    data: {
      eventId: eventId ?? null,
      filename,
      mimeType: contentType,
      size,
      kind,
      driver: "s3",
      status: "pending",
      storageKey: key,
    },
    select: { id: true, kind: true },
  });
  const uploadUrl = await presignUpload(key, contentType);
  return json({ mode: "s3", mediaId: media.id, uploadUrl, kind: media.kind });
}
