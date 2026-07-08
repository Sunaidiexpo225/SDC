import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, roleCan } from "@/lib/api";
import { toUserDTO } from "@/lib/serialize";
import { hashPassword, newTotpSecret } from "@/lib/auth";
import { audit, actorOf, clientIp } from "@/lib/audit";

const PALETTE = ["#e0457b", "#17a99b", "#7c5cf0", "#2563eb", "#f59e0b", "#0ea5a3"];

const Body = z.object({
  name: z.string().optional(),
  email: z.string().email("A valid email is required"),
  role: z.enum(["Admin", "Manager", "AsstManager", "Editor", "Viewer"]).default("Editor"),
  password: z.string().optional(),
});

// Create a teammate's account. Admins provide a temporary password, which makes
// the account "active" so the person can sign in immediately (they can change
// it / set up their own 2FA afterwards). Omitting the password creates a
// pending "invited" record with an unusable random password.
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);
  if (!roleCan(effectiveRole(ctx), ["Admin"])) {
    return forbidden("Only Admins can create users");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("A valid name and email are required", 400);

  const name = (parsed.data.name || "").trim() || "New user";
  const email = parsed.data.email.trim().toLowerCase();
  const password = (parsed.data.password || "").trim();
  const init =
    (name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "NU").toUpperCase();

  // A supplied password activates the account; enforce a minimum length.
  let status = "invited";
  let passwordHash: string;
  if (password) {
    if (password.length < 8) {
      return error("Password must be at least 8 characters", 400);
    }
    status = "active";
    passwordHash = await hashPassword(password);
  } else {
    passwordHash = await hashPassword(randomBytes(24).toString("hex"));
  }

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
      status,
      mfaEnabled: false,
      totpSecret: newTotpSecret(),
      passwordHash,
    },
  });
  await audit({
    action: "user.create",
    actor: actorOf(ctx),
    target: user.email,
    detail: `role=${user.role}, status=${status}`,
    ip: clientIp(req),
  });
  return json(toUserDTO(user), 201);
}
