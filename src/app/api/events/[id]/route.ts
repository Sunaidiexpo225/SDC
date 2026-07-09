import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toEventDTO } from "@/lib/serialize";

const Body = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  aliases: z.string().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can edit events");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const data: { nameEn?: string; nameAr?: string; color?: string; aliases?: string | null } = {};
  if (parsed.data.name != null) {
    const name = parsed.data.name.trim();
    if (!name) return error("Event name can't be empty", 400);
    data.nameEn = name;
    data.nameAr = name;
  }
  if (parsed.data.color != null) data.color = parsed.data.color;
  if (parsed.data.aliases != null) {
    const cleaned = parsed.data.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .join(", ");
    data.aliases = cleaned || null;
  }

  try {
    const event = await prisma.event.update({
      where: { id: params.id },
      data,
      include: { accounts: { orderBy: { id: "asc" } } },
    });
    return json(toEventDTO(event));
  } catch {
    return error("Event not found", 404);
  }
}
