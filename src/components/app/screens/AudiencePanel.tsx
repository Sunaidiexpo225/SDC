"use client";

import { useLang } from "../../LangProvider";
import { s } from "@/lib/style";
import { fmt } from "@/lib/format";

interface Demo {
  label: string;
  value: number;
}
interface Audience {
  countries: Demo[];
  cities: Demo[];
  gender: Demo[];
  ages: Demo[];
  onlineByHour: number[] | null;
}

function DemoList({ title, items, color }: { title: string; items: Demo[]; color: string }) {
  if (!items || items.length === 0) return null;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={s("flex:1;min-width:180px")}>
      <div style={s("font-size:12px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px")}>{title}</div>
      <div style={s("display:flex;flex-direction:column;gap:11px")}>
        {items.map((i) => (
          <div key={i.label}>
            <div style={s("display:flex;justify-content:space-between;gap:8px;margin-bottom:5px")}>
              <span style={s("font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{i.label}</span>
              <span style={s("font-size:12px;font-weight:700;color:#5c6675;flex:none")}>{fmt(i.value)}</span>
            </div>
            <div style={s("height:7px;border-radius:4px;background:#f0f3f7")}>
              <div style={s(`height:7px;border-radius:4px;background:${color};width:${Math.round((i.value / max) * 100)}%`)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AudiencePanel({ audience }: { audience: Audience }) {
  const { t } = useLang();
  return (
    <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:22px;margin-top:16px")}>
      <div style={s("font-size:13px;font-weight:700;margin-bottom:18px")}>{t.secAudience}</div>
      <div style={s("display:flex;gap:28px;flex-wrap:wrap")}>
        <DemoList title={t.audCountries} items={audience.countries} color="#2563eb" />
        <DemoList title={t.audCities} items={audience.cities} color="#17a99b" />
        <DemoList title={t.audAge} items={audience.ages} color="#7c5cf0" />
        <DemoList title={t.audGender} items={audience.gender} color="#e0457b" />
      </div>
    </div>
  );
}
