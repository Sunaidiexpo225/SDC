"use client";

import { useEffect, useState } from "react";
import { s } from "@/lib/style";
import { api } from "@/lib/client";

interface OrgsResp {
  person: { urn: string; name: string } | null;
  orgs: Array<{ urn: string; name: string }>;
  current: string | null;
}

// "Post as" picker for a connected LinkedIn account — lets the operator choose
// whether an event publishes to the member's own feed or to one of the Company
// Pages they administer. Only renders when at least one Page is available
// (i.e. the Community Management API is granted + org posting is enabled), so
// it stays invisible for plain member-only connections.
export default function LinkedInTarget({
  accountId,
  onSaved,
  savingLabel,
  postAsLabel,
  personLabel,
}: {
  accountId: string;
  onSaved: () => void;
  savingLabel: string;
  postAsLabel: string;
  personLabel: string;
}) {
  const [data, setData] = useState<OrgsResp | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OrgsResp>(`/api/linkedin/orgs?accountId=${accountId}`)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData({ person: null, orgs: [], current: null }));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!data || data.orgs.length === 0) return null;

  const options: Array<{ urn: string; name: string }> = [
    ...(data.person ? [{ urn: data.person.urn, name: `${personLabel} (${data.person.name})` }] : []),
    ...data.orgs,
  ];

  const onChange = async (urn: string) => {
    const chosen = options.find((o) => o.urn === urn);
    setSaving(true);
    try {
      await api.post(`/api/linkedin/target`, { accountId, urn, name: chosen?.name });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s("display:flex;align-items:center;gap:8px;flex:1;min-width:180px")}>
      <span style={s("font-size:11px;font-weight:700;color:#8b93a1;flex:none")}>{postAsLabel}</span>
      <select
        value={data.current || ""}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        style={s("flex:1;min-width:120px;box-sizing:border-box;border:1px solid #e3e8ef;border-radius:8px;padding:8px 10px;font-size:12px;color:#0f172a;background:#fbfcfe;font-family:inherit")}
      >
        {options.map((o) => (
          <option key={o.urn} value={o.urn}>
            {o.name}
          </option>
        ))}
      </select>
      {saving && <span style={s("font-size:11px;color:#8b93a1;flex:none")}>{savingLabel}</span>}
    </div>
  );
}
