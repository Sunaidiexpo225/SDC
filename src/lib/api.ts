import { NextResponse } from "next/server";
import { prisma } from "./db";
import { currentUsers } from "./auth";
import {
  toEventDTO,
  toPostDTO,
  toApprovalDTO,
  toUserDTO,
  toSettingDTO,
} from "./serialize";
import type { AppData, Role } from "./types";

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
  const [events, posts, approvals, users, setting] = await Promise.all([
    prisma.event.findMany({
      orderBy: { order: "asc" },
      include: { accounts: { orderBy: { id: "asc" } } },
    }),
    prisma.post.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.approval.findMany({ orderBy: { id: "asc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    getSetting(),
  ]);
  return {
    events: events.map(toEventDTO),
    posts: posts.map(toPostDTO),
    approvals: approvals.map(toApprovalDTO),
    users: users.map(toUserDTO),
    settings: toSettingDTO(setting),
    session: {
      authenticated: !!session,
      userId: session?.uid ?? null,
      actingUserId: actingUser?.id ?? session?.uid ?? null,
    },
  };
}

// ---- guards ----
export async function requireAuth() {
  const ctx = await currentUsers();
  if (!ctx.session || !ctx.authUser) return null;
  return ctx;
}

export function roleCan(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}
