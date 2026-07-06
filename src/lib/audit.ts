// Audit trail + structured error logging.
//
// audit()    — records a security-relevant event (logins, user/role changes,
//              integration connects, publishes, …) to the AuditLog table.
// logError() — records an unexpected server error, both to Vercel's function
//              logs (console.error) and, best-effort, to the same table.
//
// Both are best-effort: a logging failure is swallowed so it can never break
// the action that triggered it.

import { prisma } from "./db";

export type AuditLevel = "info" | "warning" | "error";

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  action: string;
  actor?: AuditActor | null;
  target?: string | null;
  detail?: string | null;
  level?: AuditLevel;
  ip?: string | null;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actor?.id ?? null,
        actorEmail: entry.actor?.email ?? null,
        actorRole: entry.actor?.role ?? null,
        target: entry.target ? entry.target.slice(0, 300) : null,
        detail: entry.detail ? entry.detail.slice(0, 1000) : null,
        level: entry.level ?? "info",
        ip: entry.ip ?? null,
      },
    });
  } catch (e) {
    // Never let logging break the request — fall back to the console.
    console.error("[audit] failed to persist", entry.action, e);
  }
}

export async function logError(
  context: string,
  err: unknown,
  actor?: AuditActor | null,
  ip?: string | null,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[error] ${context}: ${message}`, stack || "");
  await audit({ action: "error", target: context, detail: message, level: "error", actor, ip });
}

// Pull the acting identity out of a requireAuth() context.
export function actorOf(
  ctx: { authUser?: { id: string; email: string; role: string } | null } | null,
): AuditActor {
  return {
    id: ctx?.authUser?.id ?? null,
    email: ctx?.authUser?.email ?? null,
    role: ctx?.authUser?.role ?? null,
  };
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export function clientIp(req: { headers: Headers }): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
