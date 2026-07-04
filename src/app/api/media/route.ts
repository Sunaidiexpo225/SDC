import { NextRequest } from "next/server";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  kindFromMime,
  storeMedia,
} from "@/lib/media";

export const runtime = "nodejs";

// Upload post media (multipart/form-data, field "file"). Editors and up only.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "Editor"])) {
    return forbidden("Viewers can't upload media");
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error("No file provided", 400);
  if (file.size === 0) return error("That file is empty", 400);
  if (!ALLOWED_MIME.test(file.type)) {
    return error("Unsupported file type — upload an image or video", 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return error(`File is too large (max ${MAX_UPLOAD_LABEL})`, 413);
  }

  const eventId = (form?.get("eventId") as string) || null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const media = await storeMedia({
    eventId,
    filename: file.name || "upload",
    mimeType: file.type,
    kind: kindFromMime(file.type),
    bytes,
  });

  return json(
    {
      id: media.id,
      url: `/api/media/${media.id}`,
      kind: media.kind,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
    },
    201,
  );
}
