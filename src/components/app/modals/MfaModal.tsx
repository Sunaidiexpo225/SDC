"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";

export default function MfaModal() {
  const app = useApp();
  const { t, dir } = useLang();
  const { data, ui, patch } = app;

  const mfaUserName = data.users.find((u) => u.id === ui.mfaUserId)?.name ?? "";
  const close = () => patch({ mfaUserId: null });

  return (
    <div onClick={close} style={s("position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;z-index:60;padding:24px")}>
      <div dir={dir} onClick={(e) => e.stopPropagation()} style={s("width:400px;max-width:100%;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(15,23,42,.35)")}>
        <div style={s("display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eef1f5")}>
          <span style={s("font-family:var(--grotesk);font-size:16px;font-weight:700")}>{t.mfaTitle}</span>
          <button onClick={close} style={s("border:none;cursor:pointer;background:#f4f6f9;width:30px;height:30px;border-radius:50%;font-family:inherit;color:#5c6675")}>✕</button>
        </div>
        <div style={s("padding:22px;text-align:center")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:14px")}>{mfaUserName}</div>
          {ui.mfaQr ? (
            <img src={ui.mfaQr} width={150} height={150} style={s("display:block;margin:0 auto 16px;border-radius:14px;border:1px solid #e3e8ef")} alt="" />
          ) : (
            <div style={s("width:150px;height:150px;margin:0 auto 16px;border-radius:14px;background:repeating-conic-gradient(#0f172a 0 25%, #fff 0 50%) 0 0/24px 24px;border:1px solid #e3e8ef")} />
          )}
          <p style={s("font-size:13px;line-height:1.5;color:#5c6675;margin:0 0 16px")}>{t.mfaScan}</p>
          <input dir="ltr" value={ui.mfaCode} onInput={(e) => patch({ mfaCode: (e.target as HTMLInputElement).value })} placeholder={t.mfaCodePh} style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:ui-monospace,Menlo,monospace;font-size:18px;letter-spacing:.3em;text-align:center;color:#0f172a;background:#fbfcfe")} />
        </div>
        <div style={s("display:flex;gap:10px;padding:16px 22px;border-top:1px solid #eef1f5;justify-content:flex-end")}>
          <button onClick={close} style={s("border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit")}>{t.decline}</button>
          <Hov tag="button" onClick={app.verifyMfa} css="border:none;cursor:pointer;background:#17a99b;color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:999px;font-family:inherit" hover="background:#128d81">{t.verify}</Hov>
        </div>
      </div>
    </div>
  );
}
