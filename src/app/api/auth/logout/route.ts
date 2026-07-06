import { SESSION_COOKIE, PENDING_COOKIE, currentUsers } from "@/lib/auth";
import { json } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function POST() {
  // Record who signed out (best-effort) before clearing the session.
  const { authUser } = await currentUsers();
  if (authUser) {
    await audit({
      action: "auth.logout",
      actor: { id: authUser.id, email: authUser.email, role: authUser.role },
    });
  }
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(PENDING_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
