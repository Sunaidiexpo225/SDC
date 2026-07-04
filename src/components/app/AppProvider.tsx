"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";
import { api } from "@/lib/client";
import {
  addDays,
  isoDate,
  todayMidnight,
} from "@/lib/format";
import { platformName, platformColor } from "@/lib/platforms";
import type {
  AppData,
  EventDTO,
  PostDTO,
  UserDTO,
  Role,
} from "@/lib/types";
import type { AssetType } from "@/lib/content";

export type Tab =
  | "dashboard"
  | "compose"
  | "calendar"
  | "library"
  | "analytics"
  | "team"
  | "admin";

export type StatRef =
  | { kind: "top"; ix: number }
  | { kind: "post"; id: string }
  | null;

interface UiState {
  tab: Tab;
  activeEventId: string;
  eventMenuOpen: boolean;
  addOpen: boolean;
  newName: string;
  newColor: string;
  caption: string;
  hashtags: string[];
  generating: boolean;
  genIdx: number;
  composeAsset: {
    name: string;
    dur: string;
    type: AssetType;
    mediaId?: string;
    url?: string;
    mime?: string;
  } | null;
  platforms: Record<string, boolean>;
  schedDay: string;
  schedTime: string;
  monthOffset: number;
  selectedPostId: string | null;
  reviewId: string | null;
  reviewCaption: string;
  libFilter: string;
  range: "1d" | "7d" | "30d" | "90d" | "365d";
  toast: string | null;
  adminSection: "users" | "events" | "integrations" | "settings";
  inviteOpen: boolean;
  invName: string;
  invEmail: string;
  invRole: Role;
  mfaUserId: string | null;
  mfaCode: string;
  mfaQr: string | null;
  actingMenuOpen: boolean;
  stat: StatRef;
  rangeMenuOpen: boolean;
  navOpen: boolean;
}

