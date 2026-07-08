import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({ eventIds: z.array(z.string()) });

// PUT /api/users/[id]/events — set which events an event-scoped user can access.
// Admins/Managers only. Global roles (Admin/Manager) ignore this — they see all.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can set event access");
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return error("User not found", 404);

  // Only keep event ids that actually exist, so a stale id can't wedge the set.
  const existing = await prisma.event.findMany({
    where: { id: { in: parsed.data.eventIds } },
    select: { id: true },
  });
  const ids = existing.map((e) => e.id);

  await prisma.$transaction([
    prisma.eventMember.deleteMany({ where: { userId: user.id } }),
    prisma.eventMember.createMany({
      data: ids.map((eventId) => ({ userId: user.id, eventId })),
      skipDuplicates: true,
    }),
  ]);

  await audit({
    action: "user.event_access",
    actor: actorOf(ctx),
    target: user.email,
    detail: `${ids.length} event(s)`,
    ip: clientIp(req),
  });
  return json({ ok: true, eventIds: ids });
}
