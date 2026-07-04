import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkPassword,
  signPending,
  PENDING_COOKIE,
  PENDING_MAX_AGE,
  authCookie,
} from "@/lib/auth";
import { json, error } from "@/lib/api";
import { ensureSeeded } from "@/lib/seedData";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// A fixed bcrypt hash of a random value, compared against when no user matches
// so response timing doesn't reveal whether an email exists.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8p8i3sN2h9nB4Xk9m5Zr1c2d3e4f6";

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
    return error("Invalid credentials", 401);
  }

  // Always route through the 2FA step (mirrors the design's login flow).
  const pending = await signPending(user.id);
  const res = json({ mfaRequired: true });
  res.cookies.set(PENDING_COOKIE, pending, authCookie(PENDING_MAX_AGE));
  return res;
}
