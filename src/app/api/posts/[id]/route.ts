import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";

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
