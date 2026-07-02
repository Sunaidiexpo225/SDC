"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { segStyle, roleLabelOf } from "../helpers";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["Admin", "Manager", "Editor", "Viewer"];

export default function InviteModal() {
  const app = useApp();
  const { t, dir } = useLang();
  const { ui, patch } = app;

  const close = () => patch({ inviteOpen: false });

  return (
    <div onClick={close} style={s("position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;z-index:60;padding:24px")}>
      <div dir={dir} onClick={(e) => e.stopPropagation()} style={s("width:440px;max-width:100%;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(15,23,42,.35)")}>
        <div style={s("display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eef1f5")}>
          <span style={s("font-family:var(--grotesk);font-size:17px;font-weight:700")}>{t.inviteTitle}</span>
          <button onClick={close} style={s("border:none;cursor:pointer;background:#f4f6f9;width:30px;height:30px;border-radius:50%;font-family:inherit;color:#5c6675")}>✕</button>
        </div>
        <div style={s("padding:22px")}>
          <label style={s("font-size:13px;font-weight:700;display:block;margin-bottom:8px")}>{t.nameLabel}</label>
          <input value={ui.invName} onInput={(e) => patch({ invName: (e.target as HTMLInputElement).value })} style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;color:#0f172a;background:#fbfcfe;margin-bottom:16px")} />
          <label style={s("font-size:13px;font-weight:700;display:block;margin-bottom:8px")}>{t.emailLabel}</label>
          <input dir="ltr" value={ui.invEmail} onInput={(e) => patch({ invEmail: (e.target as HTMLInputElement).value })} placeholder="name@sunaidiexpo.com" style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;color:#0f172a;background:#fbfcfe;margin-bottom:16px;text-align:start")} />
          <label style={s("font-size:13px;font-weight:700;display:block;margin-bottom:8px")}>{t.roleLabel}</label>
          <div style={s("display:flex;gap:6px")}>
            {ROLES.map((r) => {
              const { bd, bg, color } = segStyle(ui.invRole === r);
              return (
                <button key={r} onClick={() => patch({ invRole: r })} style={s(`border:2px solid ${bd};cursor:pointer;background:${bg};color:${color};font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit`)}>{roleLabelOf(r, t)}</button>
              );
            })}
          </div>
        </div>
        <div style={s("display:flex;gap:10px;padding:16px 22px;border-top:1px solid #eef1f5;justify-content:flex-end")}>
          <button onClick={close} style={s("border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit")}>{t.decline}</button>
          <Hov tag="button" onClick={app.sendInvite} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:999px;font-family:inherit" hover="background:#1d4ed8">{t.sendInvite}</Hov>
        </div>
      </div>
    </div>
  );
}
