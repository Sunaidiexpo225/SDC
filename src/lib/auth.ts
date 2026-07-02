import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { cookies } from "next/headers";
import { prisma } from "./db";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-change-me-please-0000000000",
);

export const SESSION_COOKIE = "sdc_session";
export const PENDING_COOKIE = "sdc_pending";

export interface SessionPayload {
  uid: string; // authenticated user
  acting?: string; // "acting as" user for permission demos (defaults to uid)
}
export interface PendingPayload {
  uid: string;
  step: "mfa";
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ uid: p.uid, acting: p.acting ?? p.uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function signPending(uid: string): Promise<string> {
  return new SignJWT({ uid, step: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verify<T>(token?: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
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

// TOTP helpers (RFC 6238 via otplib). In dev we also accept the demo code
// "123456" so the flow is exercisable without provisioning an authenticator.
export function newTotpSecret(): string {
  return authenticator.generateSecret();
}
export function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "Sunaidi Design Central", secret);
}
// Demo bypass: accept "123456" when AUTH_DEMO_BYPASS=1 (default on for the
// handoff build) or in development. Set AUTH_DEMO_BYPASS=0 for real production.
const demoBypassOn =
  process.env.AUTH_DEMO_BYPASS === "1" ||
  (process.env.AUTH_DEMO_BYPASS !== "0" && process.env.NODE_ENV !== "production");

export function verifyTotp(secret: string | null | undefined, token: string): boolean {
  const code = (token || "").replace(/\s/g, "");
  if (demoBypassOn && code === "123456") return true;
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
  return verify<SessionPayload>(token);
}

export async function requireSession(): Promise<SessionPayload | null> {
  return readSession();
}

export async function currentUsers() {
  const session = await readSession();
  if (!session) return { session: null, authUser: null, actingUser: null };
  const [authUser, actingUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.uid } }),
    prisma.user.findUnique({ where: { id: session.acting ?? session.uid } }),
  ]);
  return { session, authUser, actingUser: actingUser ?? authUser };
}
