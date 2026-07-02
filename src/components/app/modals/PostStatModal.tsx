"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { s } from "@/lib/style";
import { fmt } from "@/lib/format";
import { computeAnalytics, postMetrics } from "@/lib/analytics";
import { SUFFIX } from "@/lib/content";

const TREND_BASE = [40, 58, 50, 78, 100, 70, 62];

export default function PostStatModal() {
  const app = useApp();
  const { t, lang, locale, dir } = useLang();
  const { ui, patch, data, activeEvent } = app;

  const close = () => patch({ stat: null });
  if (!ui.stat) return null;
  const st = ui.stat;

  const eventPosts = data.posts.filter((p) => p.eventId === ui.activeEventId);
  const totF = activeEvent.accounts.reduce((sm, a) => sm + a.followers, 0);
  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;

  let title = "";
  let platsArr: string[] = [];
  let base = 0;
  let seed = 0;
  let whenLabel = "";

  if (st.kind === "top") {
    const model = computeAnalytics(activeEvent.accounts, activeEvent.barIx, ui.range);
    const tp = model.topPosts[st.ix];
    if (tp) {
      title = activeName + " · " + SUFFIX[tp.suffixKey][lang];
      platsArr = [tp.platformKey];
      base = tp.viewsN;
      seed = st.ix + 2;
    }
  } else {
    const post = data.posts.find((p) => p.id === st.id);
    if (post) {
      title = lang === "ar" ? post.titleAr : post.titleEn;
      platsArr = post.platforms;
      const idx = eventPosts.indexOf(post);
      const i = idx < 0 ? 0 : idx;
      base = Math.round((totF || 60000) * (0.5 + (i % 5) * 0.18));
      seed = i + 3;
      whenLabel =
        new Date(post.date + "T00:00:00").toLocaleDateString(locale, { month: "long", day: "numeric" }) +
        " · " +
        post.time;
    }
  }

  if (!title) return null;

  const m = postMetrics(base, seed);
  const weights = platsArr.map((k) => {
    const a = activeEvent.accounts.find((x) => x.platform === k);
    return a ? Math.max(1, a.followers) : 1;
  });
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const perAccount = platsArr.map((k, ix) => {
    const pct = Math.round((weights[ix] / wsum) * 100);
    return {
      name: app.pname(k),
      color: app.pcolor(k),
      w: pct + "%",
      reach: fmt(Math.round((m.reach * weights[ix]) / wsum)),
    };
  });
  const rot = seed % 7;
  const trend = TREND_BASE.map((h, ix) => ({
    h,
    color: h === 100 ? activeEvent.color : "#c7d7f8",
    label: t.dows[(ix + rot) % 7],
  }));
  const metrics = [
    { label: t.stViewsLabel, value: fmt(m.views) },
    { label: t.mReach, value: fmt(m.reach) },
    { label: t.engRateLabel, value: m.rate },
    { label: t.mCompletion, value: m.completion },
    { label: t.mLikes, value: fmt(m.likes) },
    { label: t.mComments, value: fmt(m.comments) },
    { label: t.mShares, value: fmt(m.shares) },
    { label: t.mSaves, value: fmt(m.saves) },
  ];

  return (
    <div onClick={close} style={s("position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;z-index:60;padding:24px")}>
      <div dir={dir} onClick={(e) => e.stopPropagation()} style={s("width:600px;max-width:100%;max-height:88vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(15,23,42,.35)")}>
        <div style={s("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid #eef1f5")}>
          <div style={s("min-width:0")}>
            <div style={s("font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8b93a1;margin-bottom:6px")}>{t.postAnalytics}</div>
            <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px")}>{title}</div>
            <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px")}>
              {platsArr.map((k) => (
                <span key={k} style={s("display:inline-flex;align-items:center;gap:6px;background:#f4f6f9;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${app.pcolor(k)}`)} />{app.pname(k)}</span>
              ))}
              {whenLabel && <span style={s("font-size:12px;color:#8b93a1")}>{whenLabel}</span>}
            </div>
          </div>
          <button onClick={close} style={s("border:none;cursor:pointer;background:#f4f6f9;width:30px;height:30px;border-radius:50%;font-family:inherit;color:#5c6675;flex:none")}>✕</button>
        </div>
        <div style={s("padding:22px")}>
          <div style={s("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:22px")}>
            {metrics.map((mm, i) => (
              <div key={i} style={s("background:#f8fafc;border:1px solid #eef1f5;border-radius:12px;padding:14px")}>
                <div style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px")}>{mm.label}</div>
                <div style={s("font-family:var(--grotesk);font-weight:700;font-size:20px")}>{mm.value}</div>
              </div>
            ))}
          </div>
          <div style={s("display:grid;grid-template-columns:1fr 1fr;gap:20px")}>
            <div>
              <div style={s("font-size:13px;font-weight:700;margin-bottom:14px")}>{t.perAccountLabel}</div>
              <div style={s("display:flex;flex-direction:column;gap:14px")}>
                {perAccount.map((pa, i) => (
                  <div key={i}>
                    <div style={s("display:flex;justify-content:space-between;margin-bottom:6px")}>
                      <span style={s("display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600")}><span style={s(`width:8px;height:8px;border-radius:50%;background:${pa.color}`)} />{pa.name}</span>
                      <span style={s("font-size:13px;font-weight:700")}>{pa.reach}</span>
                    </div>
                    <div style={s("height:8px;border-radius:4px;background:#f0f3f7")}><div style={s(`height:8px;border-radius:4px;background:${pa.color};width:${pa.w}`)} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={s("font-size:13px;font-weight:700;margin-bottom:14px")}>{t.viewsTrend}</div>
              <div style={s("display:flex;align-items:flex-end;gap:8px;height:120px")}>
                {trend.map((b, i) => (
                  <div key={i} style={s("flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end")}>
                    <div style={s(`width:100%;border-radius:6px 6px 3px 3px;background:${b.color};height:${b.h}%`)} />
                    <span style={s("font-size:10px;font-weight:600;color:#8b93a1")}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
