import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { listAdminOrganizations } from "@/lib/publishers/linkedin";

export const runtime = "nodejs";

// GET /api/linkedin/orgs?accountId=...
// For a connected LinkedIn account, returns the member (personal target) plus
// the Company Pages they administer, and which target is currently selected —
// so the Integrations screen can offer a "Post as" picker.
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can manage integrations");
  }

  const accountId = req.nextUrl.searchParams.get("accountId") || "";
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "linkedin" || !account.connected || !account.apiKey) {
    return error("LinkedIn account not connected", 400);
  }

  const token = account.apiKey.split("\n")[0];

  // Re-derive the member (person) target from OpenID userinfo so "post as
  // yourself" is always offered, even after switching to a Page.
  let person: { urn: string; name: string } | null = null;
  try {
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json().catch(() => null);
    if (meRes.ok && me?.sub) {
      person = { urn: `urn:li:person:${me.sub}`, name: me.name || me.given_name || "You" };
    }
  } catch {
    /* best-effort */
  }

  const orgs = await listAdminOrganizations(token);
  return json({ person, orgs, current: account.externalId || null });
}
