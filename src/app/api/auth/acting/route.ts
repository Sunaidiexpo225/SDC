import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import {
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authCookie,
  DEMO_MODE,
} from "@/lib/auth";
import { json, error } from "@/lib/api";

const Body = z.object({ userId: z.string().min(1) });

// "Acting as" — switch which teammate the session is acting as, to demo the
// role-gated approval flow. The authenticated user is unchanged.
//
// This lets a user assume ANY teammate's role, so it is a demo-only device
// and is disabled outside DEMO_MODE (currentUsers() also ignores the `acting`
// claim there, so the effective role is always the real user's).
export async function POST(req: NextRequest) {
  if (!DEMO_MODE) return error("Not available", 404);

  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Missing userId", 400);

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return error("User not found", 404);

  const token = await signSession({ uid: ctx.authUser!.id, acting: target.id });
  const res = json({ ok: true, actingUserId: target.id });
  res.cookies.set(SESSION_COOKIE, token, authCookie(SESSION_MAX_AGE));
  return res;
}
