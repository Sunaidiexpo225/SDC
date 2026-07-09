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
  accessibleEventIds,
} from "@/lib/api";
import { toTaskDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  eventId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().max(10).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

// GET /api/tasks — accessible tasks (event-scoped). Handy for the Tasks screen
// to refresh independently of the full app snapshot.
export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  const allowed = await accessibleEventIds(ctx.actingUser ?? ctx.authUser);
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
  const visible = tasks.filter(
    (tk) => tk.eventId === null || allowed === null || allowed.includes(tk.eventId),
  );
  return json({ tasks: visible.map(toTaskDTO) });
}

// POST /api/tasks — create a task. Editors and up can create; Viewers cannot.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager", "AsstManager", "Editor"])) {
    return forbidden("Viewers can't create tasks");
  }
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const { title, notes, eventId, assigneeId, dueDate, priority } = parsed.data;

  if (eventId && !(await canAccessEvent(ctx, eventId))) {
    return forbidden("You don't have access to that event");
  }
  if (assigneeId && !(await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } }))) {
    return error("Assignee not found", 400);
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      notes: notes?.trim() || null,
      eventId: eventId || null,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      priority: priority || "normal",
      createdById: effectiveUserId(ctx),
    },
  });
  await audit({ action: "task.create", actor: actorOf(ctx), target: task.title, ip: clientIp(req) });
  return json(toTaskDTO(task));
}
