"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";

const ORDER: Record<string, number> = { pending: 0, declined: 1, approved: 2 };

export default function Approvals() {
  const app = useApp();
  const { t, lang, locale } = useLang();
  const { ui, patch, activeEvent, data, pname, pcolor } = app;
  const canApprove =
    app.currentUser?.role === "Admin" || app.currentUser?.role === "Manager";

  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;

  // Real queue: this event's scheduled (not-yet-posted) posts, pending first.
  const posts = data.posts
    .filter((p) => p.eventId === ui.activeEventId && p.status !== "posted")
    .sort((a, b) => (ORDER[a.approval] - ORDER[b.approval]) || a.date.localeCompare(b.date));
  const pendingCount = posts.filter((p) => p.approval === "pending").length;

  const apStyle: Record<string, [string, string]> = {
    approved: ["#e7f6f3", "#128d81"],
    pending: ["#fdf6e7", "#b17a09"],
    declined: ["#fdf2f2", "#d64545"],
  };
  const apLabel = (a: string) =>
    a === "approved" ? t.apApproved : a === "declined" ? t.apDeclined : t.apPending;

  const title = (p: (typeof posts)[number]) => (lang === "ar" ? p.titleAr : p.titleEn);
  const caption = (p: (typeof posts)[number]) => (lang === "ar" ? p.captionAr : p.captionEn);

  const openInCalendar = (id: string, date: string) => {
    const d = new Date(date + "T00:00:00");
    const offset =
      (d.getFullYear() - app.today.getFullYear()) * 12 + (d.getMonth() - app.today.getMonth());
    patch({ tab: "calendar", monthOffset: offset, selectedPostId: id });
  };

  return (
    <div style={s("padding:28px 32px;max-width:820px")}>
      <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.approvalsH2}</h2>
      <p style={s("font-size:14px;color:#5c6675;margin:0 0 8px")}><span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span> · {t.pendingLine(pendingCount)}</p>
      <p style={s("font-size:13px;color:#8b93a1;margin:0 0 22px")}>{t.flowNote}</p>

      {posts.length === 0 ? (
        <div style={s("border:1px dashed #d5dbe4;border-radius:16px;padding:48px 24px;text-align:center;color:#8b93a1;font-size:14px;font-weight:600;background:#fbfcfe")}>{t.approvalsEmpty}</div>
      ) : (
        <div style={s("display:flex;flex-direction:column;gap:12px")}>
          {posts.map((p) => (
            <div key={p.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px 20px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap")}>
              {p.mediaUrl && (
                <div style={s("width:56px;height:56px;border-radius:12px;overflow:hidden;background:#0f172a;flex:none")}>
                  {p.format === "Image" ? (
                    <img src={p.mediaUrl} alt="" style={s("width:100%;height:100%;object-fit:cover;display:block")} />
                  ) : (
                    <video src={p.mediaUrl} muted playsInline style={s("width:100%;height:100%;object-fit:cover;display:block")} />
                  )}
                </div>
              )}
              <div style={s("flex:1;min-width:160px")}>
                <div style={s("display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap")}>
                  <span style={s("font-size:14px;font-weight:700")}>{title(p)}</span>
                  <span style={s(`font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px;background:${apStyle[p.approval][0]};color:${apStyle[p.approval][1]}`)}>{apLabel(p.approval)}</span>
                </div>
                <div style={s("font-size:12px;color:#5c6675;line-height:1.4;margin-bottom:6px;max-width:520px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical")}>{caption(p)}</div>
                <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                  <span style={s("font-size:11px;color:#8b93a1;font-weight:600")}>{new Date(p.date + "T00:00:00").toLocaleDateString(locale, { month: "short", day: "numeric" })} · {p.time}</span>
                  {p.platforms.map((k) => (
                    <span key={k} style={s("display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#5c6675;font-weight:600")}><span style={s(`width:6px;height:6px;border-radius:50%;background:${pcolor(k)}`)} />{pname(k)}</span>
                  ))}
                </div>
              </div>
              <div style={s("display:flex;gap:8px;align-items:center;flex:none")}>
                {canApprove && p.approval !== "approved" && (
                  <Hov tag="button" onClick={() => app.setPostApproval(p.id, "approved")} css="border:none;cursor:pointer;background:#17a99b;color:#fff;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit" hover="background:#128d81">{t.approveBtn}</Hov>
                )}
                {canApprove && p.approval === "pending" && (
                  <Hov tag="button" onClick={() => app.setPostApproval(p.id, "declined")} css="border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit" hover="background:#fdf2f2">{t.declineBtn}</Hov>
                )}
                <Hov tag="button" onClick={() => openInCalendar(p.id, p.date)} css="border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#0f172a;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit" hover="border-color:#2563eb;color:#2563eb">{t.viewLabel}</Hov>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
