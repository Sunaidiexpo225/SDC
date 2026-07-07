import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, effectiveRole, roleCan, effectiveUserId } from "@/lib/api";
import { signOAuthState } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/linkedin/start?accountId=...
// Kicks off the LinkedIn OAuth 2.0 (3-legged) flow for a specific account.
// Redirects the browser to LinkedIn's consent screen; LinkedIn returns to
// /api/linkedin/callback with a code we exchange there.
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.redirect(new URL("/", req.url));
  if (!roleCan(effectiveRole(ctx), ["Admin", "Manager"])) {
    return NextResponse.redirect(new URL("/?li=forbidden", req.url));
  }

  const accountId = req.nextUrl.searchParams.get("accountId") || "";
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account || account.platform !== "linkedin") {
    return NextResponse.redirect(new URL("/?li=badaccount", req.url));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/?li=notconfigured", req.url));

  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI || `${req.nextUrl.origin}/api/linkedin/callback`;

  // State ties the callback back to this account + user (CSRF defence). Short TTL.
  const state = await signOAuthState({ accountId, uid: effectiveUserId(ctx) }, 600);

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // Two modes, chosen by env:
  //  • Member mode (default): openid + profile → member identity (person URN);
  //    w_member_social → post to the member's own feed.
  //  • Org mode (LINKEDIN_ORG_POSTING=1, a dedicated Community Management API
  //    app — that product must be the ONLY product on its LinkedIn app):
  //    r_organization_admin lists the Pages the member administers,
  //    w_organization_social posts as a Page. No openid here — the CMA app
  //    doesn't carry the Sign-In product, so we identify Pages via the admin
  //    scope instead of a person URN.
  const scope =
    process.env.LINKEDIN_ORG_POSTING === "1"
      ? "r_organization_admin w_organization_social"
      : "openid profile w_member_social";
  url.searchParams.set("scope", scope);

  return NextResponse.redirect(url);
}
