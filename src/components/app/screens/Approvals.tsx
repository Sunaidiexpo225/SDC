"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";

export default function Approvals() {
  const app = useApp();
  const { t, lang } = useLang();
  const { ui, patch, activeEvent, data, pname } = app;

  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;
  const list = data.approvals.filter((a) => a.eventId === ui.activeEventId);
  const pendingCount = list.filter((a) => a.status === "pending").length;

  const items = list.map((a) => {
    const who = lang === "ar" ? a.whoAr : a.whoEn;
    const whenTxt = a.whenLabel === "today" ? t.whenToday : t.whenYesterday;
    const done = a.status !== "pending";
    return {
      id: a.id,
      init: a.init,
      avColor: a.avColor,
      titleL: lang === "ar" ? a.titleAr : a.titleEn,
      metaL: who + " · " + whenTxt + " · " + a.platforms.map((k) => pname(k)).join(" · "),
      done,
      badgeBg: a.status === "approved" ? "#e7f6f3" : "#fdf2f2",
      badgeColor: a.status === "approved" ? "#128d81" : "#d64545",
      statusLabel: a.status === "approved" ? t.approvedBadge : t.declinedBadge,
      openLabel: a.status === "pending" ? t.openLabel : t.reviewLabel,
      open: () =>
        patch({
          reviewId: a.id,
          reviewCaption: a.editedCaption ?? (lang === "ar" ? a.captionAr : a.captionEn),
        }),
    };
  });

  return (
    <div style={s("padding:28px 32px;max-width:820px")}>
      <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.approvalsH2}</h2>
      <p style={s("font-size:14px;color:#5c6675;margin:0 0 8px")}><span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span> · {t.pendingLine(pendingCount)}</p>
      <p style={s("font-size:13px;color:#8b93a1;margin:0 0 22px")}>{t.flowNote}</p>
      <div style={s("display:flex;flex-direction:column;gap:12px")}>
        {items.map((a) => (
          <div key={a.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:16px")}>
            <div style={s(`width:40px;height:40px;border-radius:50%;background:${a.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:14px;flex:none`)}>{a.init}</div>
            <div style={s("flex:1;min-width:0")}>
              <div style={s("font-size:14px;font-weight:700;margin-bottom:3px")}>{a.titleL}</div>
              <div style={s("font-size:12px;color:#8b93a1")}>{a.metaL}</div>
            </div>
            <div style={s("display:flex;gap:8px;flex:none;align-items:center")}>
              {a.done && (
                <span style={s(`background:${a.badgeBg};color:${a.badgeColor};font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px`)}>{a.statusLabel}</span>
              )}
              <Hov tag="button" onClick={a.open} css="border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#0f172a;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit;white-space:nowrap" hover="border-color:#2563eb;color:#2563eb">{a.openLabel}</Hov>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
