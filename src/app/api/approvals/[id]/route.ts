import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, roleCan } from "@/lib/api";
import { toApprovalDTO } from "@/lib/serialize";
import type { Role } from "@/lib/types";

const Body = z.object({
  action: z.enum(["save", "approve", "decline", "discard"]),
  caption: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  const role = ctx.actingUser?.role as Role | undefined;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const { action, caption } = parsed.data;

  const approval = await prisma.approval.findUnique({ where: { id: params.id } });
  if (!approval) return error("Approval not found", 404);

  // Role gating mirrors the design: Managers/Admins approve or decline;
  // Editors may discard their own; anyone may save an edited caption.
  if ((action === "approve" || action === "decline") && !roleCan(role, ["Admin", "Manager"])) {
    return error("Only Managers and Admins can approve", 403);
  }
  if (action === "discard" && !roleCan(role, ["Editor", "Admin", "Manager"])) {
    return error("Not permitted", 403);
  }

  if (action === "discard") {
    await prisma.approval.delete({ where: { id: approval.id } });
    return json({ ok: true, deleted: true });
  }

  const data: { editedCaption?: string; status?: string } = {};
  if (caption != null) data.editedCaption = caption;
  if (action === "approve") data.status = "approved";
  if (action === "decline") data.status = "declined";

  const updated = await prisma.approval.update({ where: { id: approval.id }, data });
  return json(toApprovalDTO(updated));
}
