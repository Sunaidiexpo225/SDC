import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toPostDTO } from "@/lib/serialize";

const Body = z.object({
  eventId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  caption: z.string().optional(),
  platforms: z.array(z.string()).min(1),
  mediaId: z.string().optional(),
  format: z.enum(["Image", "Video", "Reel"]).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "Editor"])) {
    return forbidden("Viewers can't create posts");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("At least one account is required", 400);
  const { eventId, date, time, platforms, mediaId, format } = parsed.data;
  const caption = (parsed.data.caption ?? "").trim();

  // A post must carry some content: a caption, media, or both.
  if (!caption && !mediaId) return error("Add a caption or attach media", 400);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return error("Event not found", 404);

  // Attach uploaded media if provided; the post's format follows the media's
  // kind unless the client picked one (e.g. tagging a video as a Reel).
  let mediaFormat: string | null = format ?? null;
  if (mediaId) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return error("Uploaded media not found", 404);
    if (!mediaFormat) mediaFormat = media.kind;
  }

  const titleTxt =
    caption.split(/[.!؟?—]/)[0].slice(0, 40) || mediaFormat || "New post";
  const post = await prisma.post.create({
    data: {
      eventId,
      date,
      time,
      titleEn: `${event.nameEn} · ${titleTxt}`,
      titleAr: `${event.nameAr} · ${titleTxt}`,
      captionEn: caption,
      captionAr: caption,
      platformsCsv: platforms.join(","),
      status: "scheduled",
      mediaId: mediaId ?? null,
      format: mediaFormat,
    },
  });
  return json(toPostDTO(post), 201);
}
