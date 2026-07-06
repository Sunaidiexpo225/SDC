"use client";

import { useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { segStyle, roleLabelOf } from "../helpers";
import { PLATFORMS } from "@/lib/platforms";
import type { Role } from "@/lib/types";

const ADMIN_PALETTE = ["#e0457b", "#17a99b", "#7c5cf0", "#2563eb", "#f59e0b", "#0ea5a3"];
const ROLES: Role[] = ["Admin", "Manager", "Editor", "Viewer"];

export default function Admin() {
  const app = useApp();
  const { t, lang } = useLang();
  const { ui, patch, data, events } = app;
  const settings = data.settings;
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [extIds, setExtIds] = useState<Record<string, string>>({});

  const section = ui.adminSection;
  const adminSections: [typeof section, string][] = [
    ["users", t.secUsers],
    ["events", t.secEvents],
    ["integrations", t.secIntegrations],
    ["settings", t.secSettings],
  ];

  const mfaCount = data.users.filter((u) => u.mfaEnabled).length;

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={s(`width:46px;height:26px;border-radius:999px;background:${on ? "#17a99b" : "#dce1e8"};border:none;cursor:pointer;position:relative;flex:none`)}>
      <span style={s(`position:absolute;top:3px;inset-inline-start:${on ? "23px" : "3px"};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25)`)} />
    </button>
  );

  const Seg = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => {
    const st = segStyle(active);
    return (
      <button onClick={onClick} style={s(`border:2px solid ${st.bd};cursor:pointer;background:${st.bg};color:${st.color};font-weight:700;font-size:13px;padding:8px 18px;border-radius:999px;font-family:inherit`)}>{label}</button>
    );
  };

  return (
    <div style={s("padding:28px 32px;max-width:1000px")}>
      <div style={s("margin-bottom:20px")}>
        <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.adminH2}</h2>
        <p style={s("font-size:14px;color:#5c6675;margin:0")}>{t.adminSub}</p>
      </div>
      <div style={s("display:flex;gap:6px;margin-bottom:24px")}>
        {adminSections.map(([k, l]) => {
          const st = segStyle(section === k);
          return (
            <button key={k} onClick={() => patch({ adminSection: k })} style={s(`border:2px solid ${st.bd};cursor:pointer;background:${st.bg};color:${st.color};font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit`)}>{l}</button>
          );
        })}
      </div>

      {/* USERS */}
      {section === "users" && (
        <>
          <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:14px")}>
            <div style={s("font-size:13px;color:#8b93a1;font-weight:600")}>{data.users.length} · {mfaCount} MFA</div>
            <Hov tag="button" onClick={() => patch({ inviteOpen: true, invName: "", invEmail: "", invRole: "Editor" })} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit" hover="background:#1d4ed8">{t.inviteUser}</Hov>
          </div>
          <div style={s("display:flex;flex-direction:column;gap:12px")}>
            {data.users.map((u) => {
              const on = u.mfaEnabled;
              const badge = on
                ? { l: t.mfaOn, bg: "#e7f6f3", c: "#128d81" }
                : settings.requireMfa
                  ? { l: t.mfaRequired, bg: "#fdf2f2", c: "#d64545" }
                  : { l: t.mfaOff, bg: "#f0f3f7", c: "#8b93a1" };
              const canApprove = u.role === "Admin" || u.role === "Manager";
              return (
                <div key={u.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:16px 18px")}>
                  <div style={s("display:flex;align-items:center;gap:14px;margin-bottom:14px")}>
                    <div style={s(`width:40px;height:40px;border-radius:50%;background:${u.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:14px;flex:none`)}>{u.init}</div>
                    <div style={s("flex:1;min-width:0")}>
                      <div style={s("display:flex;align-items:center;gap:8px")}>
                        <span style={s("font-size:14px;font-weight:700")}>{u.name}</span>
                        {canApprove && <span style={s("background:#eef2f8;color:#2563eb;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px")}>{t.approverTag}</span>}
                      </div>
                      <div dir="ltr" style={s("font-size:12px;color:#8b93a1;text-align:start")}>{u.email}</div>
                    </div>
                    <span style={s(`background:${u.status === "active" ? "#e7f6f3" : "#fdf6e7"};color:${u.status === "active" ? "#128d81" : "#b17a09"};font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;flex:none`)}>{u.status === "active" ? t.statusActive : t.statusInvited}</span>
                    <Hov tag="button" onClick={() => app.removeUser(u.id)} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#8b93a1;font-weight:700;font-size:12px;padding:7px 12px;border-radius:999px;font-family:inherit;flex:none" hover="border-color:#d64545;color:#d64545">{t.removeUser}</Hov>
                  </div>
                  <div style={s("display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid #f0f3f7;padding-top:14px")}>
                    <div style={s("display:flex;align-items:center;gap:8px")}>
                      <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em")}>{t.roleColLabel}</span>
                      <div style={s("display:flex;gap:4px")}>
                        {ROLES.map((r) => {
                          const a = u.role === r;
                          return (
                            <button key={r} onClick={() => app.setUserRole(u.id, r)} style={s(`border:1px solid ${a ? "#2563eb" : "#e3e8ef"};cursor:pointer;background:${a ? "#eef2f8" : "#fff"};color:${a ? "#2563eb" : "#8b93a1"};font-weight:700;font-size:12px;padding:6px 12px;border-radius:8px;font-family:inherit`)}>{roleLabelOf(r, t)}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={s("display:flex;align-items:center;gap:8px;margin-inline-start:auto")}>
                      <span style={s(`background:${badge.bg};color:${badge.c};font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px`)}>{badge.l}</span>
                      <Hov tag="button" onClick={() => (on ? app.resetMfa(u.id) : app.enableMfaOpen(u.id))} css="border:1px solid #dbe1ea;cursor:pointer;background:#fff;color:#0f172a;font-weight:700;font-size:12px;padding:7px 14px;border-radius:999px;font-family:inherit" hover="border-color:#2563eb;color:#2563eb">{on ? t.resetMfa : t.enableMfa}</Hov>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* EVENTS */}
      {section === "events" && (
        <>
          <div style={s("display:flex;align-items:center;justify-content:space-between;margin-bottom:14px")}>
            <div style={s("font-size:13px;color:#8b93a1;font-weight:600")}>{t.eventsManageSub}</div>
            <Hov tag="button" onClick={() => patch({ addOpen: true, newName: "" })} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:10px 18px;border-radius:999px;font-family:inherit" hover="background:#1d4ed8">{t.addEvent}</Hov>
          </div>
          <div style={s("display:flex;flex-direction:column;gap:12px")}>
            {events.map((e) => (
              <div key={e.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap")}>
                <span style={s(`width:14px;height:14px;border-radius:50%;background:${e.color};flex:none`)} />
                <input value={e.nameEn} onChange={(ev) => app.renameEvent(e.id, ev.target.value)} style={s("flex:1;min-width:160px;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;font-weight:600;color:#0f172a;background:#fbfcfe")} />
                <span style={s("font-size:12px;color:#8b93a1;flex:none")}>{t.accountsCount(e.accounts.length)}</span>
                <div style={s("display:flex;gap:7px;flex:none")}>
                  {ADMIN_PALETTE.map((c) => (
                    <button key={c} onClick={() => app.setEventColor(e.id, c)} style={s(`width:26px;height:26px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 0 2px ${e.color === c ? "#0f172a" : "transparent"};cursor:pointer;flex:none`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* INTEGRATIONS */}
      {section === "integrations" && (
        <>
          <div style={s("font-size:13px;color:#8b93a1;font-weight:600;margin-bottom:16px")}>{t.integrationsSub}</div>
          <div style={s("display:flex;flex-direction:column;gap:22px")}>
            {events.map((e) => {
              const connCount = e.accounts.filter((a) => a.connected).length;
              const addable = PLATFORMS.filter((p) => !e.accounts.some((a) => a.platform === p.key));
              return (
                <div key={e.id}>
                  <div style={s("display:flex;align-items:center;gap:10px;margin-bottom:10px")}>
                    <span style={s(`width:12px;height:12px;border-radius:50%;background:${e.color};flex:none`)} />
                    <span style={s("font-family:var(--grotesk);font-size:16px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{lang === "ar" ? e.nameAr : e.nameEn}</span>
                    <span style={s("font-size:12px;font-weight:700;color:#8b93a1;flex:none")}>{t.connectedOf(connCount, e.accounts.length)}</span>
                  </div>
                  <div style={s("display:flex;flex-direction:column;gap:8px")}>
                    {e.accounts.map((a) => (
                      <div key={a.id} style={s("background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
                        <span style={s(`width:10px;height:10px;border-radius:50%;background:${app.pcolor(a.platform)};flex:none`)} />
                        <div style={s("min-width:120px")}>
                          <div style={s("font-size:13px;font-weight:700")}>{app.pname(a.platform)}</div>
                          <div dir="ltr" style={s("font-size:12px;color:#8b93a1;text-align:start")}>{a.handle}</div>
                        </div>
                        <span style={s(`background:${a.connected ? "#e7f6f3" : "#f0f3f7"};color:${a.connected ? "#128d81" : "#8b93a1"};font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;flex:none`)}>{a.connected ? t.apiConnected : t.apiNotConnected}</span>
                        {a.connected ? (
                          <>
                            <div dir="ltr" style={s("flex:1;min-width:120px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#5c6675;background:#f4f6f9;border-radius:8px;padding:9px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:start")}>{a.apiKey}</div>
                            <Hov tag="button" onClick={() => app.disconnectApi(a.id)} css="border:1px solid #f3c1c1;cursor:pointer;background:#fff;color:#d64545;font-weight:700;font-size:12px;padding:9px 16px;border-radius:999px;font-family:inherit;flex:none" hover="background:#fdf2f2">{t.disconnect}</Hov>
                          </>
                        ) : (
                          <>
                            <input dir="ltr" value={keys[a.id] || ""} onChange={(ev) => setKeys((p) => ({ ...p, [a.id]: ev.target.value }))} placeholder={t.apiKeyPh} style={s("flex:1;min-width:150px;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:8px;padding:9px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#0f172a;background:#fbfcfe;text-align:start")} />
                            <input dir="ltr" value={extIds[a.id] || ""} onChange={(ev) => setExtIds((p) => ({ ...p, [a.id]: ev.target.value }))} placeholder={t.accountIdPh} style={s("flex:1;min-width:130px;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:8px;padding:9px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#0f172a;background:#fbfcfe;text-align:start")} />
                            <Hov tag="button" onClick={() => app.connectApi(a.id, keys[a.id] || "", extIds[a.id] || "")} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:12px;padding:9px 18px;border-radius:999px;font-family:inherit;flex:none" hover="background:#1d4ed8">{t.connect}</Hov>
                          </>
                        )}
                        <Hov tag="button" onClick={() => app.removeSocial(a.id)} title={t.removeAccountTitle} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#a3abb8;font-weight:700;font-size:13px;width:32px;height:32px;border-radius:50%;font-family:inherit;flex:none" hover="border-color:#d64545;color:#d64545">✕</Hov>
                      </div>
                    ))}
                  </div>
                  {addable.length > 0 && (
                    <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px")}>
                      <span style={s("font-size:12px;font-weight:700;color:#8b93a1")}>{t.addAccountLabel}:</span>
                      {addable.map((ad) => (
                        <Hov key={ad.key} tag="button" onClick={() => app.addSocial(e.id, ad.key)} css="border:1px dashed #c8d0dc;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:12px;padding:6px 12px;border-radius:999px;font-family:inherit;display:inline-flex;align-items:center;gap:6px" hover="border-color:#2563eb;color:#2563eb"><span style={s(`width:8px;height:8px;border-radius:50%;background:${ad.color}`)} />+ {ad[lang]}</Hov>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* SETTINGS */}
      {section === "settings" && (
        <div style={s("display:flex;flex-direction:column;gap:16px")}>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:12px")}>{t.setLangLabel}</div>
            <div style={s("display:flex;gap:6px")}>
              <Seg active={lang === "en"} label="English" onClick={() => app.updateSettings({ lang: "en" })} />
              <Seg active={lang === "ar"} label="العربية" onClick={() => app.updateSettings({ lang: "ar" })} />
            </div>
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:12px")}>{t.setWeekLabel}</div>
            <div style={s("display:flex;gap:6px")}>
              <Seg active={!settings.weekStartsMonday} label={t.sunday} onClick={() => app.updateSettings({ weekStartsMonday: false })} />
              <Seg active={settings.weekStartsMonday} label={t.monday} onClick={() => app.updateSettings({ weekStartsMonday: true })} />
            </div>
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px")}>
            <div style={s("font-size:13px;font-weight:700;margin-bottom:12px")}>{t.setToneLabel}</div>
            <div style={s("display:flex;gap:6px;flex-wrap:wrap")}>
              <Seg active={settings.tone === "punchy"} label={t.tonePunchy} onClick={() => app.updateSettings({ tone: "punchy" })} />
              <Seg active={settings.tone === "professional"} label={t.toneProfessional} onClick={() => app.updateSettings({ tone: "professional" })} />
              <Seg active={settings.tone === "friendly"} label={t.toneFriendly} onClick={() => app.updateSettings({ tone: "friendly" })} />
            </div>
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px;display:flex;align-items:center;gap:16px")}>
            <div style={s("flex:1;min-width:0")}>
              <div style={s("font-size:14px;font-weight:700;margin-bottom:3px")}>{t.setMfaLabel}</div>
              <div style={s("font-size:12px;color:#8b93a1")}>{t.setMfaDesc}</div>
            </div>
            <Toggle on={settings.requireMfa} onClick={() => app.updateSettings({ requireMfa: !settings.requireMfa })} />
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:20px;display:flex;align-items:center;gap:16px")}>
            <div style={s("flex:1;min-width:0")}>
              <div style={s("font-size:14px;font-weight:700;margin-bottom:3px")}>{t.setAutoLabel}</div>
              <div style={s("font-size:12px;color:#8b93a1")}>{t.setAutoDesc}</div>
            </div>
            <Toggle on={settings.autoPublish} onClick={() => app.updateSettings({ autoPublish: !settings.autoPublish })} />
          </div>
        </div>
      )}
    </div>
  );
}
