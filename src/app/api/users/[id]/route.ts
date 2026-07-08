import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, effectiveUserId, roleCan } from "@/lib/api";
import { toUserDTO } from "@/lib/serialize";
import { verifyTotp } from "@/lib/auth";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({
  role: z.enum(["Admin", "Manager", "AsstManager", "Editor", "Viewer"]).optional(),
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

  const isAdmin = roleCan(effectiveRole(ctx), ["Admin"]);
  const isSelf = effectiveUserId(ctx) === user.id;

  // Changing roles and resetting someone's MFA are Admin-only.
  if (parsed.data.role) {
    if (!isAdmin) return forbidden("Only Admins can change roles");
    // Don't let the last Admin be demoted out of existence.
    if (user.role === "Admin" && parsed.data.role !== "Admin") {
      const admins = await prisma.user.count({ where: { role: "Admin", status: "active" } });
      if (admins <= 1) return error("There must be at least one Admin", 400);
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: parsed.data.role },
    });
    await audit({
      action: "user.role_change",
      actor: actorOf(ctx),
      target: user.email,
      detail: `${user.role} → ${parsed.data.role}`,
      level: "warning",
      ip: clientIp(req),
    });
    return json(toUserDTO(updated));
  }

  if (parsed.data.action === "resetMfa") {
    if (!isAdmin) return forbidden("Only Admins can reset another user's MFA");
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false },
    });
    await audit({
      action: "user.mfa_reset",
      actor: actorOf(ctx),
      target: user.email,
      level: "warning",
      ip: clientIp(req),
    });
    return json(toUserDTO(updated));
  }

  // Enabling MFA requires the user's own valid code, so it's limited to the
  // account owner (or an Admin acting on their behalf).
  if (parsed.data.action === "enableMfa") {
    if (!isSelf && !isAdmin) return forbidden();
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
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin"])) {
    return forbidden("Only Admins can remove users");
  }
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return error("User not found", 404);
  if (target.id === effectiveUserId(ctx)) return error("You can't remove yourself", 400);
  if (target.role === "Admin") {
    const admins = await prisma.user.count({ where: { role: "Admin", status: "active" } });
    if (admins <= 1) return error("There must be at least one Admin", 400);
  }
  await prisma.user.delete({ where: { id: target.id } });
  await audit({
    action: "user.delete",
    actor: actorOf(ctx),
    target: target.email,
    detail: `role=${target.role}`,
    level: "warning",
    ip: clientIp(req),
  });
  return json({ ok: true });
}
