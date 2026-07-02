import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { json, error } from "@/lib/api";

const Body = z.object({ userId: z.string().min(1) });

// "Acting as" — switch which teammate the session is acting as, to demo the
// role-gated approval flow. The authenticated user is unchanged.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Missing userId", 400);

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return error("User not found", 404);

  const token = await signSession({ uid: ctx.authUser!.id, acting: target.id });
  const res = json({ ok: true, actingUserId: target.id });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
