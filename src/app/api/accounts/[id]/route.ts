import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toAccountDTO } from "@/lib/serialize";
import { fetchInstagramProfile } from "@/lib/publishers/instagramInsights";
import { audit, actorOf, clientIp } from "@/lib/audit";

const Body = z.object({
  action: z.enum(["connect", "disconnect"]),
  apiKey: z.string().optional(),
  externalId: z.string().optional(),
});

// Connect / disconnect an account's API (design's connectApi / disconnectApi).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can manage integrations");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const account = await prisma.socialAccount.findUnique({ where: { id: params.id } });
  if (!account) return error("Account not found", 404);

  if (parsed.data.action === "connect") {
    const key = (parsed.data.apiKey || "").trim();
    if (!key) return error("API key is required", 400);
    const externalId = (parsed.data.externalId || "").trim() || null;
    const data: {
      connected: boolean;
      apiKey: string;
      externalId: string | null;
      handle?: string;
      followers?: number;
    } = { connected: true, apiKey: key, externalId };
    // Pull the account's real @username and follower count so the Compose /
    // Integrations / Analytics screens show who's actually connected and their
    // true audience. Best-effort: if the lookup fails, the connection still
    // succeeds with the existing handle/followers.
    if (account.platform === "instagram" && externalId) {
      const profile = await fetchInstagramProfile(externalId, key);
      if (profile?.username) data.handle = `@${profile.username}`;
      if (profile && profile.followersCount > 0) data.followers = profile.followersCount;
    }
    const updated = await prisma.socialAccount.update({
      where: { id: account.id },
      data,
    });
    await audit({
      action: "account.connect",
      actor: actorOf(ctx),
      target: `${account.platform} ${updated.handle}`,
      detail: externalId ? `id=${externalId}` : undefined,
      ip: clientIp(req),
    });
    return json(toAccountDTO(updated));
  }

  const updated = await prisma.socialAccount.update({
    where: { id: account.id },
    // Clear the stored access token on disconnect — a disconnected integration
    // shouldn't keep a live token at rest.
    data: { connected: false, apiKey: null },
  });
  await audit({
    action: "account.disconnect",
    actor: actorOf(ctx),
    target: `${account.platform} ${account.handle}`,
    ip: clientIp(req),
  });
  return json(toAccountDTO(updated));
}

// Remove an account from its event (design's removeSocial) — clears its token too.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return forbidden("Only Admins and Managers can manage integrations");
  }
  try {
    const removed = await prisma.socialAccount.delete({ where: { id: params.id } });
    await audit({
      action: "account.remove",
      actor: actorOf(ctx),
      target: `${removed.platform} ${removed.handle}`,
      ip: clientIp(req),
    });
    return json({ ok: true });
  } catch {
    return error("Account not found", 404);
  }
}
