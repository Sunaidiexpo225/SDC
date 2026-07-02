import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toAccountDTO } from "@/lib/serialize";
import { PLATFORM_ORDER } from "@/lib/platforms";

const Body = z.object({ platform: z.enum(PLATFORM_ORDER as [string, ...string[]]) });

// Attach a new platform account to an event (design's addSocial).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid platform", 400);
  const platform = parsed.data.platform;

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { accounts: true },
  });
  if (!event) return error("Event not found", 404);
  if (event.accounts.some((a) => a.platform === platform)) {
    return error("Account already exists", 409);
  }

  const slug = (event.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "") || "event").slice(0, 16);
  const handle = platform === "facebook" || platform === "linkedin" ? event.nameEn : "@" + slug;

  const account = await prisma.socialAccount.create({
    data: { eventId: event.id, platform, handle, followers: 0, connected: false },
  });
  return json(toAccountDTO(account), 201);
}
