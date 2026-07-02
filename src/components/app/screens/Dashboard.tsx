"use client";

import { useEffect, useRef } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { fmt } from "@/lib/format";

const KPI_META = [
  { accent: "#2563eb", spark: [52, 60, 58, 72, 80, 76, 92] },
  { accent: "#17a99b", spark: [30, 42, 38, 55, 60, 72, 80] },
  { accent: "#e0457b", spark: [68, 44, 58, 36, 50, 62, 52] },
  { accent: "#f59e0b", spark: [40, 55, 60, 70, 82, 90, 100] },
];
const SPARK_PAT = [
  [46, 58, 52, 70, 64, 82, 100],
  [52, 60, 68, 58, 80, 90, 100],
  [40, 55, 72, 66, 88, 78, 100],
  [60, 52, 74, 68, 84, 92, 100],
  [45, 63, 58, 80, 77, 88, 100],
];
const REACH_BARS = [46, 52, 49, 58, 55, 64, 60, 71, 68, 80, 88, 100];

export default function Dashboard() {
  const app = useApp();
  const { t, lang, locale } = useLang();
  const { data, events, patch } = app;

  // auto-slide the "Upcoming posts" strip (ping-pong, pause on hover)
  const paused = useRef(false);
  const dirRef = useRef(1);
  useEffect(() => {
    const id = setInterval(() => {
      if (paused.current) return;
      const el = document.getElementById("dc-upcoming");
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 2) return;
      let next = el.scrollLeft + dirRef.current;
      if (next >= max) {
        next = max;
        dirRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        dirRef.current = 1;
      }
      el.scrollLeft = next;
    }, 28);
    return () => clearInterval(id);
  }, []);

  const nm = (e: { nameEn: string; nameAr: string }) => (lang === "ar" ? e.nameAr : e.nameEn);
  const aud = (e: (typeof events)[number]) => e.accounts.reduce((sm, a) => sm + a.followers, 0);

  const totalFollowers = events.reduce((sm, e) => sm + aud(e), 0);
  const totalScheduled = data.posts.filter((p) => p.status === "scheduled").length;
  const totalPending = data.approvals.filter((a) => a.status === "pending").length;

  const kpis = [
    { label: t.kpiReach, value: fmt(totalFollowers), sub: t.kpiReachSub, subColor: "#17a99b" },
    { label: t.kpiScheduled, value: String(totalScheduled), sub: t.kpiSchedSub, subColor: "#8b93a1" },
    { label: t.kpiAwaiting, value: String(totalPending), sub: t.kpiAwaitSub, subColor: totalPending ? "#e0457b" : "#8b93a1" },
    { label: t.kpiEvents, value: String(events.length), sub: t.kpiEventsSub, subColor: "#17a99b" },
  ].map((k, i) => ({ ...k, ...KPI_META[i] }));

  const maxAud = Math.max(1, ...events.map(aud));
  const audienceByEvent = events.map((e) => {
    const a = aud(e);
    return { name: nm(e), color: e.color, value: fmt(a), w: Math.round((a / maxAud) * 100) + "%" };
  });

  const reachBars = REACH_BARS.map((h, i) => ({ h, color: i >= 10 ? "#2563eb" : "#c7d7f8" }));
  const totalReachMonth = fmt(Math.round(totalFollowers * 4.2));

  const upcoming = data.posts
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 5)
    .map((p) => {
      const e = app.ev(p.eventId);
      return {
        id: p.id,
        eventName: nm(e),
        color: e.color,
        title: lang === "ar" ? p.titleAr : p.titleEn,
        dateLabel:
          new Date(p.date + "T00:00:00").toLocaleDateString(locale, { month: "short", day: "numeric" }) +
          " · " +
          p.time,
        plats: p.platforms.map((k) => ({ color: app.pcolor(k) })),
        eventId: p.eventId,
      };
    });

  const eventCards = events.map((e, i) => {
    const sched = data.posts.filter((p) => p.eventId === e.id && p.status === "scheduled");
    const upc = sched.map((p) => p.date).sort();
    const nextLabel = upc.length
      ? new Date(upc[0] + "T00:00:00").toLocaleDateString(locale, { month: "short", day: "numeric" })
      : t.dash;
    const onTrack = sched.length >= 3;
    return {
      id: e.id,
      name: nm(e),
      color: e.color,
      audienceBig: fmt(aud(e)),
      spark: SPARK_PAT[i % 5],
      socials: e.accounts.map((a) => app.pcolor(a.platform)),
      accountsCount: e.accounts.length,
      scheduled: sched.length,
      nextLabel,
      statusLabel: onTrack ? t.statusOnTrack : t.statusNeeds,
      statusColor: onTrack ? "#128d81" : "#b17a09",
      statusBg: onTrack ? "#e7f6f3" : "#fdf6e7",
    };
  });

  return (
    <div style={s("padding:28px 32px;max-width:1120px")}>
      <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.dashH2}</h2>
      <p style={s("font-size:14px;color:#5c6675;margin:0 0 24px")}>{t.dashSub}</p>

      {/* KPI cards */}
      <div style={s("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:16px")}>
        {kpis.map((k, i) => (
          <div key={i} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px 20px;overflow:hidden")}>
            <div style={s("font-size:12px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px")}>{k.label}</div>
            <div style={s("font-family:var(--grotesk);font-weight:700;font-size:32px;line-height:1")}>{k.value}</div>
            <div style={s("display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:12px")}>
              <div style={s(`font-size:12px;font-weight:700;color:${k.subColor};max-width:96px`)}>{k.sub}</div>
              <div style={s("display:flex;align-items:flex-end;gap:3px;height:30px")}>
                {k.spark.map((h, j) => (
                  <div key={j} style={s(`width:5px;border-radius:3px;background:${k.accent};height:${h}%;opacity:.85`)} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* reach + audience */}
      <div style={s("display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:24px")}>
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
          <div style={s("display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px")}>
            <div style={s("font-size:13px;font-weight:700")}>{t.reachAllEvents}</div>
            <div style={s("font-size:12px;color:#8b93a1")}>{t.reachMonthSub}</div>
          </div>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:30px;margin-bottom:18px")}>{totalReachMonth}</div>
          <div style={s("display:flex;align-items:flex-end;gap:7px;height:120px")}>
            {reachBars.map((b, i) => (
              <div key={i} style={s(`flex:1;border-radius:6px 6px 3px 3px;background:${b.color};height:${b.h}%`)} />
            ))}
          </div>
        </div>
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:18px")}>{t.audienceByEventLabel}</div>
          <div style={s("display:flex;flex-direction:column;gap:14px")}>
            {audienceByEvent.map((a, i) => (
              <div key={i}>
                <div style={s("display:flex;justify-content:space-between;margin-bottom:6px")}>
                  <span style={s("display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;min-width:0")}><span style={s(`width:8px;height:8px;border-radius:50%;background:${a.color};flex:none`)} /><span style={s("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{a.name}</span></span>
                  <span style={s("font-size:12px;font-weight:700;flex:none")}>{a.value}</span>
                </div>
                <div style={s("height:8px;border-radius:4px;background:#f0f3f7")}><div style={s(`height:8px;border-radius:4px;background:${a.color};width:${a.w}`)} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* upcoming strip */}
      {upcoming.length > 0 && (
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px 22px;margin-bottom:24px")}>
          <div style={s("font-size:13px;font-weight:700;margin-bottom:14px")}>{t.upcomingLabel}</div>
          <div id="dc-upcoming" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)} style={s("display:flex;gap:12px;overflow-x:auto;padding-bottom:4px")}>
            {upcoming.map((u) => (
              <Hov key={u.id} tag="button" onClick={() => patch({ activeEventId: u.eventId, tab: "calendar", platforms: {}, monthOffset: 0, selectedPostId: u.id })} css={`flex:none;width:200px;text-align:start;border:1px solid #eef1f5;border-inline-start:3px solid ${u.color};cursor:pointer;background:#fbfcfe;border-radius:12px;padding:12px 14px;font-family:inherit`} hover="background:#f4f6f9">
                <div style={s(`font-size:11px;font-weight:700;color:${u.color};margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>{u.eventName}</div>
                <div style={s("font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{u.title}</div>
                <div style={s("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={s("font-size:11px;color:#8b93a1")}>{u.dateLabel}</span>
                  <span style={s("display:flex;gap:4px")}>
                    {u.plats.map((pp, j) => (
                      <span key={j} style={s(`width:8px;height:8px;border-radius:50%;background:${pp.color}`)} />
                    ))}
                  </span>
                </div>
              </Hov>
            ))}
          </div>
        </div>
      )}

      {/* event cards */}
      <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:14px")}>
        <div style={s("font-family:var(--grotesk);font-weight:700;font-size:17px")}>{t.yourEvents}</div>
        <div style={s("font-size:13px;color:#8b93a1")}>{t.eventsCount(events.length)}</div>
      </div>
      <div style={s("display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px")}>
        {eventCards.map((e) => (
          <div key={e.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;overflow:hidden")}>
            <div style={s(`height:6px;background:${e.color}`)} />
            <div style={s("padding:20px 22px")}>
              <div style={s("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px")}>
                <div style={s("min-width:0")}>
                  <div style={s("font-family:var(--grotesk);font-weight:700;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{e.name}</div>
                  <div style={s("display:flex;align-items:baseline;gap:6px;margin-top:4px")}>
                    <span style={s(`font-family:var(--grotesk);font-weight:700;font-size:22px;color:${e.color}`)}>{e.audienceBig}</span>
                    <span style={s("font-size:11px;color:#8b93a1")}>{t.kpiReachSub}</span>
                  </div>
                </div>
                <span style={s(`background:${e.statusBg};color:${e.statusColor};font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;white-space:nowrap;flex:none`)}>{e.statusLabel}</span>
              </div>
              <div style={s("display:flex;align-items:flex-end;gap:4px;height:44px;margin-bottom:16px")}>
                {e.spark.map((h, j) => (
                  <div key={j} style={s(`flex:1;border-radius:4px 4px 2px 2px;background:${e.color};height:${h}%;opacity:.28`)} />
                ))}
              </div>
              <div style={s("display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #f0f3f7;padding-top:16px")}>
                <div style={s("display:flex;gap:20px")}>
                  <div>
                    <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px")}>{e.scheduled}</div>
                    <div style={s("font-size:11px;color:#8b93a1")}>{t.cardScheduled}</div>
                  </div>
                  <div>
                    <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px")}>{e.nextLabel}</div>
                    <div style={s("font-size:11px;color:#8b93a1")}>{t.cardNext}</div>
                  </div>
                  <div>
                    <div style={s("display:flex;gap:3px;align-items:center;height:22px")}>
                      {e.socials.map((c, j) => (
                        <span key={j} style={s(`width:9px;height:9px;border-radius:50%;background:${c}`)} />
                      ))}
                    </div>
                    <div style={s("font-size:11px;color:#8b93a1;margin-top:4px")}>{e.accountsCount} {t.accountsWord}</div>
                  </div>
                </div>
                <Hov tag="button" onClick={() => patch({ activeEventId: e.id, tab: "calendar", platforms: {}, monthOffset: 0, selectedPostId: null })} css="border:none;cursor:pointer;background:#0f172a;color:#fff;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit;flex:none" hover="background:#2563eb">{t.cardOpen}</Hov>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
