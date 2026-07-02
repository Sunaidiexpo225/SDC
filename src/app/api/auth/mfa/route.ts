import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  verify,
  verifyTotp,
  signSession,
  PENDING_COOKIE,
  SESSION_COOKIE,
  type PendingPayload,
} from "@/lib/auth";
import { json, error } from "@/lib/api";

const Body = z.object({ code: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Enter the 6-digit code", 400);

  const pendingToken = cookies().get(PENDING_COOKIE)?.value;
  const pending = await verify<PendingPayload>(pendingToken);
  if (!pending || pending.step !== "mfa") return error("Session expired — sign in again", 401);

  const user = await prisma.user.findUnique({ where: { id: pending.uid } });
  if (!user) return error("Account not found", 404);

  if (!verifyTotp(user.totpSecret, parsed.data.code)) {
    return error("That code didn't match. Try again.", 401);
  }

  const token = await signSession({ uid: user.id, acting: user.id });
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set(PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
