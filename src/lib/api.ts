import { NextResponse } from "next/server";
import { prisma } from "./db";
import { currentUsers } from "./auth";
import {
  toEventDTO,
  toPostDTO,
  toApprovalDTO,
  toTaskDTO,
  toUserDTO,
  toSettingDTO,
} from "./serialize";
import { GLOBAL_ROLES, type AppData, type Role } from "./types";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getSetting() {
  let s = await prisma.setting.findUnique({ where: { id: 1 } });
  if (!s) s = await prisma.setting.create({ data: { id: 1 } });
  return s;
}

// Full application snapshot for the authenticated client.
export async function loadAppData(): Promise<AppData> {
  const { ensureSeeded } = await import("./seedData");
  await ensureSeeded();
  const { session, actingUser } = await currentUsers();
  const [events, posts, approvals, tasks, users, setting] = await Promise.all([
    prisma.event.findMany({
      orderBy: { order: "asc" },
      include: { accounts: { orderBy: { id: "asc" } } },
    }),
    prisma.post.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.approval.findMany({ orderBy: { id: "asc" } }),
    prisma.task.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { eventAccess: true } }),
    getSetting(),
  ]);

  // Event-scoped users (Assistant Manager / Editor / Viewer) only receive the
  // events they're a member of, and the posts/approvals/tasks under them.
  const allowed = await accessibleEventIds(actingUser);
  const canSee = (eventId: string | null | undefined) =>
    allowed === null || (!!eventId && allowed.includes(eventId));
  const visEvents = allowed === null ? events : events.filter((e) => canSee(e.id));

  return {
    events: visEvents.map(toEventDTO),
    posts: posts.filter((p) => canSee(p.eventId)).map(toPostDTO),
    approvals: approvals.filter((a) => canSee(a.eventId)).map(toApprovalDTO),
    // Tasks with no event are visible to everyone; event-tied tasks follow access.
    tasks: tasks.filter((tk) => tk.eventId === null || canSee(tk.eventId)).map(toTaskDTO),
    users: users.map(toUserDTO),
    settings: toSettingDTO(setting),
    session: {
      authenticated: !!session,
      userId: session?.uid ?? null,
      actingUserId: actingUser?.id ?? session?.uid ?? null,
    },
    autoPublishConfigured: !!process.env.CRON_SECRET,
  };
}

// ---- guards ----
type Ctx = NonNullable<Awaited<ReturnType<typeof requireAuth>>>;

export async function requireAuth() {
  const ctx = await currentUsers();
  if (!ctx.session || !ctx.authUser) return null;
  return ctx;
}

export function roleCan(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

// The set of event ids a user may access, or null for "all" (global roles:
// Admin / Manager). Event-scoped roles resolve to their EventMember rows.
export async function accessibleEventIds(
  user: { id: string; role: string } | null | undefined,
): Promise<string[] | null> {
  if (!user) return [];
  if (GLOBAL_ROLES.includes(user.role as Role)) return null;
  const rows = await prisma.eventMember.findMany({
    where: { userId: user.id },
    select: { eventId: true },
  });
  return rows.map((r) => r.eventId);
}

// True when the effective (acting) user may act on the given event.
export async function canAccessEvent(ctx: Ctx, eventId: string): Promise<boolean> {
  const allowed = await accessibleEventIds(ctx.actingUser ?? ctx.authUser);
  return allowed === null || allowed.includes(eventId);
}

// The role permission checks run against: the "acting as" user in demo mode,
// otherwise the authenticated user (currentUsers() already collapses these
// outside demo mode, so this is simply the effective role).
export function effectiveRole(ctx: Ctx): Role | undefined {
  return ctx.actingUser?.role as Role | undefined;
}

// The effective identity — the "acting as" user in demo mode, otherwise the
// authenticated user. Used for "is this me?" checks (own MFA setup, self-
// delete guard) so they track the identity the app is presenting.
export function effectiveUserId(ctx: Ctx): string {
  return ctx.actingUser?.id ?? ctx.authUser!.id;
}

export function forbidden(message = "You don't have permission to do that") {
  return error(message, 403);
}
