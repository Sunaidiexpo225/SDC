import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { readMedia, presignDownload } from "@/lib/media";

export const runtime = "nodejs";

// Serves stored media to authenticated clients. Same-origin <img>/<video>
// requests carry the session cookie, so previews and post thumbnails work.
// db-stored media is streamed; s3-stored media redirects to a short-lived
// presigned URL (works for private buckets).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return new NextResponse("Not authenticated", { status: 401 });

  const media = await readMedia(params.id);
  if (!media) return new NextResponse("Not found", { status: 404 });

  if (media.driver === "s3" && media.storageKey) {
    const url = await presignDownload(media.storageKey);
    return NextResponse.redirect(url, 302);
  }

  if (!media.data) return new NextResponse("Not found", { status: 404 });
  const body = Buffer.from(media.data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
