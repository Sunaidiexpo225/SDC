"use client";

import { useEffect, useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { fmt, fmt12 } from "@/lib/format";
import { computeAnalytics, barLabels, type AnalyticsModel } from "@/lib/analytics";
import { api } from "@/lib/client";
import { SUFFIX } from "@/lib/content";
import AnalyticsOverview from "./AnalyticsOverview";
import AudiencePanel from "./AudiencePanel";

export default function Analytics() {
  const app = useApp();
  const { t, lang, locale } = useLang();
  const { ui, patch, activeEvent } = app;

  const [view, setView] = useState<"event" | "brands">("event");

  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;
  const estimate = computeAnalytics(activeEvent.accounts, activeEvent.barIx, ui.range);

  // Try to load real Instagram data for this event/range; fall back to the
  // estimate until (or unless) it arrives. The server returns { source:
  // "estimated" } when no Instagram account is connected.
  const [live, setLive] = useState<AnalyticsModel | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLive(null);
    api
      .get<AnalyticsModel | { source: "estimated" }>(
        `/api/analytics?eventId=${encodeURIComponent(activeEvent.id)}&range=${ui.range}`,
      )
      .then((res) => {
        if (!cancelled && res && res.source === "live") setLive(res as AnalyticsModel);
      })
      .catch(() => {
        /* keep the estimate */
      });
    return () => {
      cancelled = true;
    };
  }, [activeEvent.id, ui.range]);

  const model = live ?? estimate;
  const isLive = model.source === "live";
  const { stat } = model;
  const dtxt = t[model.deltaKey] as string;
  const subTxt = t[model.subKey] as string;
  const labels = barLabels(model.range, t);

  const pctDelta = (n: number) => (n >= 0 ? "+" : "") + n + "%";
  const pctColor = (n: number) => (n >= 0 ? "#17a99b" : "#d64545");
  // In live mode only show a %-delta when there's a real prior period to
  // compare against — otherwise it's a meaningless "+100%".
  const liveDelta = (n: number) => (model.hasPrior ? pctDelta(n) : subTxt);
  const liveDeltaColor = (n: number) => (model.hasPrior ? pctColor(n) : "#8b93a1");
  const kpi = [
    { label: t.stViewsLabel, value: fmt(Math.round(stat.v)), delta: isLive ? liveDelta(stat.dv) : "+" + stat.dv + dtxt, deltaColor: isLive ? liveDeltaColor(stat.dv) : "#17a99b" },
    { label: t.stEngLabel, value: fmt(Math.round(stat.e)), delta: isLive ? liveDelta(stat.de) : "+" + stat.de + dtxt, deltaColor: isLive ? liveDeltaColor(stat.de) : "#17a99b" },
    { label: t.stFollowersLabel, value: fmt(Math.round(isLive ? (model.newFollowers ?? 0) : stat.f)), delta: isLive ? subTxt : "+" + stat.df + dtxt, deltaColor: isLive ? "#8b93a1" : "#17a99b" },
    { label: t.stPostsLabel, value: String(stat.p), delta: subTxt, deltaColor: "#8b93a1" },
  ];

  const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const exportCsv = () => {
    const rows: unknown[][] = [
      [t.stViewsLabel, Math.round(stat.v)],
      [t.stEngLabel, Math.round(stat.e)],
      [t.stFollowersLabel, Math.round(isLive ? (model.newFollowers ?? 0) : stat.f)],
      [t.stPostsLabel, stat.p],
      [t.statSaves, model.saves ?? 0],
      [t.statShares, model.shares ?? 0],
      [],
      [t.colAccount, t.colFollowers, t.colViews, t.colEng, t.colGrowth],
      ...model.accountPerf.map((a) => [a.handle, a.followers, a.viewsN, a.engN, a.growth]),
      [],
      ["#", t.topPostsLabel, t.colViews, t.colEng],
      ...model.topPosts.map((tp) => [tp.rank, tp.title ?? "", tp.viewsN, tp.rate]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${activeName}-${model.range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // In live mode, label each bar from its real bucket start time so the axis
  // matches the actual slices (static weekday/hour names would be wrong).
  const liveLabels =
    isLive && model.barTimes
      ? model.barTimes.map((ms) => {
          const d = new Date(ms);
          if (model.range === "1d") return d.toLocaleTimeString(locale, { hour: "numeric" });
          if (model.range === "7d") return d.toLocaleDateString(locale, { weekday: "short" });
          return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
        })
      : null;
  const barLbls = liveLabels ?? labels;
  const bars = model.bars.map((h, i) => ({
    label: barLbls[i],
    h,
    color: h === 100 ? activeEvent.color : "#c7d7f8",
  }));
  const platSplit = model.platSplit.map((ps) => ({
    name: app.pname(ps.platform),
    color: app.pcolor(ps.platform),
    pct: ps.pct,
    w: ps.pct + "%",
  }));
  const accountPerf = model.accountPerf.map((a) => ({
    name: app.pname(a.platform),
    handle: a.handle,
    color: app.pcolor(a.platform),
    followers: fmt(a.followers),
    views: fmt(a.viewsN),
    eng: fmt(a.engN),
    growth: a.growth,
  }));
  const topPosts = model.topPosts.map((tp) => {
    const parts: string[] = [];
    if (tp.likes != null) parts.push(`♥ ${fmt(tp.likes)}`);
    if (tp.comments != null) parts.push(`💬 ${fmt(tp.comments)}`);
    if (tp.saves != null) parts.push(`🔖 ${fmt(tp.saves)}`);
    if (tp.shares != null) parts.push(`↗ ${fmt(tp.shares)}`);
    return {
      rank: tp.rank,
      ix: tp.rank - 1,
      title: tp.title ?? activeName + " · " + SUFFIX[tp.suffixKey][lang],
      permalink: tp.permalink,
      platName: app.pname(tp.platformKey),
      color: app.pcolor(tp.platformKey),
      views: fmt(tp.viewsN),
      rate: tp.rate,
      metrics: isLive ? parts.join("   ") : "",
    };
  });
  const fmtSplit = model.fmtSplit.map((f) => ({
    name: t[f.typeKey],
    color: f.color,
    pct: f.pct,
    w: f.pct + "%",
  }));
  const bestTime = fmt12(model.bestTimeRaw, lang);

  const rangeDefs: [typeof ui.range, string][] = [
    ["1d", t.rToday],
    ["7d", t.r7],
    ["30d", t.r30],
    ["90d", t.r90],
    ["365d", t.r365],
  ];
  const rangeLabel = (rangeDefs.find((r) => r[0] === model.range) || rangeDefs[1])[1];

  const th = "font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em";
  const grid5 = "display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr 0.8fr;gap:8px";

  return (
    <div style={s("padding:28px 32px;max-width:1060px")}>
      <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:20px")}>
        <div>
          <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.analyticsH2}</h2>
          <p style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:#5c6675;margin:0")}>
            <span><span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span> · {t.analyticsSub}</span>
            <span style={s(`display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:${isLive ? "#e7f6f3" : "#f0f3f7"};color:${isLive ? "#128d81" : "#8b93a1"}`)}>
              <span style={s(`width:6px;height:6px;border-radius:50%;background:${isLive ? "#17a99b" : "#c8d0dc"}`)} />
              {isLive ? t.liveBadge : t.estimatedBadge}
            </span>
          </p>
        </div>
        <div style={s("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <div style={s("display:flex;gap:4px;background:#eef1f5;border-radius:999px;padding:3px")}>
            {([["event", t.viewThisEvent], ["brands", t.viewAllBrands]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setView(k)} style={s(`border:none;cursor:pointer;background:${view === k ? "#fff" : "transparent"};color:${view === k ? "#0f172a" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 14px;border-radius:999px;font-family:inherit;box-shadow:${view === k ? "0 1px 3px rgba(15,23,42,.12)" : "none"}`)}>{label}</button>
            ))}
          </div>
          {view === "event" && (
            <>
              <Hov tag="button" onClick={exportCsv} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:9px 14px;border-radius:999px;font-family:inherit;font-weight:700;font-size:13px;color:#0f172a" hover="border-color:#c8d0dc">{t.exportReport}</Hov>
              <div style={s("position:relative")}>
                <Hov tag="button" onClick={() => patch({ rangeMenuOpen: !ui.rangeMenuOpen })} css="display:flex;align-items:center;gap:10px;border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:9px 16px;border-radius:999px;font-family:inherit;font-weight:700;font-size:13px;color:#0f172a" hover="border-color:#c8d0dc">
                  <span>{rangeLabel}</span>
                  <span style={s("font-size:9px;color:#8b93a1")}>▼</span>
                </Hov>
                {ui.rangeMenuOpen && (
                  <div style={s("position:absolute;top:calc(100% + 6px);inset-inline-end:0;width:180px;background:#fff;border:1px solid #e3e8ef;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.18);padding:6px;z-index:40")}>
                    {rangeDefs.map(([k, l]) => (
                      <Hov key={k} tag="button" onClick={() => patch({ range: k, rangeMenuOpen: false })} css={`width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;border:none;cursor:pointer;background:${k === model.range ? "#f4f6f9" : "transparent"};padding:9px 12px;border-radius:10px;font-family:inherit;text-align:start;font-size:13px;font-weight:600;color:#0f172a`} hover="background:#f4f6f9">{l}</Hov>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {view === "brands" && <AnalyticsOverview />}
      {view === "event" && (
      <>

      {/* KPI cards */}
      <div style={s("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px")}>
        {kpi.map((k, i) => (
          <div key={i} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px")}>
            <div style={s(th + ";margin-bottom:8px")}>{k.label}</div>
            <div style={s("font-family:var(--grotesk);font-weight:700;font-size:28px")}>{k.value}</div>
            <div style={s(`font-size:12px;font-weight:700;color:${k.deltaColor};margin-top:4px`)}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* views chart + by account */}
      <div style={s("display:grid;grid-template-columns:1.4fr 1fr;gap:16px")}>
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:18px")}>{t.viewsOverTime}</div>
          <div style={s("display:flex;align-items:flex-end;gap:10px;height:170px")}>
            {bars.map((b, i) => (
              <div key={i} style={s("flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end")}>
                <div style={s(`width:100%;border-radius:8px 8px 4px 4px;background:${b.color};height:${b.h}%`)} />
                <span style={s("font-size:11px;font-weight:600;color:#8b93a1")}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:18px")}>{t.byPlatform}</div>
          <div style={s("display:flex;flex-direction:column;gap:16px")}>
            {platSplit.map((ps, i) => (
              <div key={i}>
                <div style={s("display:flex;justify-content:space-between;margin-bottom:6px")}>
                  <span style={s("display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600")}><span style={s(`width:8px;height:8px;border-radius:50%;background:${ps.color}`)} />{ps.name}</span>
                  <span style={s("font-size:13px;font-weight:700")}>{ps.pct}%</span>
                </div>
                <div style={s("height:8px;border-radius:4px;background:#f0f3f7")}><div style={s(`height:8px;border-radius:4px;background:${ps.color};width:${ps.w}`)} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* account performance */}
      <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px;margin-top:16px")}>
        <div style={s("font-size:13px;font-weight:700;margin-bottom:8px")}>{t.secAccountPerf}</div>
        <div style={s(grid5 + ";padding:8px 0")}>
          <div style={s(th)}>{t.colAccount}</div>
          <div style={s(th + ";text-align:end")}>{t.colFollowers}</div>
          <div style={s(th + ";text-align:end")}>{t.colViews}</div>
          <div style={s(th + ";text-align:end")}>{t.colEng}</div>
          <div style={s(th + ";text-align:end")}>{t.colGrowth}</div>
        </div>
        {accountPerf.map((a, i) => (
          <div key={i} style={s(grid5 + ";align-items:center;padding:12px 0;border-top:1px solid #f0f3f7")}>
            <div style={s("display:flex;align-items:center;gap:9px;min-width:0")}>
              <span style={s(`width:9px;height:9px;border-radius:50%;background:${a.color};flex:none`)} />
              <div style={s("min-width:0")}>
                <div style={s("font-size:13px;font-weight:700")}>{a.name}</div>
                <div dir="ltr" style={s("font-size:11px;color:#8b93a1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start")}>{a.handle}</div>
              </div>
            </div>
            <div style={s("font-size:13px;font-weight:700;text-align:end")}>{a.followers}</div>
            <div style={s("font-size:13px;text-align:end")}>{a.views}</div>
            <div style={s("font-size:13px;text-align:end")}>{a.eng}</div>
            <div style={s("font-size:13px;font-weight:700;color:#17a99b;text-align:end")}>{a.growth}</div>
          </div>
        ))}
      </div>

      {/* top posts + format/eng */}
      <div style={s("display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-top:16px")}>
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:6px")}>{t.topPostsLabel}</div>
          {topPosts.map((tp) => (
            <Hov key={tp.ix} onClick={() => (tp.permalink ? window.open(tp.permalink, "_blank", "noopener") : patch({ stat: { kind: "top", ix: tp.ix } }))} css="display:flex;align-items:center;gap:12px;padding:11px 8px;border-top:1px solid #f0f3f7;cursor:pointer;border-radius:8px" hover="background:#f8fafc">
              <span style={s("font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;color:#c0c7d2;flex:none;width:16px")}>{tp.rank}</span>
              <div style={s("flex:1;min-width:0")}>
                <div style={s("font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{tp.title}</div>
                <div style={s("display:flex;align-items:center;gap:6px;margin-top:3px")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${tp.color}`)} /><span style={s("font-size:11px;color:#8b93a1")}>{tp.platName}</span></div>
                {tp.metrics && <div dir="ltr" style={s("font-size:11px;color:#8b93a1;margin-top:3px;text-align:start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{tp.metrics}</div>}
              </div>
              <div style={s("text-align:end;flex:none")}>
                <div style={s("font-size:13px;font-weight:700")}>{tp.views}</div>
                <div style={s("font-size:10px;color:#8b93a1;text-transform:uppercase;letter-spacing:.04em")}>{t.colViews}</div>
              </div>
              <div style={s("text-align:end;flex:none;min-width:52px")}>
                <div style={s("font-size:13px;font-weight:700;color:#17a99b")}>{tp.rate}</div>
                <div style={s("font-size:10px;color:#8b93a1;text-transform:uppercase;letter-spacing:.04em")}>{t.colEng}</div>
              </div>
            </Hov>
          ))}
        </div>
        <div style={s("display:flex;flex-direction:column;gap:16px")}>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:16px")}>{t.contentFormat}</div>
            <div style={s("display:flex;flex-direction:column;gap:14px")}>
              {fmtSplit.map((f, i) => (
                <div key={i}>
                  <div style={s("display:flex;justify-content:space-between;margin-bottom:6px")}>
                    <span style={s("display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600")}><span style={s(`width:8px;height:8px;border-radius:50%;background:${f.color}`)} />{f.name}</span>
                    <span style={s("font-size:13px;font-weight:700")}>{f.pct}%</span>
                  </div>
                  <div style={s("height:8px;border-radius:4px;background:#f0f3f7")}><div style={s(`height:8px;border-radius:4px;background:${f.color};width:${f.w}`)} /></div>
                </div>
              ))}
            </div>
          </div>
          <div style={s("display:flex;gap:16px;flex-wrap:wrap")}>
            <div style={s("flex:1;min-width:120px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px")}>
              <div style={s(th + ";margin-bottom:8px")}>{t.engRateLabel}</div>
              <div style={s("font-family:var(--grotesk);font-weight:700;font-size:24px")}>{model.engRateOverall}</div>
            </div>
            <div style={s("flex:1;min-width:120px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px")}>
              <div style={s(th + ";margin-bottom:8px")}>{t.bestTimeLabel}</div>
              <div style={s("font-family:var(--grotesk);font-weight:700;font-size:24px")}>{bestTime}</div>
            </div>
            {isLive && (
              <>
                <div style={s("flex:1;min-width:120px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px")}>
                  <div style={s(th + ";margin-bottom:8px")}>{t.statSaves}</div>
                  <div style={s("font-family:var(--grotesk);font-weight:700;font-size:24px")}>{fmt(model.saves ?? 0)}</div>
                </div>
                <div style={s("flex:1;min-width:120px;background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px")}>
                  <div style={s(th + ";margin-bottom:8px")}>{t.statShares}</div>
                  <div style={s("font-family:var(--grotesk);font-weight:700;font-size:24px")}>{fmt(model.shares ?? 0)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isLive && model.followerGrowth && model.followerGrowth.length > 0 && (
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px;margin-top:16px")}>
          <div style={s("display:flex;justify-content:space-between;align-items:center;margin-bottom:18px")}>
            <span style={s("font-size:13px;font-weight:700")}>{t.secGrowth}</span>
            <span style={s("font-size:12px;color:#8b93a1;font-weight:600")}>{t.growthWindow}</span>
          </div>
          <div style={s("display:flex;align-items:flex-end;gap:3px;height:120px")}>
            {(() => {
              const g = model.followerGrowth!;
              const maxAbs = Math.max(1, ...g.map((d) => Math.abs(d.value)));
              return g.map((d, i) => {
                const h = Math.max(2, Math.round((Math.abs(d.value) / maxAbs) * 100));
                return (
                  <div
                    key={i}
                    title={`${d.date}: ${d.value >= 0 ? "+" : ""}${d.value}`}
                    style={s(`flex:1;min-width:0;height:${h}%;border-radius:4px;background:${d.value >= 0 ? "#17a99b" : "#d64545"}`)}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}

      {isLive && model.audience && <AudiencePanel audience={model.audience} />}
      </>
      )}
    </div>
  );
}
