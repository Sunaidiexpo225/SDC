import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireAuth, json, error, forbidden, effectiveRole, effectiveUserId, roleCan } from "@/lib/api";
import { newTotpSecret, totpUri } from "@/lib/auth";

// Returns the otpauth URI + a QR data-URL for the 2FA setup dialog.
//
// The otpauth URI embeds the TOTP secret, so this is restricted to the
// account owner (setting up their own 2FA) or an Admin — otherwise any user
// could read another user's secret and defeat their second factor.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

  const isSelf = effectiveUserId(ctx) === params.id;
  if (!isSelf && !roleCan(effectiveRole(ctx), ["Admin"])) return forbidden();

  let user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return error("User not found", 404);

  if (!user.totpSecret) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: newTotpSecret() },
    });
  }

  const uri = totpUri(user.email, user.totpSecret!);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return json({ otpauthUri: uri, qrDataUrl });
}
