import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { cookies } from "next/headers";
import { prisma } from "./db";

// AUTH_SECRET signs session cookies. It MUST be set in production — falling
// back to a hardcoded default there would let anyone forge sessions, so we
// require it. Resolved lazily (on first sign/verify) rather than at module
// load, so a missing value surfaces as a clear runtime error on the auth path
// instead of crashing the build when Next imports route modules.
let _secret: Uint8Array | null = null;
function sessionSecret(): Uint8Array {
  if (_secret) return _secret;
  const s = process.env.AUTH_SECRET;
  if (s) return (_secret = new TextEncoder().encode(s));
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production — set it to a long random string.",
    );
  }
  return (_secret = new TextEncoder().encode("dev-secret-change-me-please-0000000000"));
}

export const SESSION_COOKIE = "sdc_session";
export const PENDING_COOKIE = "sdc_pending";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const PENDING_MAX_AGE = 600; // 10 minutes

// Demo mode enables the handoff conveniences that must NEVER be on for real
// data: the "123456" TOTP bypass, the passwordless SSO shortcut, and the
// "acting as" role switcher. On by default off-production; set
// AUTH_DEMO_BYPASS=0 (or run in production without it) to turn them all off.
// Demo conveniences are NEVER enabled in production, regardless of
// AUTH_DEMO_BYPASS, so the "123456" TOTP bypass / passwordless SSO / acting-as
// can't be switched on against real data by a stray env var.
export const DEMO_MODE =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEMO_BYPASS !== "0";

// Shared cookie options — Secure in production so the session never travels
// over plaintext HTTP.
export function authCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export interface SessionPayload {
  uid: string; // authenticated user
  acting?: string; // "acting as" user for permission demos (defaults to uid)
  typ?: string; // token purpose — "session" for a fully authenticated session
}
export interface PendingPayload {
  uid: string;
  step: "mfa";
  typ?: string; // "pending" — pre-2FA, must NOT be accepted as a session
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ uid: p.uid, acting: p.acting ?? p.uid, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret());
}

export async function signPending(uid: string): Promise<string> {
  return new SignJWT({ uid, step: "mfa", typ: "pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(sessionSecret());
}

export async function verify<T>(token?: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    return payload as T;
  } catch {
    return null;
  }
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// TOTP helpers (RFC 6238 via otplib). In demo mode we also accept the demo
// code "123456" so the flow is exercisable without provisioning an
// authenticator.
export function newTotpSecret(): string {
  return authenticator.generateSecret();
}
export function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "Sunaidi Design Central", secret);
}

export function verifyTotp(
  secret: string | null | undefined,
  token: string,
): boolean {
  const code = (token || "").replace(/\s/g, "");
  if (DEMO_MODE && code === "123456") return true;
  if (!secret) return false;
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}

// ---- Session accessors (route handlers) ---------------------------------

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verify<SessionPayload>(token);
  // Only a fully authenticated session token counts. A pre-2FA "pending" token
  // is signed with the same secret but must never be accepted as a session,
  // otherwise the TOTP step could be skipped by replaying it as sdc_session.
  if (!payload || payload.typ !== "session") return null;
  return payload;
}

export async function requireSession(): Promise<SessionPayload | null> {
  return readSession();
}

export async function currentUsers() {
  const session = await readSession();
  if (!session) return { session: null, authUser: null, actingUser: null };
  // "Acting as" only takes effect in demo mode. Outside it the effective user
  // is always the authenticated user, so a stale/forged `acting` claim in the
  // token cannot escalate privileges in production.
  const actingId = DEMO_MODE ? (session.acting ?? session.uid) : session.uid;
  const [authUser, actingUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.uid } }),
    prisma.user.findUnique({ where: { id: actingId } }),
  ]);
  return { session, authUser, actingUser: actingUser ?? authUser };
}
