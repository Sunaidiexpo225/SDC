"use client";

import { useEffect, useState } from "react";
import { useLang } from "../../LangProvider";
import { s } from "@/lib/style";
import { api } from "@/lib/client";

interface AuditEntry {
  id: string;
  at: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  level: string;
  ip: string | null;
}

const levelColor: Record<string, [string, string]> = {
  error: ["#fdf2f2", "#d64545"],
  warning: ["#fdf6e7", "#b17a09"],
  info: ["#eef2f8", "#2563eb"],
};

export default function AuditLog() {
  const { t, locale } = useLang();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    api
      .get<{ entries: AuditEntry[] }>(`/api/audit${errorsOnly ? "?level=error" : ""}`)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [errorsOnly]);

  const th = "font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em";
  const grid = "display:grid;grid-template-columns:150px 1.1fr 1fr 1.4fr;gap:12px;align-items:start";

  const tabs: [boolean, string][] = [
    [false, t.auditAll],
    [true, t.auditErrorsOnly],
  ];

  return (
    <>
      <div style={s("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap")}>
        <div style={s("font-size:13px;color:#8b93a1;font-weight:600")}>{t.auditSub}</div>
        <div style={s("display:flex;gap:6px")}>
          {tabs.map(([v, label]) => {
            const active = errorsOnly === v;
            return (
              <button key={label} onClick={() => setErrorsOnly(v)} style={s(`border:2px solid ${active ? "#0f172a" : "#e3e8ef"};cursor:pointer;background:${active ? "#0f172a" : "#fff"};color:${active ? "#fff" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 14px;border-radius:999px;font-family:inherit`)}>{label}</button>
            );
          })}
        </div>
      </div>

      {entries === null ? (
        <div style={s("color:#8b93a1;font-size:14px;font-weight:600;padding:24px 4px")}>…</div>
      ) : entries.length === 0 ? (
        <div style={s("border:1px dashed #d5dbe4;border-radius:16px;padding:48px 24px;text-align:center;color:#8b93a1;font-size:14px;font-weight:600;background:#fbfcfe")}>{t.auditEmpty}</div>
      ) : (
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:8px 18px 14px")}>
          <div style={s(grid + ";padding:12px 0")}>
            <div style={s(th)}>{t.auditColWhen}</div>
            <div style={s(th)}>{t.auditColWho}</div>
            <div style={s(th)}>{t.auditColAction}</div>
            <div style={s(th)}>{t.auditColDetail}</div>
          </div>
          {entries.map((e) => {
            const [bg, col] = levelColor[e.level] || levelColor.info;
            const when = new Date(e.at).toLocaleString(locale, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div key={e.id} style={s(grid + ";padding:12px 0;border-top:1px solid #f0f3f7")}>
                <div style={s("font-size:12px;color:#5c6675;font-weight:600")}>{when}</div>
                <div style={s("min-width:0")}>
                  <div dir="ltr" style={s("font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start")}>{e.actorEmail || "—"}</div>
                  <div style={s("font-size:11px;color:#8b93a1")}>{e.actorRole || (e.ip ? e.ip : "")}</div>
                </div>
                <div>
                  <span style={s(`display:inline-block;background:${bg};color:${col};font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;font-family:ui-monospace,Menlo,monospace`)}>{e.action}</span>
                </div>
                <div style={s("min-width:0")}>
                  <div style={s("font-size:12px;font-weight:600;color:#0f172a;word-break:break-word")}>{e.target || ""}</div>
                  {e.detail && <div style={s("font-size:11px;color:#8b93a1;word-break:break-word")}>{e.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
