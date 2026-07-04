import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toEventDTO } from "@/lib/serialize";
import { tr } from "@/lib/i18n";

const Body = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  lang: z.enum(["en", "ar"]).optional(),
});

// New events start with a starter Instagram + TikTok + LinkedIn set (0 followers),
// exactly like the design's createEvent.
const STARTER: { key: string; handleFromSlug: boolean }[] = [
  { key: "instagram", handleFromSlug: true },
  { key: "tiktok", handleFromSlug: true },
  { key: "linkedin", handleFromSlug: false },
];

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can create events");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const lang = parsed.data.lang ?? "en";
  const name = (parsed.data.name || "").trim() || tr(lang).newEventDefault;
  const color = parsed.data.color || "#7c5cf0";
  const slugBase = (name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "event").slice(0, 16);

  const count = await prisma.event.count();
  // ensure unique slug
  let slug = slugBase;
  let n = 1;
  while (await prisma.event.findUnique({ where: { slug } })) slug = slugBase + n++;

  const event = await prisma.event.create({
    data: {
      slug,
      nameEn: name,
      nameAr: name,
      color,
      barIx: count % 5,
      order: count,
      accounts: {
        create: STARTER.map((s) => ({
          platform: s.key,
          handle: s.handleFromSlug ? "@" + slugBase : name,
          followers: 0,
          connected: false,
        })),
      },
    },
    include: { accounts: { orderBy: { id: "asc" } } },
  });

  return json(toEventDTO(event), 201);
}
