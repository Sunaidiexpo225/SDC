import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api";
import { verifyOAuthState } from "@/lib/auth";
import { audit, actorOf, clientIp } from "@/lib/audit";

export const runtime = "nodejs";

// GET /api/linkedin/callback?code=...&state=...
// Completes the LinkedIn OAuth flow: exchanges the code for an access token,
// resolves the member's URN via OpenID userinfo, and stores both on the
// account so it can publish.
export async function GET(req: NextRequest) {
  const back = (status: string) => NextResponse.redirect(new URL(`/?li=${status}`, req.url));

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return back("denied");

  const code = params.get("code") || "";
  const state = params.get("state") || "";
  if (!code || !state) return back("badcallback");

  const claims = await verifyOAuthState(state);
  if (!claims?.accountId) return back("badstate");
  const accountId = String(claims.accountId);

  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "linkedin") return back("badaccount");

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) return back("notconfigured");
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI || `${req.nextUrl.origin}/api/linkedin/callback`;

  try {
    // 1. Exchange the authorization code for an access token.
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const token = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !token?.access_token) {
      return back("tokenfail");
    }
    const accessToken: string = token.access_token;

    // 2. Resolve the member's URN + name from OpenID userinfo.
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = await meRes.json().catch(() => null);
    if (!meRes.ok || !me?.sub) {
      return back("nomember");
    }
    const authorUrn = `urn:li:person:${me.sub}`;
    const name: string = me.name || me.given_name || "LinkedIn member";

    // 3. Store the token + member URN on the account. apiKey (masked in DTOs)
    //    holds the token; externalId holds the author URN used to publish.
    const updated = await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        connected: true,
        apiKey: accessToken,
        externalId: authorUrn,
        handle: name,
      },
    });

    const ctx = await requireAuth();
    await audit({
      action: "account.connect",
      actor: actorOf(ctx),
      target: `linkedin ${updated.handle}`,
      detail: `urn=${authorUrn}`,
      ip: clientIp(req),
    });

    return back("connected");
  } catch {
    return back("tokenfail");
  }
}
