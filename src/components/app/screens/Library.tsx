"use client";

import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { LIBRARY, libraryHint } from "@/lib/content";

const FILTERS = ["All", "Video", "Reel", "Image"] as const;

export default function Library() {
  const app = useApp();
  const { t, lang } = useLang();
  const { ui, patch, activeEvent, reuseAsset } = app;

  const typeLabel: Record<string, string> = {
    Video: t.typeVideo,
    Reel: t.typeReel,
    Image: t.typeImage,
  };
  const tagColors: Record<string, [string, string]> = {
    Video: ["#eef2f8", "#2563eb"],
    Reel: ["#fdeef4", "#e0457b"],
    Image: ["#fdf6e7", "#b17a09"],
  };
  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;

  const filters = FILTERS.map((f) => {
    const active = ui.libFilter === f;
    return {
      key: f,
      label: f === "All" ? t.filterAll : typeLabel[f],
      bd: active ? "#0f172a" : "#e3e8ef",
      bg: active ? "#0f172a" : "#fff",
      color: active ? "#fff" : "#5c6675",
    };
  });

  const items = LIBRARY.filter((a) => ui.libFilter === "All" || a.type === ui.libFilter);

  return (
    <div style={s("padding:28px 32px;max-width:1060px")}>
      <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.libraryH2}</h2>
      <p style={s("font-size:14px;color:#5c6675;margin:0 0 18px")}><span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span> · {t.librarySub}</p>
      <div style={s("display:flex;gap:8px;margin-bottom:20px")}>
        {filters.map((f) => (
          <button key={f.key} onClick={() => patch({ libFilter: f.key })} style={s(`border:2px solid ${f.bd};cursor:pointer;background:${f.bg};color:${f.color};font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit`)}>{f.label}</button>
        ))}
      </div>
      <div style={s("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px")}>
        {items.map((a) => {
          const [tagBg, tagColor] = tagColors[a.type];
          return (
            <Hov key={a.name} css="background:#fff;border:1px solid #e3e8ef;border-radius:16px;overflow:hidden" hover="box-shadow:0 8px 24px rgba(15,23,42,.10)">
              <div style={s("height:120px;background:repeating-linear-gradient(45deg,#eef1f5 0 10px,#e5e9f0 10px 20px);display:grid;place-items:center;position:relative")}>
                <span style={s("font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#8b93a1")}>{libraryHint(a.hintEn, lang)}</span>
                <span style={s("position:absolute;bottom:8px;inset-inline-end:8px;background:rgba(15,23,42,.85);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px")}>{a.dur}</span>
              </div>
              <div style={s("padding:12px 14px")}>
                <div dir="ltr" style={s("font-size:13px;font-weight:600;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start")}>{a.name}</div>
                <div style={s("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                  <span style={s(`background:${tagBg};color:${tagColor};font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px`)}>{typeLabel[a.type]}</span>
                  <Hov tag="button" onClick={() => reuseAsset({ name: a.name, dur: a.dur, type: a.type })} css="border:none;cursor:pointer;background:#eef2f8;color:#2563eb;font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit;white-space:nowrap" hover="background:#2563eb;color:#fff">{t.reuseBtn}</Hov>
                </div>
              </div>
            </Hov>
          );
        })}
      </div>
    </div>
  );
}
