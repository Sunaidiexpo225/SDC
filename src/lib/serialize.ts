import type {
  Event as PEvent,
  SocialAccount,
  Post,
  Approval,
  User,
  Setting,
} from "@prisma/client";
import type {
  AccountDTO,
  EventDTO,
  PostDTO,
  ApprovalDTO,
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
    status: p.status as PostDTO["status"],
    format: p.format ?? null,
    mediaUrl: p.mediaId ? `/api/media/${p.mediaId}` : null,
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

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    init: u.init,
    avColor: u.avColor,
    role: u.role as Role,
    status: u.status as UserDTO["status"],
    mfaEnabled: u.mfaEnabled,
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
