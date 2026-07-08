import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  json,
  error,
  forbidden,
  effectiveRole,
  effectiveUserId,
  roleCan,
  canAccessEvent,
} from "@/lib/api";
import { toPostDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({
  approval: z.enum(["approved", "declined", "pending"]).optional(),
  assigneeId: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

// Update a post's approval (gates publishing), its assignee, or its completion
// state. Approval + assignment are a management action (Admin/Manager/Assistant
// Manager); marking done is allowed for those roles or the post's own assignee.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const { approval, assigneeId, completed } = parsed.data;

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return error("Post not found", 404);
  if (!(await canAccessEvent(ctx, post.eventId))) {
    return forbidden("You don't have access to this event");
  }

  const role = effectiveRole(ctx);
  const isManager = roleCan(role, ["Admin", "Manager", "AsstManager"]);
  const meId = effectiveUserId(ctx);

  const data: {
    approval?: string;
    assigneeId?: string | null;
    completed?: boolean;
    completedAt?: Date | null;
    completedById?: string | null;
  } = {};

  if (approval !== undefined) {
    if (!isManager) return forbidden("Only Managers and Admins can approve posts");
    data.approval = approval;
  }
  if (assigneeId !== undefined) {
    if (!isManager) return forbidden("Only Managers can assign posts");
    data.assigneeId = assigneeId;
  }
  if (completed !== undefined) {
    // The assignee can mark their own post done; managers can mark any.
    if (!isManager && post.assigneeId !== meId) {
      return forbidden("Only the assignee or a Manager can mark this done");
    }
    data.completed = completed;
    data.completedAt = completed ? new Date() : null;
    data.completedById = completed ? meId : null;
  }

  if (Object.keys(data).length === 0) return error("Nothing to update", 400);

  const updated = await prisma.post.update({ where: { id: post.id }, data });
  if (approval !== undefined) {
    await audit({ action: `post.${approval}`, actor: actorOf(ctx), target: post.titleEn, ip: clientIp(req) });
  }
  if (completed !== undefined) {
    await audit({
      action: completed ? "post.completed" : "post.reopened",
      actor: actorOf(ctx),
      target: post.titleEn,
      ip: clientIp(req),
    });
  }
  return json(toPostDTO(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "AsstManager", "Editor"])) {
    return forbidden("Viewers can't delete posts");
  }
  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post) return error("Post not found", 404);
  if (!(await canAccessEvent(ctx, post.eventId))) {
    return forbidden("You don't have access to this event");
  }
  await prisma.post.delete({ where: { id: post.id } });
  return json({ ok: true });
}
