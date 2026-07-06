import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkPassword,
  signPending,
  signSession,
  PENDING_COOKIE,
  PENDING_MAX_AGE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authCookie,
} from "@/lib/auth";
import { json, error } from "@/lib/api";
import { ensureSeeded } from "@/lib/seedData";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

// A VALID fixed bcrypt hash of a random value, compared against when no user
// matches so response timing doesn't reveal whether an email exists. Must be a
// well-formed hash or bcrypt.compare returns instantly and defeats the purpose.
const DUMMY_HASH = "$2a$10$JDyoCwlUOhbSiRqLWDmceeqP/n4MWNWueUiwLPO7hZ9f9bkTW85lu";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();

  const limited = rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  if (limited) return error("Too many attempts. Please wait and try again.", 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid email or password", 400);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always run a bcrypt comparison so timing is uniform whether or not the
  // account exists; invited accounts can't sign in yet.
  const ok = await checkPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || user.status === "invited" || !ok) {
    await audit({
      action: "auth.login_failed",
      target: email.toLowerCase(),
      detail: !user ? "no such user" : user.status === "invited" ? "account not activated" : "bad password",
      level: "warning",
      ip: clientIp(req),
    });
    return error("Invalid credentials", 401);
  }

  // Users who have enrolled 2FA go through the code step; everyone else signs
  // in directly and can enable 2FA later in the app. (This avoids a lock-out
  // when the demo TOTP bypass is off and a new user hasn't set up an
  // authenticator yet.)
  if (user.mfaEnabled) {
    const pending = await signPending(user.id);
    const res = json({ mfaRequired: true });
    res.cookies.set(PENDING_COOKIE, pending, authCookie(PENDING_MAX_AGE));
    return res;
  }

  const token = await signSession({ uid: user.id, acting: user.id });
  await audit({
    action: "auth.login",
    actor: { id: user.id, email: user.email, role: user.role },
    ip: clientIp(req),
  });
  const res = json({ mfaRequired: false });
  res.cookies.set(SESSION_COOKIE, token, authCookie(SESSION_MAX_AGE));
  return res;
}
