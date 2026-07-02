import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toAccountDTO } from "@/lib/serialize";

const Body = z.object({
  action: z.enum(["connect", "disconnect"]),
  apiKey: z.string().optional(),
});

// Connect / disconnect an account's API (design's connectApi / disconnectApi).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const account = await prisma.socialAccount.findUnique({ where: { id: params.id } });
  if (!account) return error("Account not found", 404);

  if (parsed.data.action === "connect") {
    const key = (parsed.data.apiKey || "").trim();
    if (!key) return error("API key is required", 400);
    const updated = await prisma.socialAccount.update({
      where: { id: account.id },
      data: { connected: true, apiKey: key },
    });
    return json(toAccountDTO(updated));
  }

  const updated = await prisma.socialAccount.update({
    where: { id: account.id },
    data: { connected: false },
  });
  return json(toAccountDTO(updated));
}

// Remove an account from its event (design's removeSocial) — clears its token too.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  try {
    await prisma.socialAccount.delete({ where: { id: params.id } });
    return json({ ok: true });
  } catch {
    return error("Account not found", 404);
  }
}
