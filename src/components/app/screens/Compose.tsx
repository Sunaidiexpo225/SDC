"use client";

import { useRef, useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { addDays, isoDate, fmt12 } from "@/lib/format";
import { uploadMedia } from "@/lib/client";
import { platformMediaUrl, platformAspect, aspectMatches, cldRawUrl } from "@/lib/cloudinaryUrl";

// Videos above ~40 MB can't be transformed by Cloudinary on the current plan,
// so preview (and publish) fall back to the original, uncropped file.
const VIDEO_TRANSFORM_MAX = 40 * 1024 * 1024;
import type { AssetType } from "@/lib/content";

const TIME_OPTS = ["09:00", "12:00", "15:00", "18:00", "20:30"];

export default function Compose() {
  const app = useApp();
  const { t, lang } = useLang();
  const { ui, patch, activeEvent, today } = app;

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file?: File | null) {
    if (!file || uploading) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) return app.toast(t.uploadBadType);
    setUploading(true);
    try {
      // Server validates type/size before any bytes move, then stores via the
      // configured driver (Supabase/S3 direct upload, or Postgres).
      const data = await uploadMedia(file, activeEvent.id);
      patch({
        composeAsset: {
          name: data.filename,
          dur: isImg ? "IMG" : "VID",
          type: data.kind as AssetType,
          mediaId: data.id,
          url: data.url,
          mime: data.mimeType,
          publicId: data.publicId,
          cloudName: data.cloudName,
          resourceType: data.resourceType,
          width: data.width,
          height: data.height,
          size: data.size,
        },
      });
    } catch (e) {
      app.toast(e instanceof Error ? e.message : t.uploadFailed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const typeLabel: Record<string, string> = {
    Video: t.typeVideo,
    Reel: t.typeReel,
    Image: t.typeImage,
  };
  const activeName = lang === "ar" ? activeEvent.nameAr : activeEvent.nameEn;

  const platformList = activeEvent.accounts.map((a) => {
    const on = ui.platforms[a.platform] !== false;
    const color = app.pcolor(a.platform);
    return {
      key: a.platform,
      name: app.pname(a.platform),
      color,
      handle: a.handle,
      on,
      bd: on ? color : "#e3e8ef",
      bg: on ? "#fff" : "#f8fafc",
      stateLabel: on ? t.on : t.off,
      stateColor: on ? color : "#c0c7d2",
    };
  });

  const schedDays = Array.from({ length: 10 }, (_, i) => {
    const d = addDays(today, i);
    const iso = isoDate(d);
    const active = ui.schedDay === iso;
    return {
      iso,
      dow: i === 0 ? t.today : t.dows[d.getDay()],
      num: d.getDate(),
      active,
      bd: active ? "#2563eb" : "#e3e8ef",
      bg: active ? "#2563eb" : "#fff",
      color: active ? "#fff" : "#0f172a",
    };
  });

  const anyPlat = activeEvent.accounts.some((a) => ui.platforms[a.platform] !== false);
  // A post needs at least one account and some content — a caption or media.
  const canSched = anyPlat && (!!ui.caption.trim() || !!ui.composeAsset);

  return (
    <div style={s("padding:28px 32px;max-width:1060px")}>
      <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.composeH2}</h2>
      <p style={s("font-size:14px;color:#5c6675;margin:0 0 24px")}>{t.composeSub} <span style={s(`color:${activeEvent.color};font-weight:700`)}>{activeName}</span></p>
      <div style={s("display:grid;grid-template-columns:1fr 350px;gap:20px;align-items:start")}>
        {/* left: media + caption */}
        <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:22px")}>
          {ui.composeAsset?.url ? (
            <div style={s("margin-bottom:18px")}>
              {ui.composeAsset.type === "Image" ? (
                <img src={ui.composeAsset.url} alt={ui.composeAsset.name} style={s("width:100%;max-height:340px;object-fit:contain;border-radius:14px;display:block;background:#0f172a")} />
              ) : (
                <video src={ui.composeAsset.url} controls style={s("width:100%;max-height:340px;border-radius:14px;display:block;background:#000")} />
              )}
              <div style={s("display:flex;align-items:center;gap:8px;margin-top:10px")}>
                <span dir="ltr" style={s("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#8b93a1;text-align:start")}>{ui.composeAsset.name}</span>
                {ui.composeAsset.type !== "Image" &&
                  (["Video", "Reel"] as const).map((k) => {
                    const on = ui.composeAsset!.type === k;
                    return (
                      <button key={k} onClick={() => patch({ composeAsset: { ...ui.composeAsset!, type: k } })} style={s(`border:2px solid ${on ? "#0f172a" : "#e3e8ef"};cursor:pointer;background:${on ? "#0f172a" : "#fff"};color:${on ? "#fff" : "#5c6675"};font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit`)}>{typeLabel[k]}</button>
                    );
                  })}
                <Hov tag="button" onClick={() => patch({ composeAsset: null })} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit;flex:none" hover="border-color:#d64545;color:#d64545">{t.removeAsset}</Hov>
              </div>
            </div>
          ) : ui.composeAsset ? (
            <div style={s("display:flex;align-items:center;gap:14px;border:1px solid #e3e8ef;border-radius:14px;padding:14px;margin-bottom:18px;background:#fbfcfe")}>
              <div style={s("width:64px;height:64px;border-radius:10px;background:repeating-linear-gradient(45deg,#eef1f5 0 8px,#e5e9f0 8px 16px);flex:none;display:grid;place-items:center")}><span style={s("font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#8b93a1")}>{ui.composeAsset.dur}</span></div>
              <div style={s("flex:1;min-width:0")}>
                <div dir="ltr" style={s("font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start")}>{ui.composeAsset.name}</div>
                <div style={s("font-size:12px;color:#8b93a1;margin-top:2px")}>{typeLabel[ui.composeAsset.type]} · {t.fromLibrary}</div>
              </div>
              <Hov tag="button" onClick={() => patch({ composeAsset: null })} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:12px;padding:8px 14px;border-radius:999px;font-family:inherit;flex:none" hover="border-color:#d64545;color:#d64545">{t.removeAsset}</Hov>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
              style={s(`height:180px;border-radius:14px;background:${dragOver ? "#eef2f8" : "repeating-linear-gradient(45deg,#eef1f5 0 10px,#e5e9f0 10px 20px)"};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;margin-bottom:18px;border:1px dashed ${dragOver ? "#2563eb" : "#c8d0dc"};cursor:pointer;text-align:center;padding:0 16px`)}
            >
              {uploading ? (
                <span style={s("font-size:13px;font-weight:700;color:#2563eb")}>{t.uploading}</span>
              ) : (
                <>
                  <span style={s("font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#8b93a1")}>{t.dropHint}</span>
                  <span style={s("font-size:12px;font-weight:600;color:#2563eb")}>{t.orBrowse}</span>
                  <span style={s("font-size:11px;color:#a3abb8;margin-top:2px")}>{t.uploadLimit(app.data.mediaLimits.imageMb, app.data.mediaLimits.videoMb)}</span>
                </>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={(e) => handleFile(e.target.files?.[0])} style={s("display:none")} />

          {/* Per-platform crops — one master, auto-fit to each platform's aspect */}
          {ui.composeAsset?.publicId && ui.composeAsset.cloudName && (
            <div style={s("margin-bottom:18px")}>
              <div style={s("font-size:12px;font-weight:700;color:#5c6675;margin-bottom:8px")}>{t.perPlatform}</div>
              <div style={s("display:flex;gap:10px;overflow-x:auto;padding-bottom:4px")}>
                {platformList.filter((p) => p.on).map((p) => {
                  const a = ui.composeAsset!;
                  const ar = platformAspect(p.key, a.type);
                  const bigVideo = a.resourceType === "video" && (a.size ?? 0) > VIDEO_TRANSFORM_MAX;
                  const url = bigVideo
                    ? cldRawUrl(a.cloudName!, "video", a.publicId!)
                    : platformMediaUrl(a.cloudName!, a.resourceType || "image", a.publicId!, p.key, a.type, a.width, a.height);
                  const matched = aspectMatches(ar, a.width, a.height);
                  return (
                    <div key={p.key} style={s("flex:none;text-align:center")}>
                      <div style={s(`width:92px;aspect-ratio:${ar.replace(":", " / ")};border-radius:10px;overflow:hidden;background:#0f172a;border:1px solid #e3e8ef`)}>
                        {a.resourceType === "video" ? (
                          <video src={url} muted preload="metadata" style={s("width:100%;height:100%;object-fit:cover")} />
                        ) : (
                          <img src={url} alt="" style={s("width:100%;height:100%;object-fit:cover")} />
                        )}
                      </div>
                      <div style={s("font-size:10px;font-weight:700;color:#5c6675;margin-top:4px")}>{p.name}</div>
                      <div style={s(`font-size:9px;color:${matched ? "#17a99b" : "#a3abb8"}`)}>{matched ? `${ar} ✓` : ar}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:8px")}>
            <label style={s("font-size:13px;font-weight:700")}>{t.captionLabel}</label>
            <Hov tag="button" onClick={app.generate} css={`border:none;cursor:pointer;background:#0f172a;color:#a3e04f;font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit;animation:${ui.generating ? "pulse 1s ease infinite" : "none"}`} hover="background:#1e293b">✦ {ui.generating ? t.genBusy : t.genIdle}</Hov>
          </div>
          <textarea value={ui.caption} onChange={(e) => patch({ caption: e.target.value })} placeholder={t.captionPh} style={s("width:100%;box-sizing:border-box;height:110px;resize:none;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;line-height:1.5;color:#0f172a;background:#fbfcfe")} />
          <div style={s("display:flex;justify-content:space-between;align-items:center;margin-top:8px")}>
            <div style={s("display:flex;gap:6px;flex-wrap:wrap")}>
              {ui.hashtags.map((h, i) => (
                <span key={i} style={s("background:#eef2f8;color:#2563eb;font-size:12px;font-weight:600;padding:5px 10px;border-radius:999px")}>{h}</span>
              ))}
            </div>
            <span style={s("font-size:12px;color:#8b93a1;flex:none")}>{ui.caption.length}/2200</span>
          </div>
        </div>

        {/* right: accounts + schedule */}
        <div style={s("display:flex;flex-direction:column;gap:16px")}>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:20px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:12px")}>{t.publishTo}</div>
            <div style={s("display:flex;flex-direction:column;gap:8px")}>
              {platformList.map((p) => (
                <button key={p.key} onClick={() => patch({ platforms: { ...ui.platforms, [p.key]: !p.on } })} style={s(`display:flex;align-items:center;gap:10px;border:2px solid ${p.bd};cursor:pointer;background:${p.bg};padding:10px 14px;border-radius:12px;font-family:inherit;font-size:14px;font-weight:600;color:#0f172a;text-align:start`)}>
                  <span style={s(`width:10px;height:10px;border-radius:50%;background:${p.color};flex:none`)} />
                  <span style={s("flex:1")}>{p.name}</span>
                  <span dir="ltr" style={s("font-size:11px;font-weight:600;color:#a3abb8")}>{p.handle}</span>
                  <span style={s(`font-size:12px;font-weight:700;color:${p.stateColor}`)}>{p.stateLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:20px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:12px")}>{t.scheduleFor}</div>
            <div style={s("display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:12px")}>
              {schedDays.map((d) => (
                <button key={d.iso} onClick={() => patch({ schedDay: d.iso })} style={s(`flex:none;border:2px solid ${d.bd};cursor:pointer;background:${d.bg};color:${d.color};border-radius:12px;padding:8px 0;width:54px;font-family:inherit;text-align:center`)}>
                  <div style={s("font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em")}>{d.dow}</div>
                  <div style={s("font-size:17px;font-weight:700")}>{d.num}</div>
                </button>
              ))}
            </div>
            <div style={s("display:flex;align-items:center;gap:10px;margin-bottom:12px")}>
              <input type="time" value={ui.schedTime} onChange={(e) => patch({ schedTime: e.target.value || ui.schedTime })} style={s("border:1px solid #e3e8ef;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:15px;font-weight:700;color:#0f172a;background:#fbfcfe")} />
              <span style={s("font-size:13px;font-weight:700;color:#5c6675")}>{fmt12(ui.schedTime, lang)}</span>
            </div>
            <div style={s("display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px")}>
              {TIME_OPTS.map((tm) => {
                const active = ui.schedTime === tm;
                return (
                  <button key={tm} onClick={() => patch({ schedTime: tm })} style={s(`border:2px solid ${active ? "#0f172a" : "#e3e8ef"};cursor:pointer;background:${active ? "#0f172a" : "#fff"};color:${active ? "#fff" : "#5c6675"};font-weight:700;font-size:13px;padding:7px 13px;border-radius:999px;font-family:inherit`)}>{tm}</button>
                );
              })}
            </div>
            {(() => {
              const autoOn = app.data.autoPublishConfigured && app.data.settings.autoPublish;
              if (!autoOn) {
                return <div style={s("display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:12px;font-weight:600;color:#8b93a1")}><span style={s("width:7px;height:7px;border-radius:50%;background:#c0c7d2;flex:none")} />{t.autoPubOff}</div>;
              }
              const d = new Date(ui.schedDay + "T00:00:00");
              const when = `${d.toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "short", day: "numeric" })} · ${fmt12(ui.schedTime, lang)}`;
              return (
                <div style={s("display:flex;align-items:center;gap:7px;margin-bottom:10px;background:#e7f6f3;border-radius:10px;padding:8px 12px")}>
                  <span style={s("font-size:13px;flex:none")}>⚡</span>
                  <span style={s("font-size:12px;font-weight:700;color:#128d81")}>{app.canApprove ? t.autoPubAt(when) : t.autoPubWhenApproved}</span>
                </div>
              );
            })()}
            <div style={s("display:flex;gap:8px")}>
              <Hov tag="button" onClick={() => app.schedule(false)} disabled={!canSched} css={`flex:1;border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:14px;border-radius:999px;font-family:inherit;opacity:${canSched ? 1 : 0.45}`} hover={canSched ? "background:#1d4ed8" : ""}>{t.schedulePost}</Hov>
              {app.canApprove && (
                <Hov tag="button" onClick={() => app.schedule(true)} disabled={!canSched} title={t.publishNow} css={`flex:none;border:none;cursor:pointer;background:#0f172a;color:#fff;font-weight:700;font-size:15px;padding:14px 18px;border-radius:999px;font-family:inherit;opacity:${canSched ? 1 : 0.45};display:inline-flex;align-items:center;gap:6px`} hover={canSched ? "background:#1e293b" : ""}>▸ {t.publishNow}</Hov>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
