import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toPostDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({ approval: z.enum(["approved", "declined", "pending"]) });

// Approve / decline a scheduled post. Only Managers/Admins can change approval,
// which is what gates publishing.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Managers and Admins can approve posts");
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  try {
    const post = await prisma.post.update({
      where: { id: params.id },
      data: { approval: parsed.data.approval },
    });
    await audit({
      action: `post.${parsed.data.approval}`,
      actor: actorOf(ctx),
      target: post.titleEn,
      ip: clientIp(req),
    });
    return json(toPostDTO(post));
  } catch {
    return error("Post not found", 404);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "Editor"])) {
    return forbidden("Viewers can't delete posts");
  }
  try {
    await prisma.post.delete({ where: { id: params.id } });
    return json({ ok: true });
  } catch {
    return error("Post not found", 404);
  }
}
