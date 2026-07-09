import type {
  Event as PEvent,
  SocialAccount,
  Post,
  Approval,
  Task,
  User,
  EventMember,
  Setting,
} from "@prisma/client";
import type {
  AccountDTO,
  EventDTO,
  PostDTO,
  ApprovalDTO,
  TaskDTO,
  UserDTO,
  SettingDTO,
  Role,
} from "./types";

export function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  return "••••••••••••" + key.slice(-4);
}

export function toAccountDTO(a: SocialAccount): AccountDTO {
  return {
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    followers: a.followers,
    connected: a.connected,
    apiKey: a.connected ? maskKey(a.apiKey) : "",
    externalId: a.externalId ?? null,
  };
}

export function toEventDTO(e: PEvent & { accounts: SocialAccount[] }): EventDTO {
  return {
    id: e.id,
    slug: e.slug,
    nameEn: e.nameEn,
    nameAr: e.nameAr,
    color: e.color,
    aliases: e.aliases ? e.aliases.split(",").map((a) => a.trim()).filter(Boolean) : [],
    barIx: e.barIx,
    order: e.order,
    accounts: e.accounts.map(toAccountDTO),
  };
}

export function toPostDTO(p: Post): PostDTO {
  return {
    id: p.id,
    eventId: p.eventId,
    date: p.date,
    time: p.time,
    titleEn: p.titleEn,
    titleAr: p.titleAr,
    captionEn: p.captionEn,
    captionAr: p.captionAr,
    platforms: p.platformsCsv ? p.platformsCsv.split(",") : [],
    // "publishing" is a transient in-flight lock — present it as scheduled.
    status: (p.status === "posted" ? "posted" : "scheduled") as PostDTO["status"],
    approval: (p.approval ?? "pending") as PostDTO["approval"],
    format: p.format ?? null,
    mediaId: p.mediaId ?? null,
    mediaUrl: p.mediaId ? `/api/media/${p.mediaId}` : null,
    assigneeId: p.assigneeId ?? null,
    completed: p.completed ?? false,
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    completedById: p.completedById ?? null,
  };
}

export function toTaskDTO(tk: Task): TaskDTO {
  return {
    id: tk.id,
    eventId: tk.eventId ?? null,
    title: tk.title,
    notes: tk.notes ?? null,
    assigneeId: tk.assigneeId ?? null,
    dueDate: tk.dueDate ?? null,
    priority: tk.priority as TaskDTO["priority"],
    status: tk.status as TaskDTO["status"],
    completedAt: tk.completedAt ? tk.completedAt.toISOString() : null,
    completedById: tk.completedById ?? null,
    createdById: tk.createdById ?? null,
    createdAt: tk.createdAt.toISOString(),
  };
}

export function toApprovalDTO(a: Approval): ApprovalDTO {
  return {
    id: a.id,
    eventId: a.eventId,
    whoEn: a.whoEn,
    whoAr: a.whoAr,
    init: a.init,
    avColor: a.avColor,
    titleEn: a.titleEn,
    titleAr: a.titleAr,
    captionEn: a.captionEn,
    captionAr: a.captionAr,
    platforms: a.platformsCsv ? a.platformsCsv.split(",") : [],
    whenLabel: a.whenLabel,
    status: a.status as ApprovalDTO["status"],
    editedCaption: a.editedCaption,
  };
}

export function toUserDTO(u: User & { eventAccess?: EventMember[] }): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    init: u.init,
    avColor: u.avColor,
    role: u.role as Role,
    status: u.status as UserDTO["status"],
    mfaEnabled: u.mfaEnabled,
    eventIds: (u.eventAccess ?? []).map((m) => m.eventId),
  };
}

export function toSettingDTO(s: Setting): SettingDTO {
  return {
    requireMfa: s.requireMfa,
    autoPublish: s.autoPublish,
    weekStartsMonday: s.weekStartsMonday,
    tone: s.tone as SettingDTO["tone"],
    lang: s.lang as SettingDTO["lang"],
  };
}
