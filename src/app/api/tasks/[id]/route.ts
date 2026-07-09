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
import { toTaskDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  eventId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().max(10).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  status: z.enum(["open", "in_progress", "completed"]).optional(),
});

// PATCH /api/tasks/[id] — edit fields or toggle completion. Editing details is
// a management action; the assignee may toggle their own task's completion.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return error("Task not found", 404);
  if (task.eventId && !(await canAccessEvent(ctx, task.eventId))) {
    return forbidden("You don't have access to this task's event");
  }

  const role = effectiveRole(ctx);
  const isManager = roleCan(role, ["Admin", "Manager", "AsstManager"]);
  const meId = effectiveUserId(ctx);

  const { title, notes, eventId, assigneeId, dueDate, priority, status } = parsed.data;
  const editsDetail =
    title !== undefined ||
    notes !== undefined ||
    eventId !== undefined ||
    assigneeId !== undefined ||
    dueDate !== undefined ||
    priority !== undefined;

  if (editsDetail && !isManager) return forbidden("Only Managers can edit task details");
  if (eventId && !(await canAccessEvent(ctx, eventId))) {
    return forbidden("You don't have access to that event");
  }
  if (assigneeId && !(await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } }))) {
    return error("Assignee not found", 400);
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (notes !== undefined) data.notes = notes?.trim() || null;
  if (eventId !== undefined) data.eventId = eventId || null;
  if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
  if (dueDate !== undefined) data.dueDate = dueDate || null;
  if (priority !== undefined) data.priority = priority;

  if (status !== undefined) {
    const completing = status === "completed";
    if (!isManager && task.assigneeId !== meId) {
      return forbidden("Only the assignee or a Manager can change completion");
    }
    data.status = status;
    data.completedAt = completing ? new Date() : null;
    data.completedById = completing ? meId : null;
  }

  if (Object.keys(data).length === 0) return error("Nothing to update", 400);

  const updated = await prisma.task.update({ where: { id: task.id }, data });
  if (status !== undefined) {
    await audit({
      action: status === "completed" ? "task.completed" : "task.reopened",
      actor: actorOf(ctx),
      target: task.title,
      ip: clientIp(req),
    });
  }
  return json(toTaskDTO(updated));
}

// DELETE /api/tasks/[id] — managers or the task's creator.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return error("Task not found", 404);
  if (task.eventId && !(await canAccessEvent(ctx, task.eventId))) {
    return forbidden("You don't have access to this task's event");
  }
  const isManager = roleCan(effectiveRole(ctx), ["Admin", "Manager", "AsstManager"]);
  if (!isManager && task.createdById !== effectiveUserId(ctx)) {
    return forbidden("Only a Manager or the creator can delete this task");
  }
  await prisma.task.delete({ where: { id: task.id } });
  await audit({ action: "task.delete", actor: actorOf(ctx), target: task.title, ip: clientIp(req) });
  return json({ ok: true });
}
