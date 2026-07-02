import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { toUserDTO } from "@/lib/serialize";
import { hashPassword, newTotpSecret } from "@/lib/auth";

const PALETTE = ["#e0457b", "#17a99b", "#7c5cf0", "#2563eb", "#f59e0b", "#0ea5a3"];

const Body = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(["Admin", "Manager", "Editor", "Viewer"]).default("Editor"),
});

// Invite a teammate (design's sendInvite) — created with "invited" status.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid body", 400);

  const name = (parsed.data.name || "").trim() || "New user";
  const email = ((parsed.data.email || "").trim() || "invite@sunaidiexpo.com").toLowerCase();
  const init =
    (name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "NU").toUpperCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return error("A user with that email already exists", 409);

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      init,
      avColor: PALETTE[count % PALETTE.length],
      role: parsed.data.role,
      status: "invited",
      mfaEnabled: false,
      totpSecret: newTotpSecret(),
      passwordHash: await hashPassword("password"),
    },
  });
  return json(toUserDTO(user), 201);
}
