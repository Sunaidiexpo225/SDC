import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, signPending, PENDING_COOKIE } from "@/lib/auth";
import { json, error } from "@/lib/api";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid email or password", 400);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status === "invited") return error("Invalid credentials", 401);

  const ok = await checkPassword(password, user.passwordHash);
  if (!ok) return error("Invalid credentials", 401);

  // Always route through the 2FA step (mirrors the design's login flow).
  const pending = await signPending(user.id);
  const res = json({ mfaRequired: true });
  res.cookies.set(PENDING_COOKIE, pending, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
