// DTOs exchanged over the REST API (JSON-serialisable shapes).

export type Role = "Admin" | "Manager" | "Editor" | "Viewer";
export type PostStatus = "scheduled" | "posted";
export type ApprovalStatus = "pending" | "approved" | "declined";
export type UserStatus = "active" | "invited";
export type RangeKey = "1d" | "7d" | "30d" | "90d" | "365d";

export interface AccountDTO {
  id: string;
  platform: string;
  handle: string;
  followers: number;
  connected: boolean;
  apiKey: string; // masked ("••••1234") for connected, "" otherwise
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
  format: string | null; // Image | Video | Reel
  mediaUrl: string | null; // /api/media/<id> when the post has an upload
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
  users: UserDTO[];
  settings: SettingDTO;
  session: SessionDTO;
}
