import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toEventDTO } from "@/lib/serialize";

const Body = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const data: { nameEn?: string; nameAr?: string; color?: string } = {};
  if (parsed.data.name != null) {
    data.nameEn = parsed.data.name;
    data.nameAr = parsed.data.name;
  }
  if (parsed.data.color != null) data.color = parsed.data.color;

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
