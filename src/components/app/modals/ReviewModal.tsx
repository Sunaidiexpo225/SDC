"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";

export default function ReviewModal() {
  const app = useApp();
  const { t, lang, dir } = useLang();
  const { ui, patch, data } = app;

  const rev = data.approvals.find((a) => a.id === ui.reviewId);
  if (!rev) return null;
  const revEvent = app.ev(rev.eventId);
  const isDone = rev.status !== "pending";
  const canAct = rev.status === "pending" && app.canApprove;
  const canDiscard = rev.status === "pending" && app.canDiscard;
  const noPerm = rev.status === "pending" && !app.canApprove && !app.canDiscard;
  const whenTxt = rev.whenLabel === "today" ? t.whenToday : t.whenYesterday;
  const who = lang === "ar" ? rev.whoAr : rev.whoEn;

  return (
    <div onClick={() => patch({ reviewId: null })} style={s("position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;z-index:60;padding:24px")}>
      <div dir={dir} onClick={(e) => e.stopPropagation()} style={s("width:560px;max-width:100%;max-height:88vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(15,23,42,.35)")}>
        <div style={s("display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eef1f5")}>
          <div style={s("display:flex;align-items:center;gap:9px;min-width:0")}>
            <span style={s(`width:11px;height:11px;border-radius:50%;background:${revEvent.color};flex:none`)} />
            <span style={s("font-size:14px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{lang === "ar" ? revEvent.nameAr : revEvent.nameEn}</span>
          </div>
          <button onClick={() => patch({ reviewId: null })} style={s("border:none;cursor:pointer;background:#f4f6f9;width:30px;height:30px;border-radius:50%;font-family:inherit;color:#5c6675;flex:none")}>✕</button>
        </div>
        <div style={s("padding:22px")}>
          <div style={s("font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b93a1;margin-bottom:6px")}>{t.reviewLabel}</div>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:20px;margin-bottom:16px")}>{lang === "ar" ? rev.titleAr : rev.titleEn}</div>
          <div style={s("height:200px;border-radius:14px;background:repeating-linear-gradient(45deg,#eef1f5 0 10px,#e5e9f0 10px 20px);display:grid;place-items:center;margin-bottom:18px;border:1px dashed #c8d0dc")}>
            <span style={s("font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#8b93a1")}>{t.reelHint}</span>
          </div>
          <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:8px")}>
            <label style={s("font-size:13px;font-weight:700")}>{t.captionLabel}</label>
            <span style={s("font-size:12px;color:#8b93a1")}>{t.captionEditHint}</span>
          </div>
          <textarea value={ui.reviewCaption} onChange={(e) => patch({ reviewCaption: e.target.value })} style={s("width:100%;box-sizing:border-box;height:110px;resize:none;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;line-height:1.5;color:#0f172a;background:#fbfcfe")} />
          <div style={s("display:flex;gap:6px;flex-wrap:wrap;margin-top:14px")}>
            {rev.platforms.map((k) => (
              <span key={k} style={s("display:inline-flex;align-items:center;gap:6px;background:#f4f6f9;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:600")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${app.pcolor(k)}`)} />{app.pname(k)}</span>
            ))}
          </div>
          <div style={s("font-size:12px;font-weight:700;color:#8b93a1;margin-top:12px")}>{whenTxt} · {who}</div>
        </div>
        <div style={s("display:flex;gap:10px;align-items:center;padding:16px 22px;border-top:1px solid #eef1f5;justify-content:flex-end")}>
          {isDone && (
            <span style={s(`margin-inline-end:auto;background:${rev.status === "approved" ? "#e7f6f3" : "#fdf2f2"};color:${rev.status === "approved" ? "#128d81" : "#d64545"};font-size:12px;font-weight:700;padding:7px 14px;border-radius:999px`)}>{rev.status === "approved" ? t.approvedBadge : t.declinedBadge}</span>
          )}
          <Hov tag="button" onClick={() => app.approvalAction("save", ui.reviewCaption)} css="border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#0f172a;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit" hover="border-color:#2563eb;color:#2563eb">{t.saveChanges}</Hov>
          {canDiscard && (
            <Hov tag="button" onClick={() => app.approvalAction("discard")} css="border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit" hover="background:#fdf2f2">{t.discard}</Hov>
          )}
          {canAct && (
            <>
              <Hov tag="button" onClick={() => app.approvalAction("decline", ui.reviewCaption)} css="border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit" hover="background:#fdf2f2">{t.decline}</Hov>
              <Hov tag="button" onClick={() => app.approvalAction("approve", ui.reviewCaption)} css="border:none;cursor:pointer;background:#17a99b;color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:999px;font-family:inherit" hover="background:#128d81">{t.approve}</Hov>
            </>
          )}
          {noPerm && (
            <span style={s("font-size:12px;color:#8b93a1;text-align:end;max-width:260px")}>{t.reviewNoPerm}</span>
          )}
        </div>
      </div>
    </div>
  );
}
