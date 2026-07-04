import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toUserDTO } from "@/lib/serialize";
import { hashPassword, newTotpSecret } from "@/lib/auth";

const PALETTE = ["#e0457b", "#17a99b", "#7c5cf0", "#2563eb", "#f59e0b", "#0ea5a3"];

const Body = z.object({
  name: z.string().optional(),
  email: z.string().email("A valid email is required"),
  role: z.enum(["Admin", "Manager", "Editor", "Viewer"]).default("Editor"),
});

// Invite a teammate (design's sendInvite) — created with "invited" status.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin"])) {
    return forbidden("Only Admins can invite teammates");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("A valid name and email are required", 400);

  const name = (parsed.data.name || "").trim() || "New user";
  const email = parsed.data.email.trim().toLowerCase();
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
      // A random, unusable password — invited users can't sign in until a real
      // accept-invite / password-set flow is wired up. Never a shared default.
      passwordHash: await hashPassword(randomBytes(24).toString("hex")),
    },
  });
  return json(toUserDTO(user), 201);
}
