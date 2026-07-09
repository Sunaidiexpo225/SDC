// DTOs exchanged over the REST API (JSON-serialisable shapes).

export type Role = "Admin" | "Manager" | "AsstManager" | "Editor" | "Viewer";
export type PostStatus = "scheduled" | "posted";
export type ApprovalStatus = "pending" | "approved" | "declined";
export type UserStatus = "active" | "invited";
export type TaskStatus = "open" | "in_progress" | "completed";
export type TaskPriority = "low" | "normal" | "high";
export type RangeKey = "1d" | "7d" | "30d" | "90d" | "365d";

// Roles whose access is global (see/manage every event). Everyone else is
// event-scoped — they only see the events they're a member of.
export const GLOBAL_ROLES: Role[] = ["Admin", "Manager"];

export interface AccountDTO {
  id: string;
  platform: string;
  handle: string;
  followers: number;
  connected: boolean;
  apiKey: string; // masked ("••••1234") for connected, "" otherwise
  externalId: string | null; // platform account id (not secret) for publishing
}

export interface EventDTO {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  color: string;
  barIx: number;
  order: number;
  accounts: AccountDTO[];
}

export interface PostDTO {
  id: string;
  eventId: string;
  date: string;
  time: string;
  titleEn: string;
  titleAr: string;
  captionEn: string;
  captionAr: string;
  platforms: string[];
  status: PostStatus;
  approval: "pending" | "approved" | "declined";
  format: string | null; // Image | Video | Reel
  mediaId: string | null; // media row id when the post has an upload
  mediaUrl: string | null; // /api/media/<id> when the post has an upload
  assigneeId: string | null; // team member responsible for this post
  completed: boolean; // production done (separate from published)
  completedAt: string | null; // ISO timestamp
  completedById: string | null;
}

export interface TaskDTO {
  id: string;
  eventId: string | null;
  title: string;
  notes: string | null;
  assigneeId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null; // ISO timestamp
  completedById: string | null;
  createdById: string | null;
  createdAt: string; // ISO timestamp
}

export interface ApprovalDTO {
  id: string;
  eventId: string;
  whoEn: string;
  whoAr: string;
  init: string;
  avColor: string;
  titleEn: string;
  titleAr: string;
  captionEn: string;
  captionAr: string;
  platforms: string[];
  whenLabel: string;
  status: ApprovalStatus;
  editedCaption: string | null;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  init: string;
  avColor: string;
  role: Role;
  status: UserStatus;
  mfaEnabled: boolean;
  eventIds: string[]; // events this user can access (empty ⇒ all, for global roles)
}

export interface SettingDTO {
  requireMfa: boolean;
  autoPublish: boolean;
  weekStartsMonday: boolean;
  tone: "punchy" | "professional" | "friendly";
  lang: "en" | "ar";
}

export interface SessionDTO {
  authenticated: boolean;
  userId: string | null;
  actingUserId: string | null;
}

export interface AppData {
  events: EventDTO[];
  posts: PostDTO[];
  approvals: ApprovalDTO[];
  tasks: TaskDTO[];
  users: UserDTO[];
  settings: SettingDTO;
  session: SessionDTO;
  autoPublishConfigured: boolean; // CRON_SECRET is set ⇒ the auto-publish cron can run
}
