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
  SESSION_MAX_AGE,
  authCookie,
  type PendingPayload,
} from "@/lib/auth";
import { json, error } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

const Body = z.object({ code: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Enter the 6-digit code", 400);

  const pendingToken = cookies().get(PENDING_COOKIE)?.value;
  const pending = await verify<PendingPayload>(pendingToken);
  if (!pending || pending.step !== "mfa") return error("Session expired — sign in again", 401);

  // Cap code attempts per pending user so the 6-digit TOTP can't be brute-forced.
  const limited = rateLimit(`mfa:${pending.uid}:${clientIp(req)}`, 5, 60_000);
  if (limited) return error("Too many attempts. Please wait and try again.", 429);

  const user = await prisma.user.findUnique({ where: { id: pending.uid } });
  if (!user) return error("Account not found", 404);

  if (!verifyTotp(user.totpSecret, parsed.data.code)) {
    await audit({
      action: "auth.mfa_failed",
      actor: { id: user.id, email: user.email, role: user.role },
      level: "warning",
      ip: clientIp(req),
    });
    return error("That code didn't match. Try again.", 401);
  }

  const token = await signSession({ uid: user.id, acting: user.id });
  await audit({
    action: "auth.login",
    actor: { id: user.id, email: user.email, role: user.role },
    detail: "2FA verified",
    ip: clientIp(req),
  });
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, authCookie(SESSION_MAX_AGE));
  res.cookies.set(PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
