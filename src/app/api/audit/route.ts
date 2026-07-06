import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";

// GET /api/audit?level=error&limit=100  — Admin-only view of the audit trail
// and captured server errors, newest first.
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin"])) {
    return forbidden("Only Admins can view the audit log");
  }

  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level");
  const take = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100));

  const rows = await prisma.auditLog.findMany({
    where: level && ["info", "warning", "error"].includes(level) ? { level } : undefined,
    orderBy: { at: "desc" },
    take,
  });

  return json({
    entries: rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      action: r.action,
      target: r.target,
      detail: r.detail,
      level: r.level,
      ip: r.ip,
    })),
  });
}
