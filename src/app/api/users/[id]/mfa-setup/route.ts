import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireAuth, json, error } from "@/lib/api";
import { newTotpSecret, totpUri } from "@/lib/auth";

// Returns the otpauth URI + a QR data-URL for the 2FA setup dialog.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await requireAuth();
  if (!ctx) return error("Not authenticated", 401);

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
