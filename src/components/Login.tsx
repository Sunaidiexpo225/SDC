"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "./LangProvider";
import { Hov } from "./ui";
import { s } from "@/lib/style";
import { api } from "@/lib/client";
import { useIsMobile } from "@/lib/useIsMobile";

interface Chip {
  id: string;
  nameEn: string;
  nameAr: string;
  color: string;
}

export default function Login() {
  const { t, dir, lang, setLang } = useLang();
  const mobile = useIsMobile();
  const router = useRouter();
  const [step, setStep] = useState<"creds" | "mfa">("creds");
  const [email, setEmail] = useState("sara@sunaidiexpo.com");
  const [pass, setPass] = useState("password");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);

  useEffect(() => {
    fetch("/api/public/events", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setChips(d.events || []))
      .catch(() => {});
  }, []);

  async function signIn() {
    setErr("");
    setBusy(true);
    try {
      const res = await api.post<{ mfaRequired: boolean }>("/api/auth/login", {
        email,
        password: pass,
      });
      // Users with 2FA enrolled go through the code step; everyone else signs
      // in directly and can enable 2FA later from the app.
      if (res.mfaRequired) setStep("mfa");
      else router.push("/app");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }
  async function verifyLogin() {
    setErr("");
    setBusy(true);
    try {
      await api.post("/api/auth/mfa", { code: code || "123456" });
      router.push("/app");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verification failed");
      setBusy(false);
    }
  }
  async function ssoLogin() {
    setErr("");
    setBusy(true);
    try {
      await api.post("/api/auth/sso", { email });
      router.push("/app");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "SSO failed");
      setBusy(false);
    }
  }

  const eventChips = chips.map((e) => ({
    name: lang === "ar" ? e.nameAr : e.nameEn,
    color: e.color,
  }));

  return (
    <div dir={dir} style={s("min-height:100vh;display:flex;background:#f4f6f9")}>
      {/* brand panel — hidden on phones to give the form the full screen */}
      <div style={s(`${mobile ? "display:none;" : "display:flex;"}flex:1;background:#0f172a;color:#fff;padding:56px;flex-direction:column;justify-content:space-between;min-width:0`)}>
        <div style={s("display:flex;align-items:center;gap:10px")}>
          <div style={s("width:34px;height:34px;border-radius:10px;background:#2563eb;display:grid;place-items:center;color:#fff;font-family:var(--grotesk);font-weight:700;font-size:18px")}>✦</div>
          <div style={s("font-family:var(--grotesk);font-weight:700;font-size:18px")}>{t.brand}</div>
        </div>
        <div>
          <h1 style={s("font-family:var(--grotesk);font-weight:700;font-size:40px;line-height:1.1;letter-spacing:-1.5px;margin:0 0 16px;max-width:420px")}>{t.loginBrandH}</h1>
          <p style={s("font-size:16px;line-height:1.6;color:#9aa5b5;margin:0 0 26px;max-width:400px")}>{t.loginBrandSub}</p>
          <div style={s("display:flex;gap:8px;flex-wrap:wrap;max-width:420px")}>
            {eventChips.map((e, i) => (
              <span key={i} style={s("display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 13px;font-size:12px;font-weight:600")}>
                <span style={s(`width:8px;height:8px;border-radius:50%;background:${e.color}`)} />{e.name}
              </span>
            ))}
          </div>
        </div>
        <div style={s("font-size:13px;color:#8b93a1")}>{t.footer2}</div>
      </div>

      {/* form panel */}
      <div style={s(`${mobile ? "width:100%;max-width:none;padding:24px 20px" : "width:480px;max-width:46%;padding:32px 48px"};flex:none;background:#fff;display:flex;flex-direction:column`)}>
        <div style={s("display:flex;align-items:center;justify-content:space-between")}>
          <a onClick={() => router.push("/")} style={s("cursor:pointer;font-size:13px;font-weight:600;color:#5c6675;text-decoration:none")}>{t.backToSite}</a>
          <div style={s("display:flex;gap:2px;background:#f4f6f9;border:1px solid #e3e8ef;border-radius:999px;padding:3px")}>
            {(["en", "ar"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} style={s(`border:none;cursor:pointer;background:${lang === l ? "#0f172a" : "transparent"};color:${lang === l ? "#fff" : "#5c6675"};font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit`)}>{l === "en" ? "EN" : "عربي"}</button>
            ))}
          </div>
        </div>

        <div style={s("flex:1;display:flex;flex-direction:column;justify-content:center;max-width:340px;width:100%;margin:0 auto")}>
          {step === "creds" ? (
            <div>
              <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:26px;letter-spacing:-.5px;margin:0 0 6px")}>{t.loginWelcome}</h2>
              <p style={s("font-size:14px;color:#5c6675;margin:0 0 26px")}>{t.loginSub}</p>
              <label style={s("font-size:13px;font-weight:700;display:block;margin-bottom:8px")}>{t.emailLabel}</label>
              <input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;color:#0f172a;background:#fbfcfe;margin-bottom:16px;text-align:start")} />
              <label style={s("font-size:13px;font-weight:700;display:block;margin-bottom:8px")}>{t.passwordLabel}</label>
              <input dir="ltr" type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:14px;color:#0f172a;background:#fbfcfe;margin-bottom:22px;text-align:start")} />
              {err && <div style={s("font-size:13px;color:#d64545;margin-bottom:14px;font-weight:600")}>{err}</div>}
              <Hov tag="button" onClick={signIn} disabled={busy} css="width:100%;border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:14px;border-radius:999px;font-family:inherit" hover="background:#1d4ed8">{t.signInBtn}</Hov>
              <div style={s("display:flex;align-items:center;gap:12px;margin:20px 0")}>
                <div style={s("flex:1;height:1px;background:#eef1f5")} />
                <span style={s("font-size:12px;color:#a3abb8")}>{t.orWord}</span>
                <div style={s("flex:1;height:1px;background:#eef1f5")} />
              </div>
              <Hov tag="button" onClick={ssoLogin} disabled={busy} css="width:100%;border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#0f172a;font-weight:700;font-size:14px;padding:13px;border-radius:999px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px" hover="border-color:#2563eb;color:#2563eb"><span style={s("width:8px;height:8px;border-radius:2px;background:#2563eb")} />{t.ssoBtn}</Hov>
            </div>
          ) : (
            <div>
              <a onClick={() => { setStep("creds"); setErr(""); }} style={s("cursor:pointer;font-size:13px;font-weight:600;color:#5c6675;text-decoration:none;display:inline-block;margin-bottom:20px")}>{t.backToLogin}</a>
              <div style={s("width:52px;height:52px;border-radius:14px;background:#eef2f8;display:grid;place-items:center;color:#2563eb;font-size:22px;margin-bottom:16px")}>🔒</div>
              <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:24px;letter-spacing:-.5px;margin:0 0 6px")}>{t.mfaStepTitle}</h2>
              <p style={s("font-size:14px;color:#5c6675;margin:0 0 22px")}>{t.mfaStepSub}</p>
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyLogin()} placeholder="••••••" style={s("width:100%;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:12px;padding:14px;font-family:ui-monospace,Menlo,monospace;font-size:22px;letter-spacing:.4em;text-align:center;color:#0f172a;background:#fbfcfe;margin-bottom:20px")} />
              {err && <div style={s("font-size:13px;color:#d64545;margin-bottom:14px;font-weight:600;text-align:center")}>{err}</div>}
              <Hov tag="button" onClick={verifyLogin} disabled={busy} css="width:100%;border:none;cursor:pointer;background:#17a99b;color:#fff;font-weight:700;font-size:15px;padding:14px;border-radius:999px;font-family:inherit" hover="background:#128d81">{t.verifyBtn}</Hov>
              <div style={s("text-align:center;margin-top:16px")}><a onClick={verifyLogin} style={s("cursor:pointer;font-size:13px;font-weight:600;color:#2563eb;text-decoration:none")}>{t.backupCode}</a></div>
            </div>
          )}
        </div>

        <div style={s("display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;color:#a3abb8")}>
          <span style={s("width:6px;height:6px;border-radius:50%;background:#17a99b")} />{t.secureNote}
        </div>
      </div>
    </div>
  );
}
