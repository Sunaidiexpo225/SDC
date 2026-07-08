"use client";

import { useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { GLOBAL_ROLES, type Role, type EventDTO, type UserDTO } from "@/lib/types";

// Per-user event-access editor shown in Admin → Users. Global roles (Admin /
// Manager) see everything, so it just says so. Event-scoped roles (Assistant
// Manager / Editor / Viewer) get a checkbox per event; Save persists the set.
export default function UserEventAccess({ user, events }: { user: UserDTO; events: EventDTO[] }) {
  const app = useApp();
  const { t, lang } = useLang();
  const [sel, setSel] = useState<string[]>(user.eventIds);
  const [saving, setSaving] = useState(false);

  if (GLOBAL_ROLES.includes(user.role as Role)) {
    return (
      <div style={s("border-top:1px solid #f0f3f7;padding-top:14px;margin-top:2px")}>
        <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em")}>{t.eventAccessTitle}</span>
        <div style={s("font-size:13px;color:#5c6675;font-weight:600;margin-top:6px")}>{t.eventAccessAll}</div>
      </div>
    );
  }

  const toggle = (id: string) =>
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const dirty =
    sel.length !== user.eventIds.length || sel.some((id) => !user.eventIds.includes(id));

  const save = async () => {
    setSaving(true);
    try {
      await app.setUserEvents(user.id, sel);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s("border-top:1px solid #f0f3f7;padding-top:14px;margin-top:2px")}>
      <div style={s("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px")}>
        <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em")}>{t.eventAccessTitle}</span>
        <span style={s("font-size:11px;color:#8b93a1;font-weight:600")}>{t.eventAccessCount(sel.length)}</span>
      </div>
      <div style={s("font-size:12px;color:#8b93a1;margin-bottom:10px")}>{t.eventAccessSub}</div>
      <div style={s("display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px")}>
        {events.map((e) => {
          const on = sel.includes(e.id);
          return (
            <button key={e.id} onClick={() => toggle(e.id)} style={s(`display:inline-flex;align-items:center;gap:7px;border:1px solid ${on ? "#2563eb" : "#e3e8ef"};cursor:pointer;background:${on ? "#eef2f8" : "#fff"};color:${on ? "#2563eb" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 13px;border-radius:999px;font-family:inherit`)}>
              <span style={s(`width:9px;height:9px;border-radius:50%;background:${e.color};flex:none`)} />
              {lang === "ar" ? e.nameAr : e.nameEn}
              {on && <span style={s("font-size:11px")}>✓</span>}
            </button>
          );
        })}
      </div>
      {dirty && (
        <Hov tag="button" onClick={save} css={`border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:12px;padding:8px 16px;border-radius:999px;font-family:inherit;opacity:${saving ? 0.6 : 1}`} hover="background:#1d4ed8">{t.eventAccessSave}</Hov>
      )}
    </div>
  );
}
