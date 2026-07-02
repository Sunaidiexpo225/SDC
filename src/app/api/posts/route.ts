import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toPostDTO } from "@/lib/serialize";

const Body = z.object({
  eventId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  caption: z.string().min(1),
  platforms: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Caption and at least one account are required", 400);
  const { eventId, date, time, caption, platforms } = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return error("Event not found", 404);

  const titleTxt = caption.split(/[.!؟?—]/)[0].slice(0, 40) || "New post";
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
    },
  });
  return json(toPostDTO(post), 201);
}
