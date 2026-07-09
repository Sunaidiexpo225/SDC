"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { addDays, isoDate } from "@/lib/format";

export default function Calendar() {
  const app = useApp();
  const { t, lang, locale } = useLang();
  const { ui, patch, data, activeEvent, today } = app;
  const canApprove = app.canApprove;
  const isMgr = ["Admin", "Manager", "AsstManager"].includes(app.currentUser?.role ?? "");
  const meId = app.currentUser?.id;
  const userById = (id: string | null) => (id ? data.users.find((u) => u.id === id) : undefined);
  const apStyle: Record<string, [string, string]> = {
    approved: ["#e7f6f3", "#128d81"],
    pending: ["#fdf6e7", "#b17a09"],
    declined: ["#fdf2f2", "#d64545"],
  };
  const apLabel = (t2: typeof t, a: string) =>
    a === "approved" ? t2.apApproved : a === "declined" ? t2.apDeclined : t2.apPending;

  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;
  const weekStartMon = data.settings.weekStartsMonday;
  const base = new Date(today.getFullYear(), today.getMonth() + ui.monthOffset, 1);
  const monthLabel = base.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const rot = weekStartMon ? 1 : 0;
  const dowLabels = Array.from({ length: 7 }, (_, i) => t.dows[(i + rot) % 7]);
  let start = base.getDay() - rot;
  if (start < 0) start += 7;
  const first = addDays(base, -start);
  const todayIso = isoDate(today);
  const eventPosts = data.posts.filter((p) => p.eventId === ui.activeEventId);

  const title = (p: (typeof data.posts)[number]) => (lang === "ar" ? p.titleAr : p.titleEn);
  const caption = (p: (typeof data.posts)[number]) => (lang === "ar" ? p.captionAr : p.captionEn);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(first, i);
    const iso = isoDate(d);
    const inMonth = d.getMonth() === base.getMonth();
    const isToday = iso === todayIso;
    const cellPosts = eventPosts
      .filter((p) => p.date === iso)
      .map((p) => ({ id: p.id, title: title(p), color: app.pcolor(p.platforms[0]) }));
    return {
      num: d.getDate(),
      posts: cellPosts,
      bg: inMonth ? "#fff" : "#f8fafc",
      bd: isToday ? "#2563eb" : "#e9edf3",
      opacity: inMonth ? 1 : 0.55,
      numColor: isToday ? "#fff" : inMonth ? "#0f172a" : "#b3bac6",
      numBg: isToday ? "#2563eb" : "transparent",
    };
  });

  const sel = data.posts.find((p) => p.id === ui.selectedPostId);
  const selDate = sel ? new Date(sel.date + "T00:00:00") : null;
  const schedLine = t.schedLine(eventPosts.filter((p) => p.status === "scheduled").length);

  return (
    <div style={s("padding:28px 32px;position:relative")}>
      <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:20px")}>
        <div>
          <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.calendarH2}</h2>
          <div style={s("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <p style={s("font-size:14px;color:#5c6675;margin:0")}><span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span> · {schedLine}</p>
            {(() => {
              const on = data.autoPublishConfigured && data.settings.autoPublish;
              return (
                <span title={on ? t.autoPubTip : t.autoPubOffTip} style={s(`display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 11px;border-radius:999px;cursor:default;background:${on ? "#e7f6f3" : "#f0f3f7"};color:${on ? "#128d81" : "#8b93a1"}`)}>
                  <span style={s(`width:7px;height:7px;border-radius:50%;background:${on ? "#17a99b" : "#c0c7d2"}`)} />
                  {on ? `⚡ ${t.autoPubOn}` : t.autoPubOff}
                </span>
              );
            })()}
          </div>
        </div>
        <div style={s("display:flex;align-items:center;gap:10px")}>
          <Hov tag="button" onClick={() => patch({ monthOffset: ui.monthOffset - 1, selectedPostId: null })} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;width:36px;height:36px;border-radius:50%;font-family:inherit;font-size:15px;color:#0f172a" hover="border-color:#2563eb">{t.arrPrev}</Hov>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:17px;min-width:150px;text-align:center")}>{monthLabel}</div>
          <Hov tag="button" onClick={() => patch({ monthOffset: ui.monthOffset + 1, selectedPostId: null })} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;width:36px;height:36px;border-radius:50%;font-family:inherit;font-size:15px;color:#0f172a" hover="border-color:#2563eb">{t.arrNext}</Hov>
        </div>
      </div>

      <div style={s("display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:6px")}>
        {dowLabels.map((w, i) => (
          <div key={i} style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;padding:4px 8px")}>{w}</div>
        ))}
      </div>
      <div style={s("display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px")}>
        {days.map((d, i) => (
          <div key={i} style={s(`min-width:0;min-height:92px;background:${d.bg};border:1px solid ${d.bd};border-radius:12px;padding:8px;opacity:${d.opacity}`)}>
            <div style={s(`font-size:12px;font-weight:700;color:${d.numColor};width:22px;height:22px;border-radius:50%;background:${d.numBg};display:grid;place-items:center;margin-bottom:6px`)}>{d.num}</div>
            <div style={s("display:flex;flex-direction:column;gap:4px;min-width:0")}>
              {d.posts.map((p) => (
                <Hov key={p.id} tag="button" onClick={() => patch({ selectedPostId: p.id })} css="display:flex;align-items:center;gap:6px;border:none;cursor:pointer;background:#fff;border-radius:8px;padding:5px 8px;font-family:inherit;text-align:start;box-shadow:0 1px 2px rgba(15,23,42,.08);max-width:100%;min-width:0" hover="box-shadow:0 2px 6px rgba(15,23,42,.16)">
                  <span style={s(`width:7px;height:7px;border-radius:50%;background:${p.color};flex:none`)} />
                  <span style={s("font-size:11px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{p.title}</span>
                </Hov>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sel && selDate && (
        <div style={s("position:fixed;inset-inline-end:24px;top:82px;width:320px;background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:22px;box-shadow:0 24px 60px rgba(15,23,42,.18);z-index:20")}>
          <div style={s("display:flex;justify-content:space-between;align-items:center;margin-bottom:14px")}>
            <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
              <span style={s(`font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${sel.status === "posted" ? "#17a99b" : "#2563eb"}`)}>{sel.status === "posted" ? t.posted : t.scheduled}</span>
              {sel.status !== "posted" && (
                <span style={s(`font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:${apStyle[sel.approval][0]};color:${apStyle[sel.approval][1]}`)}>{apLabel(t, sel.approval)}</span>
              )}
            </div>
            <button onClick={() => patch({ selectedPostId: null })} style={s("border:none;cursor:pointer;background:#f4f6f9;width:28px;height:28px;border-radius:50%;font-family:inherit;color:#5c6675")}>✕</button>
          </div>
          {sel.mediaUrl && (
            sel.format === "Image" ? (
              <img src={sel.mediaUrl} alt="" style={s("width:100%;max-height:200px;object-fit:cover;border-radius:12px;display:block;margin-bottom:12px;background:#0f172a")} />
            ) : (
              <video src={sel.mediaUrl} controls style={s("width:100%;max-height:200px;border-radius:12px;display:block;margin-bottom:12px;background:#000")} />
            )
          )}
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px;margin-bottom:6px")}>{title(sel)}</div>
          <p style={s("font-size:13px;line-height:1.5;color:#5c6675;margin:0 0 14px")}>{caption(sel)}</p>
          <div style={s("font-size:12px;font-weight:700;color:#8b93a1;margin-bottom:8px")}>{selDate.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })} · {sel.time}</div>
          <div style={s("display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px")}>
            {sel.platforms.map((k) => (
              <span key={k} style={s("display:inline-flex;align-items:center;gap:6px;background:#f4f6f9;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${app.pcolor(k)}`)} />{app.pname(k)}</span>
            ))}
          </div>

          {/* Assignment + production status */}
          <div style={s("background:#f8fafc;border:1px solid #eef1f5;border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:10px")}>
            <div style={s("display:flex;align-items:center;gap:10px")}>
              <span style={s("font-size:12px;font-weight:700;color:#8b93a1;flex:none")}>{t.assignThisPost}</span>
              {isMgr ? (
                <select value={sel.assigneeId || ""} onChange={(e) => app.setPostAssignee(sel.id, e.target.value || null)} style={s("flex:1;min-width:0;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:9px;padding:7px 10px;font-family:inherit;font-size:13px;color:#0f172a;background:#fff")}>
                  <option value="">{t.taskUnassigned}</option>
                  {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <span style={s("flex:1;font-size:13px;font-weight:600;color:#0f172a")}>{userById(sel.assigneeId)?.name || t.taskUnassigned}</span>
              )}
              {userById(sel.assigneeId) && (
                <span style={s(`width:26px;height:26px;border-radius:50%;background:${userById(sel.assigneeId)!.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex:none`)}>{userById(sel.assigneeId)!.init}</span>
              )}
            </div>
            {sel.status !== "posted" && (isMgr || sel.assigneeId === meId) && (
              <Hov tag="button" onClick={() => app.setPostComplete(sel.id, !sel.completed)} css={`border:1px solid ${sel.completed ? "#e3e8ef" : "#b7e3d8"};cursor:pointer;background:${sel.completed ? "#fff" : "#e7f6f3"};color:${sel.completed ? "#5c6675" : "#128d81"};font-weight:700;font-size:12px;padding:8px 14px;border-radius:999px;font-family:inherit`} hover={sel.completed ? "border-color:#c8d0dc" : "background:#d9efe9"}>{sel.completed ? t.postReopen : t.postMarkProduced}</Hov>
            )}
            {sel.completed && sel.completedAt && (
              <span style={s("font-size:11px;color:#128d81;font-weight:600")}>{t.postProduced} · {new Date(sel.completedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}{userById(sel.completedById) ? ` · ${userById(sel.completedById)!.name}` : ""}</span>
            )}
          </div>
          {sel.status === "posted" && (
            <Hov tag="button" onClick={() => patch({ stat: { kind: "post", id: sel.id } })} css="width:100%;border:none;cursor:pointer;background:#0f172a;color:#fff;font-weight:700;font-size:13px;padding:10px;border-radius:999px;font-family:inherit;margin-bottom:8px" hover="background:#2563eb">{t.viewAnalytics}</Hov>
          )}
          {sel.status !== "posted" && canApprove && sel.approval !== "approved" && (
            <div style={s("display:flex;gap:8px;margin-bottom:8px")}>
              <Hov tag="button" onClick={() => app.setPostApproval(sel.id, "approved")} css="flex:1;border:none;cursor:pointer;background:#17a99b;color:#fff;font-weight:700;font-size:13px;padding:10px;border-radius:999px;font-family:inherit" hover="background:#128d81">{t.approveBtn}</Hov>
              {sel.approval !== "declined" && (
                <Hov tag="button" onClick={() => app.setPostApproval(sel.id, "declined")} css="flex:1;border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:13px;padding:10px;border-radius:999px;font-family:inherit" hover="background:#fdf2f2">{t.declineBtn}</Hov>
              )}
            </div>
          )}
          {sel.status !== "posted" && (
            sel.approval === "approved" ? (
              <Hov tag="button" onClick={() => app.publishPost(sel.id)} css="width:100%;border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:10px;border-radius:999px;font-family:inherit;margin-bottom:8px" hover="background:#1d4ed8">{t.publishNow}</Hov>
            ) : (
              <div style={s("font-size:12px;color:#8b93a1;background:#f8fafc;border:1px solid #eef1f5;border-radius:12px;padding:10px 12px;margin-bottom:8px;line-height:1.4")}>{t.needsApprovalNote}</div>
            )
          )}
          <Hov tag="button" onClick={() => app.deletePost(sel.id)} css="width:100%;border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:13px;padding:10px;border-radius:999px;font-family:inherit" hover="background:#fdf2f2">{t.deletePost}</Hov>
        </div>
      )}
    </div>
  );
}
