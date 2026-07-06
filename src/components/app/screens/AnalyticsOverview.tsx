"use client";

import { useEffect, useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { s } from "@/lib/style";
import { fmt } from "@/lib/format";
import { api } from "@/lib/client";

interface OverviewRow {
  eventId: string;
  eventNameEn: string;
  eventNameAr: string;
  color: string;
  handle: string;
  followers: number;
  posts: number;
  engagement: number;
  growth: number;
}

export default function AnalyticsOverview() {
  const { t, lang } = useLang();
  const app = useApp();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ accounts: OverviewRow[] }>("/api/analytics/overview")
      .then((res) => {
        if (!cancelled) setRows(res.accounts || []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const th = "font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em";
  const grid = "display:grid;grid-template-columns:1.6fr 1fr 1fr 0.8fr 0.8fr;gap:12px;align-items:center";

  const sorted = rows ? [...rows].sort((a, b) => b.followers - a.followers) : [];

  return (
    <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:8px 18px 14px")}>
      {rows === null ? (
        <div style={s("color:#8b93a1;font-size:14px;font-weight:600;padding:24px 4px")}>…</div>
      ) : sorted.length === 0 ? (
        <div style={s("color:#8b93a1;font-size:14px;font-weight:600;padding:36px 4px;text-align:center")}>{t.ovEmpty}</div>
      ) : (
        <>
          <div style={s(grid + ";padding:12px 0")}>
            <div style={s(th)}>{t.ovColBrand}</div>
            <div style={s(th + ";text-align:end")}>{t.ovColFollowers}</div>
            <div style={s(th + ";text-align:end")}>{t.ovColEngagement}</div>
            <div style={s(th + ";text-align:end")}>{t.ovColPosts}</div>
            <div style={s(th + ";text-align:end")}>{t.ovColGrowth}</div>
          </div>
          {sorted.map((r) => (
            <div
              key={r.eventId + r.handle}
              onClick={() => app.patch({ activeEventId: r.eventId })}
              style={s(grid + ";padding:13px 0;border-top:1px solid #f0f3f7;cursor:pointer")}
            >
              <div style={s("display:flex;align-items:center;gap:10px;min-width:0")}>
                <span style={s(`width:10px;height:10px;border-radius:50%;background:${r.color};flex:none`)} />
                <div style={s("min-width:0")}>
                  <div style={s("font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{lang === "ar" ? r.eventNameAr : r.eventNameEn}</div>
                  <div dir="ltr" style={s("font-size:11px;color:#8b93a1;text-align:start")}>{r.handle}</div>
                </div>
              </div>
              <div style={s("font-size:13px;font-weight:700;text-align:end")}>{fmt(r.followers)}</div>
              <div style={s("font-size:13px;text-align:end")}>{fmt(r.engagement)}</div>
              <div style={s("font-size:13px;text-align:end")}>{r.posts}</div>
              <div style={s(`font-size:13px;font-weight:700;text-align:end;color:${r.growth >= 0 ? "#17a99b" : "#d64545"}`)}>{(r.growth >= 0 ? "+" : "") + r.growth}%</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
