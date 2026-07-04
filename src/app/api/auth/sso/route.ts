import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authCookie,
  DEMO_MODE,
} from "@/lib/auth";
import { json, error } from "@/lib/api";
import { ensureSeeded } from "@/lib/seedData";

// SSO shortcut — signs in as the requested email if it maps to an active
// user, otherwise the first Admin. Mirrors the design's "Continue with SSO".
//
// This is a passwordless convenience for the demo ONLY: it grants a session
// with no credential check, so it is disabled unless DEMO_MODE is on. A real
// deployment must wire this to an actual identity provider.
export async function POST(req: NextRequest) {
  if (!DEMO_MODE) return error("SSO is not enabled", 404);

  await ensureSeeded();
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
  res.cookies.set(SESSION_COOKIE, token, authCookie(SESSION_MAX_AGE));
  return res;
}