interface AppCtx {
  data: AppData;
  reload: () => Promise<void>;
  today: Date;
  // ui
  ui: UiState;
  patch: (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void;
  toast: (msg: string) => void;
  // derived
  events: EventDTO[];
  activeEvent: EventDTO;
  currentUser: UserDTO | undefined;
  canApprove: boolean;
  canDiscard: boolean;
  pname: (k: string) => string;
  pcolor: (k: string) => string;
  ev: (id: string) => EventDTO;
  // actions
  selectEvent: (id: string) => void;
  generate: () => void;
  schedule: () => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  createEvent: () => Promise<void>;
  renameEvent: (id: string, name: string) => Promise<void>;
  setEventColor: (id: string, color: string) => Promise<void>;
  addSocial: (eventId: string, platform: string) => Promise<void>;
  removeSocial: (accountId: string) => Promise<void>;
  connectApi: (accountId: string, key: string) => Promise<void>;
  disconnectApi: (accountId: string) => Promise<void>;
  setUserRole: (id: string, role: Role) => Promise<void>;
  resetMfa: (id: string) => Promise<void>;
  enableMfaOpen: (id: string) => Promise<void>;
  verifyMfa: () => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  sendInvite: () => Promise<void>;
  approvalAction: (
    action: "save" | "approve" | "decline" | "discard",
    caption?: string,
  ) => Promise<void>;
  actingAs: (userId: string) => Promise<void>;
  updateSettings: (patch: Partial<AppData["settings"]>) => Promise<void>;
  reuseAsset: (asset: { name: string; dur: string; type: AssetType }) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const today = useMemo(() => todayMidnight(), []);
  const adoptedLang = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const [ui, setUi] = useState<UiState>({
    tab: "dashboard",
    activeEventId: "",
    eventMenuOpen: false,
    addOpen: false,
    newName: "",
    newColor: "#7c5cf0",
    caption: "",
    hashtags: [],
    generating: false,
    genIdx: 0,
    composeAsset: null,
    platforms: {},
    schedDay: isoDate(addDays(todayMidnight(), 1)),
    schedTime: "18:00",
    monthOffset: 0,
    selectedPostId: null,
    reviewId: null,
    reviewCaption: "",
    libFilter: "All",
    range: "7d",
    toast: null,
    adminSection: "users",
    inviteOpen: false,
    invName: "",
    invEmail: "",
    invRole: "Editor",
    mfaUserId: null,
    mfaCode: "",
    mfaQr: null,
    actingMenuOpen: false,
    stat: null,
    rangeMenuOpen: false,
    navOpen: false,
  });

  const patch = useCallback(
    (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => {
      setUi((prev) => ({ ...prev, ...(typeof p === "function" ? p(prev) : p) }));
    },
    [],
  );

  const toast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setUi((p) => ({ ...p, toast: msg }));
    toastTimer.current = setTimeout(
      () => setUi((p) => ({ ...p, toast: null })),
      2600,
    );
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await api.get<AppData>("/api/app");
      setData(d);
      setUi((prev) => {
        const next = { ...prev };
        // default active event to the first if unset / stale
        if (!prev.activeEventId || !d.events.some((e) => e.id === prev.activeEventId)) {
          next.activeEventId = d.events[0]?.id ?? "";
        }
        return next;
      });
      // adopt server language once, if the user hasn't chosen one locally
      if (!adoptedLang.current) {
        adoptedLang.current = true;
        try {
          if (!localStorage.getItem("sdc_lang")) setLang(d.settings.lang);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setLoadError(true);
      router.replace("/login");
    }
  }, [router, setLang]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ---- derived ----
  const events = data?.events ?? [];
  const ev = useCallback(
    (id: string) => events.find((e) => e.id === id) || events[0],
    [events],
  );
  const activeEvent = ev(ui.activeEventId);
  const currentUser = useMemo(
    () =>
      data?.users.find((u) => u.id === data.session.actingUserId) ||
      data?.users.find((u) => u.role === "Admin") ||
      data?.users[0],
    [data],
  );
  const canApprove =
    !!currentUser && (currentUser.role === "Admin" || currentUser.role === "Manager");
  const canDiscard = !!currentUser && currentUser.role === "Editor";

  const pname = useCallback((k: string) => platformName(k, lang), [lang]);
  const pcolor = useCallback((k: string) => platformColor(k), []);

  // ---- actions ----
  const selectEvent = useCallback(
    (id: string) =>
      patch({
        activeEventId: id,
        eventMenuOpen: false,
        platforms: {},
        selectedPostId: null,
        monthOffset: 0,
      }),
    [patch],
  );

  const generate = useCallback(() => {
    setUi((p) => {
      if (p.generating) return p;
      return { ...p, generating: true };
    });
    const tone = data?.settings.tone || "punchy";
    (async () => {
      try {
        const [res] = await Promise.all([
          api.post<{ caption: string; hashtags: string[] }>("/api/ai/caption", {
            lang,
            tone,
            index: ui.genIdx,
          }),
          sleep(700),
        ]);
        setUi((p) => ({
          ...p,
          caption: res.caption,
          hashtags: res.hashtags,
          genIdx: p.genIdx + 1,
          generating: false,
        }));
      } catch {
        setUi((p) => ({ ...p, generating: false }));
      }
    })();
  }, [data, lang, ui.genIdx]);

  const schedule = useCallback(async () => {
    if (!data) return;
    const evt = ev(ui.activeEventId);
    const keys = evt.accounts
      .map((a) => a.platform)
      .filter((k) => ui.platforms[k] !== false);
    if (!ui.caption.trim() || !keys.length) return;
    const d = new Date(ui.schedDay + "T00:00:00");
    const offset =
      (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
    try {
      const post = await api.post<PostDTO>("/api/posts", {
        eventId: evt.id,
        date: ui.schedDay,
        time: ui.schedTime,
        caption: ui.caption,
        platforms: keys,
        ...(ui.composeAsset?.mediaId
          ? { mediaId: ui.composeAsset.mediaId, format: ui.composeAsset.type }
          : {}),
      });
      await reload();
      patch({
        tab: "calendar",
        monthOffset: offset,
        caption: "",
        hashtags: [],
        composeAsset: null,
        selectedPostId: post.id,
      });
      const { tr } = await import("@/lib/i18n");
      toast(tr(lang).toastSched(keys.length));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to schedule");
    }
  }, [data, ev, ui, today, reload, patch, toast, lang]);

  const deletePost = useCallback(
    async (id: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.del(`/api/posts/${id}`);
        await reload();
        patch({ selectedPostId: null });
        toast(tr(lang).toastDeleted);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, patch, toast, lang],
  );

  const createEvent = useCallback(async () => {
    const { tr } = await import("@/lib/i18n");
    try {
      const created = await api.post<EventDTO>("/api/events", {
        name: ui.newName,
        color: ui.newColor,
        lang,
      });
      await reload();
      patch({
        activeEventId: created.id,
        addOpen: false,
        newName: "",
        eventMenuOpen: false,
        platforms: {},
        selectedPostId: null,
        monthOffset: 0,
        tab: "dashboard",
      });
      toast(tr(lang).toastEventAdded);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    }
  }, [ui.newName, ui.newColor, lang, reload, patch, toast]);

  const renameEvent = useCallback(
    async (id: string, name: string) => {
      // optimistic local update for smooth typing
      setData((d) =>
        d
          ? {
              ...d,
              events: d.events.map((e) =>
                e.id === id ? { ...e, nameEn: name, nameAr: name } : e,
              ),
            }
          : d,
      );
      try {
        await api.patch(`/api/events/${id}`, { name });
      } catch {
        reload();
      }
    },
    [reload],
  );

  const setEventColor = useCallback(
    async (id: string, color: string) => {
      try {
        await api.patch(`/api/events/${id}`, { color });
        await reload();
      } catch {
        /* ignore */
      }
    },
    [reload],
  );

  const addSocial = useCallback(
    async (eventId: string, platform: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.post(`/api/events/${eventId}/accounts`, { platform });
        await reload();
        toast(tr(lang).toastAccountAdded);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const removeSocial = useCallback(
    async (accountId: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.del(`/api/accounts/${accountId}`);
        await reload();
        toast(tr(lang).toastAccountRemoved);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const connectApi = useCallback(
    async (accountId: string, key: string) => {
      if (!key.trim()) return;
      const { tr } = await import("@/lib/i18n");
      try {
        await api.patch(`/api/accounts/${accountId}`, { action: "connect", apiKey: key });
        await reload();
        toast(tr(lang).toastConnected);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const disconnectApi = useCallback(
    async (accountId: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.patch(`/api/accounts/${accountId}`, { action: "disconnect" });
        await reload();
        toast(tr(lang).toastDisconnected);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const setUserRole = useCallback(
    async (id: string, role: Role) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.patch(`/api/users/${id}`, { role });
        await reload();
        toast(tr(lang).toastRoleUpdated);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const resetMfa = useCallback(
    async (id: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.patch(`/api/users/${id}`, { action: "resetMfa" });
        await reload();
        toast(tr(lang).toastMfaReset);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const enableMfaOpen = useCallback(
    async (id: string) => {
      patch({ mfaUserId: id, mfaCode: "", mfaQr: null });
      try {
        const res = await api.get<{ qrDataUrl: string }>(`/api/users/${id}/mfa-setup`);
        patch({ mfaQr: res.qrDataUrl });
      } catch {
        /* leave QR empty */
      }
    },
    [patch],
  );

  const verifyMfa = useCallback(async () => {
    if (!ui.mfaUserId) return;
    const { tr } = await import("@/lib/i18n");
    try {
      await api.patch(`/api/users/${ui.mfaUserId}`, {
        action: "enableMfa",
        code: ui.mfaCode || "123456",
      });
      await reload();
      patch({ mfaUserId: null, mfaCode: "", mfaQr: null });
      toast(tr(lang).toastMfaOn);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invalid code");
    }
  }, [ui.mfaUserId, ui.mfaCode, reload, patch, toast, lang]);

  const removeUser = useCallback(
    async (id: string) => {
      const { tr } = await import("@/lib/i18n");
      try {
        await api.del(`/api/users/${id}`);
        await reload();
        toast(tr(lang).toastUserRemoved);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [reload, toast, lang],
  );

  const sendInvite = useCallback(async () => {
    const { tr } = await import("@/lib/i18n");
    try {
      await api.post("/api/users", {
        name: ui.invName,
        email: ui.invEmail,
        role: ui.invRole,
      });
      await reload();
      patch({ inviteOpen: false, invName: "", invEmail: "" });
      toast(tr(lang).toastInvited);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed");
    }
  }, [ui.invName, ui.invEmail, ui.invRole, reload, patch, toast, lang]);

  const approvalAction = useCallback(
    async (action: "save" | "approve" | "decline" | "discard", caption?: string) => {
      if (!ui.reviewId) return;
      const { tr } = await import("@/lib/i18n");
      const t = tr(lang);
      try {
        await api.patch(`/api/approvals/${ui.reviewId}`, { action, caption });
        await reload();
        if (action === "save") {
          toast(t.toastSaved);
        } else {
          patch({ reviewId: null });
          if (action === "approve") toast(t.toastApproved);
          else if (action === "decline") toast(t.toastDeclined);
          else toast(t.toastDiscarded);
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed");
      }
    },
    [ui.reviewId, reload, patch, toast, lang],
  );

  const actingAs = useCallback(
    async (userId: string) => {
      try {
        await api.post("/api/auth/acting", { userId });
        await reload();
        patch({ actingMenuOpen: false });
      } catch {
        /* ignore */
      }
    },
    [reload, patch],
  );

  const updateSettings = useCallback(
    async (p: Partial<AppData["settings"]>) => {
      // optimistic
      setData((d) => (d ? { ...d, settings: { ...d.settings, ...p } } : d));
      if (p.lang) setLang(p.lang);
      try {
        await api.patch("/api/settings", p);
      } catch {
        reload();
      }
    },
    [reload, setLang],
  );

  const reuseAsset = useCallback(
    (asset: { name: string; dur: string; type: AssetType }) => {
      import("@/lib/i18n").then(({ tr }) => {
        patch({ composeAsset: asset, tab: "compose", selectedPostId: null });
        toast(tr(lang).toastAdded);
      });
    },
    [patch, toast, lang],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* ignore */
    }
    router.push("/");
  }, [router]);

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#8b93a1",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
        }}
      >
        {loadError ? "Redirecting to sign in…" : "Loading…"}
      </div>
    );
  }

  const value: AppCtx = {
    data,
    reload,
    today,
    ui,
    patch,
    toast,
    events,
    activeEvent,
    currentUser,
    canApprove,
    canDiscard,
    pname,
    pcolor,
    ev,
    selectEvent,
    generate,
    schedule,
    deletePost,
    createEvent,
    renameEvent,
    setEventColor,
    addSocial,
    removeSocial,
    connectApi,
    disconnectApi,
    setUserRole,
    resetMfa,
    enableMfaOpen,
    verifyMfa,
    removeUser,
    sendInvite,
    approvalAction,
    actingAs,
    updateSettings,
    reuseAsset,
    logout,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
