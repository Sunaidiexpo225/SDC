import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, getSetting, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toSettingDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({
  requireMfa: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  weekStartsMonday: z.boolean().optional(),
  tone: z.enum(["punchy", "professional", "friendly"]).optional(),
  lang: z.enum(["en", "ar"]).optional(),
});

export async function GET() {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  return json(toSettingDTO(await getSetting()));
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin"])) {
    return forbidden("Only Admins can change workspace settings");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  await getSetting(); // ensure singleton exists
  const updated = await prisma.setting.update({
    where: { id: 1 },
    data: parsed.data,
  });
  await audit({
    action: "settings.update",
    actor: actorOf(ctx),
    detail: Object.entries(parsed.data).map(([k, v]) => `${k}=${v}`).join(", "),
    ip: clientIp(req),
  });
  return json(toSettingDTO(updated));
}
