import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toUserDTO } from "@/lib/serialize";
import { verifyTotp } from "@/lib/auth";

const Body = z.object({
  role: z.enum(["Admin", "Manager", "Editor", "Viewer"]).optional(),
  action: z.enum(["resetMfa", "enableMfa"]).optional(),
  code: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return error("User not found", 404);

  if (parsed.data.role) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: parsed.data.role },
    });
    return json(toUserDTO(updated));
  }

  if (parsed.data.action === "resetMfa") {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false },
    });
    return json(toUserDTO(updated));
  }

  if (parsed.data.action === "enableMfa") {
    if (!verifyTotp(user.totpSecret, parsed.data.code || "")) {
      return error("That code didn't match. Try again.", 400);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    });
    return json(toUserDTO(updated));
  }

  return error("Nothing to update", 400);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  try {
    await prisma.user.delete({ where: { id: params.id } });
    return json({ ok: true });
  } catch {
    return error("User not found", 404);
  }
}
