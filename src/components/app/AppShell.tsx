"use client";

import { useApp } from "./AppProvider";
import { useLang } from "../LangProvider";
import { Hov } from "../ui";
import { s } from "@/lib/style";
import { fmt } from "@/lib/format";
import { roleLabelOf } from "./helpers";

import Dashboard from "./screens/Dashboard";
import Compose from "./screens/Compose";
import Calendar from "./screens/Calendar";
import Library from "./screens/Library";
import Analytics from "./screens/Analytics";
import Approvals from "./screens/Approvals";
import Admin from "./screens/Admin";

import InviteModal from "./modals/InviteModal";
import MfaModal from "./modals/MfaModal";
import AddEventModal from "./modals/AddEventModal";
import ReviewModal from "./modals/ReviewModal";
import PostStatModal from "./modals/PostStatModal";

export default function AppShell() {
  const app = useApp();
  const { t, lang, dir, setLang } = useLang();
  const { ui, patch, data, events, activeEvent, currentUser } = app;

  const pendingByEvent: Record<string, number> = {};
  events.forEach((e) => {
    pendingByEvent[e.id] = data.approvals.filter(
      (a) => a.eventId === e.id && a.status === "pending",
    ).length;
  });

  const tabDefs: [typeof ui.tab, string][] = [
    ["dashboard", t.tabDashboard],
    ["compose", t.tabCompose],
    ["calendar", t.tabCalendar],
    ["library", t.tabLibrary],
    ["analytics", t.tabAnalytics],
    ["team", t.tabTeam],
  ];

  const LangPill = () => (
    <div style={s("display:flex;gap:2px;background:#f4f6f9;border:1px solid #e3e8ef;border-radius:999px;padding:3px")}>
      {(["en", "ar"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} style={s(`border:none;cursor:pointer;background:${lang === l ? "#0f172a" : "transparent"};color:${lang === l ? "#fff" : "#5c6675"};font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit`)}>{l === "en" ? "EN" : "عربي"}</button>
      ))}
    </div>
  );

  const activeName = lang === "ar" ? activeEvent?.nameAr : activeEvent?.nameEn;

  return (
    <div dir={dir} style={s("height:100vh;display:flex;flex-direction:column;background:#f4f6f9;overflow:hidden")}>
      {/* top bar */}
      <div style={s("display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:58px;background:#fff;border-bottom:1px solid #e3e8ef;flex:none")}>
        <div style={s("display:flex;align-items:center;gap:10px")}>
          <div style={s("width:28px;height:28px;border-radius:8px;background:#2563eb;display:grid;place-items:center;color:#fff;font-family:var(--grotesk);font-weight:700;font-size:15px")}>✦</div>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:16px;letter-spacing:-.2px")}>{t.brand}</div>
        </div>
        <div style={s("display:flex;align-items:center;gap:12px")}>
          <LangPill />
          <Hov tag="button" onClick={app.logout} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#5c6675;font-weight:600;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit" hover="border-color:#2563eb;color:#2563eb">{t.backToSite}</Hov>
          <div style={s("position:relative")}>
            <Hov tag="button" onClick={() => patch({ actingMenuOpen: !ui.actingMenuOpen })} css="display:flex;align-items:center;gap:8px;border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:4px 12px 4px 4px;border-radius:999px;font-family:inherit" hover="border-color:#c8d0dc">
              <span style={s(`width:30px;height:30px;border-radius:50%;background:${currentUser?.avColor || "#94a3b8"};display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px`)}>{currentUser?.init || "?"}</span>
              <span style={s("font-size:12px;font-weight:700;color:#0f172a")}>{currentUser ? roleLabelOf(currentUser.role, t) : ""}</span>
              <span style={s("font-size:9px;color:#8b93a1")}>▼</span>
            </Hov>
            {ui.actingMenuOpen && (
              <div style={s("position:absolute;top:calc(100% + 6px);inset-inline-end:0;width:230px;background:#fff;border:1px solid #e3e8ef;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.18);padding:6px;z-index:40")}>
                <div style={s("font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a3abb8;padding:6px 8px")}>{t.actingAs}</div>
                {data.users.map((m) => (
                  <Hov key={m.id} tag="button" onClick={() => app.actingAs(m.id)} css={`width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:none;cursor:pointer;background:${m.id === data.session.actingUserId ? "#f4f6f9" : "transparent"};padding:8px;border-radius:10px;font-family:inherit;text-align:start`} hover="background:#f4f6f9">
                    <span style={s(`width:28px;height:28px;border-radius:50%;background:${m.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex:none`)}>{m.init}</span>
                    <span style={s("flex:1;min-width:0")}>
                      <span style={s("display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{m.name}</span>
                      <span style={s("display:block;font-size:11px;color:#8b93a1")}>{roleLabelOf(m.role, t)}</span>
                    </span>
                  </Hov>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={s("flex:1;display:flex;min-height:0")}>
        {/* sidebar */}
        <div style={s("width:224px;flex:none;background:#fff;border-inline-end:1px solid #e3e8ef;padding:16px 12px;display:flex;flex-direction:column;gap:4px")}>
          <div style={s("font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3abb8;padding:0 6px 8px")}>{t.managing}</div>
          <div style={s("position:relative;margin-bottom:12px")}>
            <Hov tag="button" onClick={() => patch({ eventMenuOpen: !ui.eventMenuOpen })} css="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:10px 12px;border-radius:12px;font-family:inherit" hover="border-color:#c8d0dc">
              <span style={s(`width:11px;height:11px;border-radius:50%;background:${activeEvent?.color};flex:none`)} />
              <span style={s("flex:1;text-align:start;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700")}>{activeName}</span>
              <span style={s("color:#8b93a1;font-size:10px;flex:none")}>▼</span>
            </Hov>
            {ui.eventMenuOpen && (
              <div style={s("position:absolute;top:calc(100% + 6px);inset-inline-start:0;width:100%;box-sizing:border-box;background:#fff;border:1px solid #e3e8ef;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.18);padding:6px;z-index:40")}>
                {events.map((e) => {
                  const foll = fmt(e.accounts.reduce((sm, a) => sm + a.followers, 0));
                  return (
                    <Hov key={e.id} tag="button" onClick={() => app.selectEvent(e.id)} css={`width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:none;cursor:pointer;background:${e.id === ui.activeEventId ? "#f4f6f9" : "transparent"};padding:9px 10px;border-radius:10px;font-family:inherit;text-align:start`} hover="background:#f4f6f9">
                      <span style={s(`width:9px;height:9px;border-radius:50%;background:${e.color};flex:none`)} />
                      <span style={s("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600")}>{lang === "ar" ? e.nameAr : e.nameEn}</span>
                      <span style={s("font-size:11px;color:#8b93a1;flex:none")}>{foll}</span>
                    </Hov>
                  );
                })}
                <div style={s("height:1px;background:#eef1f5;margin:6px 4px")} />
                <Hov tag="button" onClick={() => patch({ addOpen: true, eventMenuOpen: false, newName: "" })} css="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:none;cursor:pointer;background:transparent;padding:9px 10px;border-radius:10px;font-family:inherit;text-align:start;color:#2563eb;font-size:13px;font-weight:700" hover="background:#eef2f8">{t.addEvent}</Hov>
              </div>
            )}
          </div>

          {tabDefs.map(([key, label]) => {
            const active = ui.tab === key;
            const hasBadge = key === "team" && pendingByEvent[ui.activeEventId] > 0;
            return (
              <Hov key={key} tag="button" onClick={() => patch({ tab: key, selectedPostId: null, eventMenuOpen: false })} css={`display:flex;align-items:center;gap:10px;border:none;cursor:pointer;text-align:start;background:${active ? "#eef2f8" : "transparent"};color:${active ? "#2563eb" : "#3d4757"};font-weight:${active ? 700 : 600};font-size:14px;padding:11px 14px;border-radius:12px;font-family:inherit`} hover="background:#eef2f8">
                <span style={s(`width:8px;height:8px;border-radius:50%;background:${active ? "#2563eb" : "#c8d0dc"};flex:none`)} />
                <span style={s("flex:1")}>{label}</span>
                {hasBadge && (
                  <span style={s("background:#e0457b;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:grid;place-items:center;flex:none")}>{pendingByEvent[ui.activeEventId]}</span>
                )}
              </Hov>
            );
          })}

          <div style={s("height:1px;background:#eef1f5;margin:10px 6px 8px")} />
          <div style={s("font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3abb8;padding:0 6px 6px")}>{t.workspace}</div>
          <Hov tag="button" onClick={() => patch({ tab: "admin", eventMenuOpen: false, selectedPostId: null })} css={`display:flex;align-items:center;gap:10px;border:none;cursor:pointer;text-align:start;background:${ui.tab === "admin" ? "#eef2f8" : "transparent"};color:${ui.tab === "admin" ? "#2563eb" : "#3d4757"};font-weight:600;font-size:14px;padding:11px 14px;border-radius:12px;font-family:inherit`} hover="background:#eef2f8">
            <span style={s(`width:8px;height:8px;border-radius:50%;background:${ui.tab === "admin" ? "#2563eb" : "#c8d0dc"};flex:none`)} />
            <span style={s("flex:1")}>{t.tabAdmin}</span>
          </Hov>

          <div style={s("margin-top:auto;background:#f4f6f9;border-radius:14px;padding:14px")}>
            <div style={s("font-size:12px;font-weight:700;margin-bottom:8px")}>{t.connected}</div>
            <div style={s("display:flex;flex-direction:column;gap:6px")}>
              {activeEvent?.accounts.map((a) => (
                <div key={a.id} style={s("display:flex;align-items:center;gap:8px")}>
                  <span style={s(`width:8px;height:8px;border-radius:50%;background:${app.pcolor(a.platform)};flex:none`)} />
                  <span dir="ltr" style={s("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;color:#5c6675;text-align:start")}>{a.handle}</span>
                  <span style={s("font-size:11px;font-weight:700;color:#8b93a1;flex:none")}>{fmt(a.followers)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* content */}
        <div style={s("flex:1;min-width:0;overflow:auto")}>
          {ui.tab === "dashboard" && <Dashboard />}
          {ui.tab === "compose" && <Compose />}
          {ui.tab === "calendar" && <Calendar />}
          {ui.tab === "library" && <Library />}
          {ui.tab === "analytics" && <Analytics />}
          {ui.tab === "team" && <Approvals />}
          {ui.tab === "admin" && <Admin />}
        </div>
      </div>

      {/* modals + toast */}
      {ui.inviteOpen && <InviteModal />}
      {ui.mfaUserId && <MfaModal />}
      {ui.addOpen && <AddEventModal />}
      {ui.reviewId && <ReviewModal />}
      {ui.stat && <PostStatModal />}
      {ui.toast && (
        <div style={s("position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;font-weight:600;font-size:14px;padding:13px 24px;border-radius:999px;box-shadow:0 12px 32px rgba(15,23,42,.3);animation:toastIn .25s ease;z-index:50")}>{ui.toast}</div>
      )}
    </div>
  );
}
