import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { CLOUDINARY_CLOUD } from "@/lib/cloudinary";

export const runtime = "nodejs";

const Body = z.object({ publicId: z.string().optional() });

// Marks a client-direct upload ready once the browser has sent the bytes (to S3
// or Cloudinary). For Cloudinary we record the returned public_id and hand the
// client the cloud name + resource type so it can build per-platform URLs.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) return error("Upload not found", 404);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const publicId = parsed.success ? parsed.data.publicId : undefined;

  const updated = await prisma.media.update({
    where: { id: media.id },
    data: {
      status: "ready",
      ...(publicId ? { storageKey: publicId } : {}),
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      kind: true,
      driver: true,
      storageKey: true,
    },
  });

  const resourceType = updated.mimeType.startsWith("video/") ? "video" : "image";
  return json(
    {
      id: updated.id,
      url: `/api/media/${updated.id}`,
      kind: updated.kind,
      filename: updated.filename,
      mimeType: updated.mimeType,
      size: updated.size,
      // Present for Cloudinary uploads so the client can render per-platform crops.
      publicId: updated.driver === "cloudinary" ? updated.storageKey : null,
      cloudName: updated.driver === "cloudinary" ? CLOUDINARY_CLOUD : null,
      resourceType,
    },
    201,
  );
}
