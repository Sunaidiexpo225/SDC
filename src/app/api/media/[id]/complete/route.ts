import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";

export const runtime = "nodejs";

// Marks a client-direct (S3) upload ready once the browser has PUT the bytes.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const media = await prisma.media.findUnique({ where: { id: params.id } });
  if (!media) return error("Upload not found", 404);

  const updated = await prisma.media.update({
    where: { id: media.id },
    data: { status: "ready" },
    select: { id: true, filename: true, mimeType: true, size: true, kind: true },
  });
  return json(
    {
      id: updated.id,
      url: `/api/media/${updated.id}`,
      kind: updated.kind,
      filename: updated.filename,
      mimeType: updated.mimeType,
      size: updated.size,
    },
    201,
  );
}
