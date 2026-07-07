import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { listAdminOrganizations } from "@/lib/publishers/linkedin";
import { toAccountDTO } from "@/lib/serialize";
import { audit, actorOf, clientIp } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  accountId: z.string(),
  urn: z.string(), // urn:li:person:xxx or urn:li:organization:xxx
  name: z.string().optional(),
});

// POST /api/linkedin/target
// Sets which identity a connected LinkedIn account publishes as — the member
// themselves (urn:li:person:...) or one of the Company Pages they administer
// (urn:li:organization:...). The chosen URN is validated against LinkedIn
// before it's stored, so an account can only ever target a Page you admin.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can manage integrations");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);
  const { accountId, urn, name } = parsed.data;

  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "linkedin" || !account.connected || !account.apiKey) {
    return error("LinkedIn account not connected", 400);
  }
  const token = account.apiKey.split("\n")[0];

  // Validate the target: either the signed-in member, or a Page they admin.
  let handle = name || "";
  if (urn.startsWith("urn:li:organization:")) {
    const orgs = await listAdminOrganizations(token);
    const match = orgs.find((o) => o.urn === urn);
    if (!match) return error("You don't administer that Page (or org posting isn't enabled)", 403);
    handle = match.name;
  } else if (urn.startsWith("urn:li:person:")) {
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meRes.json().catch(() => null);
    if (!meRes.ok || `urn:li:person:${me?.sub}` !== urn) {
      return error("That member URN doesn't match this connection", 403);
    }
    handle = name || me.name || "You";
  } else {
    return error("Unsupported LinkedIn URN", 400);
  }

  const updated = await prisma.socialAccount.update({
    where: { id: account.id },
    data: { externalId: urn, handle },
  });
  await audit({
    action: "account.connect",
    actor: actorOf(ctx),
    target: `linkedin ${handle}`,
    detail: `target=${urn}`,
    ip: clientIp(req),
  });
  return json(toAccountDTO(updated));
}
