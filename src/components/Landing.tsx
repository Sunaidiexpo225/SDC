"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "./LangProvider";
import { Hov, Box } from "./ui";
import { s } from "@/lib/style";
import { useIsMobile } from "@/lib/useIsMobile";

interface Chip {
  id: string;
  nameEn: string;
  nameAr: string;
  color: string;
}

export default function Landing() {
  const { t, dir, lang, locale, setLang } = useLang();
  const mobile = useIsMobile();
  const router = useRouter();
  const [chips, setChips] = useState<Chip[]>([]);

  useEffect(() => {
    fetch("/api/public/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setChips(d.events || []))
      .catch(() => {});
  }, []);

  const heroMonth = useMemo(
    () =>
      new Date().toLocaleDateString(locale, { month: "long", year: "numeric" }),
    [locale],
  );

  const goApp = () => router.push("/login");
  const eventChips = chips.map((e) => ({
    name: lang === "ar" ? e.nameAr : e.nameEn,
    color: e.color,
  }));

  const LangPill = () => (
    <div style={s("display:flex;gap:2px;background:#fff;border:1px solid #e3e8ef;border-radius:999px;padding:3px")}>
      {(["en", "ar"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={s(
            `border:none;cursor:pointer;background:${lang === l ? "#0f172a" : "transparent"};color:${lang === l ? "#fff" : "#5c6675"};font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit`,
          )}
        >
          {l === "en" ? "EN" : "عربي"}
        </button>
      ))}
    </div>
  );

  const featureCards = [
    { icon: "⧉", bg: "#2563eb", fs: "18px", t: t.f1t, d: t.f1d },
    { icon: "✦", bg: "#e0457b", fs: "18px", t: t.f2t, d: t.f2d },
    { icon: "⇄", bg: "#17a99b", fs: "18px", t: t.f3t, d: t.f3d },
    { icon: "▁▄▇", bg: "#7c5cf0", fs: "14px", t: t.f4t, d: t.f4d },
    { icon: "▤", bg: "#f59e0b", fs: "18px", t: t.f5t, d: t.f5d },
    { icon: "✓", bg: "#0f172a", fs: "18px", t: t.f6t, d: t.f6d },
  ];
  const steps = [
    { n: "01", color: "#2563eb", t: t.s1t, d: t.s1d },
    { n: "02", color: "#e0457b", t: t.s2t, d: t.s2d },
    { n: "03", color: "#17a99b", t: t.s3t, d: t.s3d },
  ];

  return (
    <div dir={dir} style={s("min-height:100vh;background:#f4f6f9")}>
      {/* nav */}
      <div style={s("display:flex;align-items:center;justify-content:space-between;padding:20px 48px;max-width:1200px;margin:0 auto")}>
        <div style={s("display:flex;align-items:center;gap:10px")}>
          <div style={s("width:34px;height:34px;border-radius:10px;background:#2563eb;display:grid;place-items:center;color:#fff;font-family:var(--grotesk);font-weight:700;font-size:18px")}>✦</div>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px;letter-spacing:-.3px")}>{t.brand}</div>
        </div>
        <div style={s("display:flex;align-items:center;gap:22px")}>
          {!mobile && <a href="#features" style={s("font-size:14px;font-weight:600;color:#0f172a;text-decoration:none")}>{t.navFeatures}</a>}
          {!mobile && <a href="#how" style={s("font-size:14px;font-weight:600;color:#0f172a;text-decoration:none")}>{t.navHow}</a>}
          <LangPill />
          <Hov tag="button" onClick={goApp} css="border:none;cursor:pointer;background:#0f172a;color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:999px;font-family:inherit" hover="background:#2563eb">{t.openApp}</Hov>
        </div>
      </div>

      {/* hero */}
      <div style={s("max-width:1200px;margin:0 auto;padding:60px 48px 36px;display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center")}>
        <div>
          <div style={s("display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #e3e8ef;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;margin-bottom:22px")}>
            <span style={s("width:7px;height:7px;border-radius:50%;background:#e0457b")} />{t.badge}
          </div>
          <h1 style={s(`font-family:var(--grotesk);font-weight:700;font-size:${mobile ? "34px" : "60px"};line-height:1.08;letter-spacing:${mobile ? "-1px" : "-2.5px"};margin:0 0 20px`)}>
            {t.h1a}<br />{t.h1b} <span style={s("color:#2563eb")}>{t.h1c}</span>
          </h1>
          <p style={s("font-size:18px;line-height:1.6;color:#5c6675;margin:0 0 30px;max-width:490px")}>{t.heroSub}</p>
          <div style={s("display:flex;gap:12px;align-items:center;margin-bottom:36px")}>
            <Hov tag="button" onClick={goApp} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px;font-family:inherit;box-shadow:0 8px 20px rgba(37,99,235,.28)" hover="background:#1d4ed8">{t.launchApp}</Hov>
            <a href="#features" style={s("font-weight:700;font-size:15px;color:#0f172a;text-decoration:none;padding:15px 20px")}>{t.seeFeatures}</a>
          </div>
          <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <span style={s("font-size:12px;font-weight:600;color:#8b93a1;text-transform:uppercase;letter-spacing:.06em")}>{t.eventsRun}</span>
            {eventChips.map((e, i) => (
              <span key={i} style={s("display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e3e8ef;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:600")}>
                <span style={s(`width:8px;height:8px;border-radius:50%;background:${e.color}`)} />{e.name}
              </span>
            ))}
          </div>
        </div>

        {/* hero collage — decorative, hidden on phones */}
        <div style={s(`position:relative;height:460px${mobile ? ";display:none" : ""}`)}>
          <div style={s("position:absolute;top:30px;inset-inline-end:6px;width:320px;background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:18px;box-shadow:0 20px 50px rgba(15,23,42,.10);transform:rotate(2deg)")}>
            <div style={s("font-size:12px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px")}>{heroMonth}</div>
            <div style={s("display:grid;grid-template-columns:repeat(7,1fr);gap:6px")}>
              {["#f4f6f9", "#f4f6f9", "#e0457b", "#f4f6f9", "#17a99b", "#f4f6f9", "#f4f6f9", "#f59e0b", "#f4f6f9", "#f4f6f9", "#7c5cf0", "#f4f6f9", "#f4f6f9", "#2563eb"].map((c, i) => (
                <div key={i} style={s(`height:34px;border-radius:8px;background:${c}`)} />
              ))}
            </div>
          </div>
          <div style={s("position:absolute;bottom:24px;inset-inline-start:0;width:300px;background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:18px;box-shadow:0 20px 50px rgba(15,23,42,.12);transform:rotate(-2deg)")}>
            <div style={s("height:110px;border-radius:12px;background:repeating-linear-gradient(45deg,#eef1f5 0 10px,#e5e9f0 10px 20px);display:grid;place-items:center;margin-bottom:14px")}><span style={s("font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#8b93a1")}>{t.reelHint}</span></div>
            <div style={s("height:10px;border-radius:5px;background:#eef1f5;margin-bottom:8px;width:90%")} />
            <div style={s("height:10px;border-radius:5px;background:#eef1f5;margin-bottom:14px;width:65%")} />
            <div style={s("display:flex;gap:6px;align-items:center")}>
              <span style={s("width:22px;height:22px;border-radius:50%;background:#e0457b")} />
              <span style={s("width:22px;height:22px;border-radius:50%;background:#17a99b")} />
              <span style={s("width:22px;height:22px;border-radius:50%;background:#2563eb")} />
              <span style={s("margin-inline-start:auto;background:#0f172a;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;border-radius:999px")}>{t.scheduleWord}</span>
            </div>
          </div>
          <div style={s("position:absolute;top:6px;inset-inline-start:44px;background:#a3e04f;color:#0f172a;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;transform:rotate(-4deg);box-shadow:0 8px 18px rgba(15,23,42,.10)")}>{t.chipAi}</div>
          <div style={s("position:absolute;bottom:150px;inset-inline-end:20px;background:#0f172a;color:#fff;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;transform:rotate(3deg)")}>{t.chipEvents}</div>
        </div>
      </div>

      {/* features */}
      <div id="features" style={s("max-width:1200px;margin:0 auto;padding:56px 48px")}>
        <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:40px;letter-spacing:-1.5px;margin:0 0 8px")}>{t.featH2}</h2>
        <p style={s("font-size:16px;color:#5c6675;margin:0 0 36px")}>{t.featSub}</p>
        <div style={s("display:grid;grid-template-columns:repeat(3,1fr);gap:18px")}>
          {featureCards.map((f, i) => (
            <div key={i} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:26px")}>
              <div style={s(`width:40px;height:40px;border-radius:12px;background:${f.bg};display:grid;place-items:center;color:#fff;font-size:${f.fs};margin-bottom:16px`)}>{f.icon}</div>
              <div style={s("font-family:var(--grotesk);font-weight:700;font-size:19px;margin-bottom:6px")}>{f.t}</div>
              <p style={s("font-size:14px;line-height:1.6;color:#5c6675;margin:0")}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* how */}
      <div id="how" style={s("max-width:1200px;margin:0 auto;padding:24px 48px 64px")}>
        <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:40px;letter-spacing:-1.5px;margin:0 0 36px")}>{t.howH2}</h2>
        <div style={s("display:grid;grid-template-columns:repeat(3,1fr);gap:18px")}>
          {steps.map((st, i) => (
            <div key={i} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:18px;padding:26px")}>
              <div style={s(`font-family:var(--grotesk);font-weight:700;font-size:15px;color:${st.color};margin-bottom:10px`)}>{st.n}</div>
              <div style={s("font-family:var(--grotesk);font-weight:700;font-size:20px;margin-bottom:6px")}>{st.t}</div>
              <p style={s("font-size:14px;line-height:1.6;color:#5c6675;margin:0")}>{st.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={s("max-width:1200px;margin:0 auto;padding:0 48px 72px")}>
        <div style={s(`background:#0f172a;border-radius:24px;padding:${mobile ? "32px 24px" : "56px"};display:flex;align-items:${mobile ? "flex-start" : "center"};${mobile ? "flex-direction:column;" : ""}justify-content:space-between;gap:${mobile ? "22px" : "32px"}`)}>
          <div>
            <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:38px;letter-spacing:-1.5px;color:#fff;margin:0 0 8px")}>{t.ctaH2}</h2>
            <p style={s("font-size:16px;color:#9aa5b5;margin:0")}>{t.ctaSub}</p>
          </div>
          <Hov tag="button" onClick={goApp} css="border:none;cursor:pointer;background:#a3e04f;color:#0f172a;font-weight:700;font-size:16px;padding:16px 30px;border-radius:999px;font-family:inherit;white-space:nowrap" hover="background:#b6ec66">{t.launchApp}</Hov>
        </div>
        <div style={s("display:flex;justify-content:space-between;padding:28px 4px 0;font-size:13px;color:#8b93a1")}>
          <span>{t.footer1}</span>
          <span>{t.footer2}</span>
        </div>
      </div>
    </div>
  );
}
