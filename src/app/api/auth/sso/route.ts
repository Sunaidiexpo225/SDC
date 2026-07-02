import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { json, error } from "@/lib/api";

// SSO shortcut — signs in as the requested email if it maps to an active
// user, otherwise the first Admin. Mirrors the design's "Continue with SSO".
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as { email?: string });
  const email = (body?.email || "").toLowerCase().trim();

  let user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;
  if (!user || user.status === "invited") {
    user = await prisma.user.findFirst({ where: { role: "Admin", status: "active" } });
  }
  if (!user) return error("No account available for SSO", 404);

  const token = await signSession({ uid: user.id, acting: user.id });
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
