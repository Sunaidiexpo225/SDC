"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { addDays, isoDate } from "@/lib/format";
import { parseSmartTask, trailingMention, mentionCandidates, type SmartUser } from "@/lib/smartTask";
import type { TaskDTO, UserDTO } from "@/lib/types";

const MANAGER_ROLES = ["Admin", "Manager", "AsstManager"];

// Priority palette — a soft tint + a strong accent, used across the cards.
const PRIO: Record<string, { accent: string; tint: string; label: (t: Trans) => string }> = {
  low: { accent: "#8b93a1", tint: "#f2f4f7", label: (t) => t.prioLow },
  normal: { accent: "#2563eb", tint: "#eef3fe", label: (t) => t.prioNormal },
  high: { accent: "#e0457b", tint: "#fdeef4", label: (t) => t.prioHigh },
};

type Trans = ReturnType<typeof useLang>["t"];

const SNOOZE_KEY = "sdc_tasks_snooze";

// A short two-note "attention" chime, synthesised via Web Audio so there's no
// audio asset to ship. Best-effort — silently no-ops if audio is unavailable
// or blocked before the first user gesture.
function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [880, 1174.7].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.19;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.19);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* ignore */
  }
}

export default function Tasks() {
  const app = useApp();
  const { t, lang } = useLang();
  const { data, events, currentUser } = app;
  const locale = lang === "ar" ? "ar" : "en";

  const [view, setView] = useState<"list" | "report">("list");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // new-task form state — a single open box IS the task
  const [fTitle, setFTitle] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [fEvent, setFEvent] = useState("");
  const [fDue, setFDue] = useState("");
  const [fPrio, setFPrio] = useState<"" | "low" | "normal" | "high">("");

  const role = currentUser?.role ?? "Viewer";
  const isManager = MANAGER_ROLES.includes(role);
  const canCreate = role !== "Viewer";
  const meId = currentUser?.id;

  const userById = useMemo(() => {
    const m: Record<string, UserDTO> = {};
    data.users.forEach((u) => (m[u.id] = u));
    return m;
  }, [data.users]);
  const eventName = (id: string | null) => {
    if (!id) return null;
    const e = events.find((ev) => ev.id === id);
    return e ? (lang === "ar" ? e.nameAr : e.nameEn) : null;
  };
  const eventColor = (id: string | null) => events.find((ev) => ev.id === id)?.color ?? "#c8d0dc";

  // Assignable teammates — exclude Admins (they run the workspace, they're not
  // on the marketing task list). Display lookups still use the full user map.
  const assignable = data.users.filter((u) => u.role !== "Admin");
  // Smart quick-add: parse @mentions + date words out of the open box as you type.
  const smartUsers: SmartUser[] = assignable.map((u) => ({ id: u.id, name: u.name, init: u.init }));
  const parsed = useMemo(() => parseSmartTask(fTitle, smartUsers, app.today), [fTitle, smartUsers, app.today]);
  const mentionFrag = trailingMention(fTitle);
  const candidates = mentionFrag !== null ? mentionCandidates(mentionFrag, smartUsers) : [];
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const pickMention = (u: SmartUser) => {
    // Insert the person's name (first whitespace-free token) so the tag reads
    // as a name, not an initial — e.g. "@AlHussain" instead of "@A".
    const nameToken = u.name.split(/\s+/)[0];
    setFTitle((prev) => prev.replace(/@([^\s@]*)$/, `@${nameToken} `));
    setTimeout(() => boxRef.current?.focus(), 0);
  };

  // Detect an event by its name, a nickname, or its acronym typed anywhere in
  // the task text, so writing "Saudi Franchise Expo" / "SFE" / a nickname
  // auto-assigns the task to it.
  const detEvent = useMemo(() => {
    const txt = fTitle.toLowerCase();
    if (!txt.trim()) return null;
    const words = new Set(txt.split(/[^a-z0-9؀-ۿ]+/).filter(Boolean));
    return (
      events.find((e) => {
        const names = [e.nameEn, e.nameAr, ...e.aliases].filter(Boolean).map((x) => x.toLowerCase());
        if (names.some((n) => n && txt.includes(n))) return true;
        const acr = e.nameEn.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toLowerCase();
        return acr.length >= 2 && words.has(acr);
      }) || null
    );
  }, [fTitle, events]);

  const effAssignee = fAssignee || parsed.assigneeId || null;
  const effDue = fDue || parsed.dueDate || null;
  const effPrio = fPrio || parsed.priority || "normal";
  const effEvent = fEvent || detEvent?.id || "";
  const effTitle = parsed.cleanTitle || fTitle.trim();
  const detAssigneeName = parsed.assigneeName;
  const detDueLabel = parsed.dueLabel;
  const detDueDate = parsed.dueDate;
  const detPrio = !fPrio ? parsed.priority : null; // priority inferred from words

  const tasks = data.tasks;
  const filtered = tasks.filter((tk) => (filter === "mine" ? tk.assigneeId === meId : true));
  // Kanban columns. Legacy tasks are only open/completed; in_progress is new.
  const COLUMNS: { key: "open" | "in_progress" | "completed"; label: string; color: string }[] = [
    { key: "open", label: t.boardToDo, color: "#2563eb" },
    { key: "in_progress", label: t.boardDoing, color: "#f59e0b" },
    { key: "completed", label: t.boardDone, color: "#17a99b" },
  ];
  const colTasks = (k: string) => filtered.filter((tk) => (tk.status || "open") === k);
  const moveTask = (id: string, status: "open" | "in_progress" | "completed") => {
    const tk = tasks.find((x) => x.id === id);
    if (!tk || tk.status === status) return;
    if (!(isManager || tk.assigneeId === meId)) return;
    app.updateTask(id, { status });
  };

  // A task "needs attention" when it's not done and either past its due date or
  // flagged high priority and still untouched.
  const todayISO = isoDate(app.today);
  const isOverdue = (tk: TaskDTO) => tk.status !== "completed" && !!tk.dueDate && tk.dueDate < todayISO;
  const needsAttention = (tk: TaskDTO) =>
    tk.status !== "completed" && (isOverdue(tk) || (tk.priority === "high" && tk.status === "open"));
  const attentionCount = filtered.filter(needsAttention).length;
  const overdueCount = filtered.filter(isOverdue).length;

  // Snooze mutes the reminder + chime for an hour (persisted across reloads).
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  useEffect(() => {
    try { setSnoozeUntil(Number(localStorage.getItem(SNOOZE_KEY) || 0)); } catch { /* ignore */ }
  }, []);
  const snoozed = snoozeUntil > Date.now();
  const snooze = () => {
    const until = Date.now() + 60 * 60 * 1000;
    setSnoozeUntil(until);
    try { localStorage.setItem(SNOOZE_KEY, String(until)); } catch { /* ignore */ }
  };

  // Chime once when overdue work appears (and isn't snoozed). Reset when clear.
  const chimedRef = useRef(false);
  useEffect(() => {
    if (overdueCount > 0 && !snoozed && !chimedRef.current) {
      chimedRef.current = true;
      playChime();
    }
    if (overdueCount === 0) chimedRef.current = false;
  }, [overdueCount, snoozed]);

  const submit = async () => {
    if (!effTitle) return;
    const ok = await app.createTask({
      title: effTitle,
      assigneeId: effAssignee,
      eventId: effEvent || null,
      dueDate: effDue,
      priority: effPrio,
    });
    if (ok) {
      setFTitle(""); setFAssignee(""); setFEvent(""); setFDue(""); setFPrio("");
    }
  };

  const today0 = app.today;
  const quickDates: [string, string][] = [
    [t.quickToday, isoDate(today0)],
    [t.quickTomorrow, isoDate(addDays(today0, 1))],
    [t.quickWeek, isoDate(addDays(today0, 7))],
  ];
  const dueVal = fDue || parsed.dueDate || "";

  const fmtWhen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";

  // ---- Completion report: completed tasks + produced posts ----
  const reportRows = useMemo(() => {
    const fromTasks = tasks
      .filter((tk) => tk.status === "completed")
      .map((tk) => ({ kind: t.repKindTask, title: tk.title, assigneeId: tk.assigneeId, eventId: tk.eventId, byId: tk.completedById, at: tk.completedAt }));
    const fromPosts = data.posts
      .filter((p) => p.completed && p.completedAt)
      .map((p) => ({ kind: t.repKindPost, title: (lang === "ar" ? p.titleAr : p.titleEn) || p.captionEn.slice(0, 40), assigneeId: p.assigneeId, eventId: p.eventId, byId: p.completedById, at: p.completedAt }));
    return [...fromTasks, ...fromPosts].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }, [tasks, data.posts, t, lang]);

  const exportCsv = () => {
    const head = [t.repColKind, t.repColTask, t.repColAssignee, t.repColEvent, t.repColBy, t.repColWhen];
    const rows = reportRows.map((r) => [r.kind, r.title, (r.assigneeId && userById[r.assigneeId]?.name) || "", eventName(r.eventId) || "", (r.byId && userById[r.byId]?.name) || "", fmtWhen(r.at)]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "completion-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const Avatar = ({ u, size = 26, ring }: { u?: UserDTO; size?: number; ring?: boolean }) =>
    u ? (
      <span title={u.name} style={s(`width:${size}px;height:${size}px;border-radius:50%;background:${u.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:${Math.round(size * 0.42)}px;flex:none;box-shadow:${ring ? "0 0 0 2px #fff,0 0 0 4px " + u.avColor : "none"}`)}>{u.init}</span>
    ) : (
      <span style={s(`width:${size}px;height:${size}px;border-radius:50%;background:#e3e8ef;display:grid;place-items:center;color:#8b93a1;font-weight:700;font-size:${Math.round(size * 0.42)}px;flex:none`)}>?</span>
    );

  return (
    <div style={s("padding:24px 28px;max-width:1080px")}>
      {/* Hero banner */}
      <div style={s("position:relative;overflow:hidden;border-radius:22px;padding:24px 26px;margin-bottom:18px;background:linear-gradient(135deg,#2563eb 0%,#7c5cf0 55%,#e0457b 120%);color:#fff")}>
        <div style={s("position:absolute;inset-inline-end:-30px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.12)")} />
        <div style={s("position:absolute;inset-inline-end:60px;bottom:-50px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.10)")} />
        <div style={s("position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap")}>
          <div>
            <div style={s("font-family:var(--grotesk);font-weight:700;font-size:26px;letter-spacing:-.5px;display:flex;align-items:center;gap:10px")}><span>🗂️</span>{t.tasksH2}</div>
            <p style={s("font-size:13.5px;margin:6px 0 0;opacity:.92;max-width:520px;line-height:1.5")}>{t.tasksSub}</p>
          </div>
          <div style={s("display:flex;gap:6px;background:rgba(255,255,255,.16);padding:4px;border-radius:999px;backdrop-filter:blur(4px)")}>
            {([["list", t.tabTasksList], ["report", t.tabReport]] as const).map(([k, lb]) => (
              <button key={k} onClick={() => setView(k)} style={s(`border:none;cursor:pointer;background:${view === k ? "#fff" : "transparent"};color:${view === k ? "#2563eb" : "#fff"};font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit`)}>{lb}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" ? (
        <>
          {/* Create card */}
          {canCreate && (
            <div style={s("background:#fff;border:1px solid #e7ebf2;border-radius:20px;padding:18px 20px;margin-bottom:20px;box-shadow:0 10px 30px rgba(15,23,42,.05)")}>
              <div style={s("display:flex;align-items:center;gap:8px;margin-bottom:12px")}>
                <span style={s("width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#2563eb,#7c5cf0);display:grid;place-items:center;color:#fff;font-size:15px;flex:none")}>✦</span>
                <span style={s("font-family:var(--grotesk);font-weight:700;font-size:16px")}>{t.createCardTitle}</span>
              </div>

              <div style={s("position:relative;margin-bottom:8px")}>
                <textarea
                  ref={boxRef}
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (candidates.length && mentionFrag !== null) { e.preventDefault(); pickMention(candidates[0]); }
                      else if (effTitle) { e.preventDefault(); submit(); }
                    }
                  }}
                  placeholder={t.taskTitlePh}
                  rows={2}
                  style={s("box-sizing:border-box;width:100%;resize:none;min-height:62px;border:1.5px solid #e3e8ef;border-radius:14px;padding:14px 16px;font-family:inherit;font-size:16px;font-weight:600;line-height:1.4;color:#0f172a;background:#fbfcfe;outline:none")}
                />
                {mentionFrag !== null && candidates.length > 0 && (
                  <div style={s("position:absolute;top:calc(100% + 4px);inset-inline-start:0;z-index:30;min-width:230px;background:#fff;border:1px solid #e3e8ef;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.18);padding:6px")}>
                    {candidates.map((u) => (
                      <Hov key={u.id} tag="button" onClick={() => pickMention(u)} css="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:none;cursor:pointer;background:transparent;padding:8px;border-radius:10px;font-family:inherit;text-align:start" hover="background:#f4f6f9">
                        <Avatar u={userById[u.id]} />
                        <span style={s("flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{u.name}</span>
                        <span dir="ltr" style={s("font-size:11px;color:#8b93a1;font-family:ui-monospace,Menlo,monospace")}>@{u.init}</span>
                      </Hov>
                    ))}
                  </div>
                )}
              </div>

              {/* live detected chips */}
              {(detAssigneeName || detDueLabel || detPrio || (detEvent && !fEvent)) && (
                <div style={s("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px")}>
                  {detAssigneeName && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#eef2f8;color:#2563eb;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px")}>@ {detAssigneeName}</span>}
                  {detDueLabel && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#f0f9f6;color:#128d81;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px")}>📅 {detDueLabel}{detDueDate ? ` · ${detDueDate}` : ""}</span>}
                  {detPrio && <span style={s(`display:inline-flex;align-items:center;gap:5px;background:${PRIO[detPrio].tint};color:${PRIO[detPrio].accent};font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px`)}>⚡ {PRIO[detPrio].label(t)}</span>}
                  {detEvent && !fEvent && <span style={s(`display:inline-flex;align-items:center;gap:5px;background:#f4f6f9;color:#5c6675;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px`)}><span style={s(`width:7px;height:7px;border-radius:50%;background:${detEvent.color}`)} />{lang === "ar" ? detEvent.nameAr : detEvent.nameEn}</span>}
                </div>
              )}

              {/* Assign-to name chips (avatar + first name) */}
              <div style={s("display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px")}>
                <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;flex:none;padding-top:7px")}>{t.assignToLabel}</span>
                <div style={s("display:flex;gap:7px;flex-wrap:wrap")}>
                  {assignable.map((u) => {
                    const on = effAssignee === u.id;
                    const first = u.name.split(/\s+/)[0];
                    return (
                      <button key={u.id} onClick={() => setFAssignee(on ? "" : u.id)} title={u.name} style={s(`display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-family:inherit;font-weight:700;font-size:12.5px;padding:5px 12px 5px 5px;border-radius:999px;border:1.5px solid ${on ? u.avColor : "#e6eaf0"};background:${on ? u.avColor : "#fff"};color:${on ? "#fff" : "#3d4757"}`)}>
                        <span style={s(`width:24px;height:24px;border-radius:50%;background:${on ? "rgba(255,255,255,.25)" : u.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:10px;flex:none`)}>{u.init}</span>
                        {first}
                        {on && <span style={s("font-size:11px;padding-inline-end:2px")}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due quick chips + custom date */}
              <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px")}>
                <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;flex:none")}>{t.taskDue}</span>
                {quickDates.map(([lb, iso]) => {
                  const on = dueVal === iso;
                  return (
                    <button key={lb} onClick={() => setFDue(on ? "" : iso)} style={s(`border:1px solid ${on ? "#128d81" : "#e3e8ef"};cursor:pointer;background:${on ? "#e7f6f3" : "#fff"};color:${on ? "#128d81" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 13px;border-radius:999px;font-family:inherit`)}>{lb}</button>
                  );
                })}
                <label style={s(`display:inline-flex;align-items:center;gap:6px;border:1px solid ${dueVal && !quickDates.some(([, iso]) => iso === dueVal) ? "#128d81" : "#e3e8ef"};background:${dueVal && !quickDates.some(([, iso]) => iso === dueVal) ? "#e7f6f3" : "#fbfcfe"};border-radius:999px;padding:6px 12px;cursor:pointer`)}>
                  <span style={s("font-size:12px")}>📅</span>
                  <input type="date" value={dueVal} onChange={(e) => setFDue(e.target.value)} style={s("border:none;background:transparent;font-family:inherit;font-size:12px;color:#0f172a;outline:none;padding:0;min-width:16px")} />
                </label>
              </div>

              {/* Priority + event pills */}
              <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px")}>
                <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;flex:none")}>{t.taskPriority}</span>
                {(["low", "normal", "high"] as const).map((p) => {
                  const on = effPrio === p;
                  return (
                    <button key={p} onClick={() => setFPrio(p)} style={s(`display:inline-flex;align-items:center;gap:6px;border:1px solid ${on ? PRIO[p].accent : "#e3e8ef"};cursor:pointer;background:${on ? PRIO[p].tint : "#fff"};color:${on ? PRIO[p].accent : "#8b93a1"};font-weight:700;font-size:12px;padding:7px 13px;border-radius:999px;font-family:inherit`)}><span style={s(`width:8px;height:8px;border-radius:50%;background:${PRIO[p].accent}`)} />{PRIO[p].label(t)}</button>
                  );
                })}
                {events.length > 0 && (
                  <select value={effEvent} onChange={(e) => setFEvent(e.target.value)} style={s("margin-inline-start:auto;border:1px solid #e3e8ef;border-radius:999px;padding:7px 12px;font-family:inherit;font-size:12px;color:#0f172a;background:#fbfcfe")}>
                    <option value="">{t.taskNoEvent}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.nameAr : e.nameEn}</option>)}
                  </select>
                )}
              </div>

              <div style={s("display:flex;align-items:center;gap:10px")}>
                <span style={s("font-size:11px;color:#a3abb8;flex:1;min-width:0")}>{t.taskSmartHint}</span>
                <Hov tag="button" onClick={submit} css={`border:none;cursor:pointer;background:linear-gradient(135deg,#2563eb,#7c5cf0);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:999px;font-family:inherit;flex:none;opacity:${effTitle ? 1 : 0.5};box-shadow:0 8px 20px rgba(37,99,235,.28)`} hover={effTitle ? "filter:brightness(1.08)" : ""}>{t.taskCreate}</Hov>
              </div>
            </div>
          )}

          {/* Filters + kanban hint */}
          <div style={s("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px")}>
            <div style={s("display:flex;gap:6px")}>
              {([["all", t.fltAll], ["mine", t.fltMine]] as const).map(([k, lb]) => (
                <button key={k} onClick={() => setFilter(k)} style={s(`border:1px solid ${filter === k ? "#2563eb" : "#e3e8ef"};cursor:pointer;background:${filter === k ? "#eef2f8" : "#fff"};color:${filter === k ? "#2563eb" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 15px;border-radius:999px;font-family:inherit`)}>{lb}</button>
              ))}
            </div>
            <span style={s("font-size:11px;color:#a3abb8")}>{t.kanbanHint}</span>
          </div>

          {/* Needs-attention reminder (with chime + snooze) */}
          {attentionCount > 0 && !snoozed && (
            <div style={s("display:flex;align-items:center;gap:10px;background:#fff4f2;border:1px solid #f6cdc4;border-radius:14px;padding:11px 14px 11px 16px;margin-bottom:14px")}>
              <span style={s("font-size:18px;flex:none")}>🔔</span>
              <span style={s("font-size:13px;font-weight:700;color:#c0432b;flex:1;min-width:0")}>{t.attentionBanner(attentionCount)}</span>
              <Hov tag="button" onClick={snooze} css="border:1px solid #f0b3a6;cursor:pointer;background:#fff;color:#c0432b;font-weight:700;font-size:12px;padding:7px 14px;border-radius:999px;font-family:inherit;flex:none;display:inline-flex;align-items:center;gap:5px" hover="background:#fdeee9">😴 {t.snoozeBtn}</Hov>
            </div>
          )}
          {attentionCount > 0 && snoozed && (
            <div style={s("display:flex;align-items:center;gap:8px;margin-bottom:14px")}>
              <span style={s("font-size:12px;color:#a3abb8;font-weight:600")}>😴 {t.snoozedNote}</span>
              <button onClick={() => { setSnoozeUntil(0); try { localStorage.removeItem(SNOOZE_KEY); } catch { /* ignore */ } }} style={s("border:none;background:transparent;cursor:pointer;color:#2563eb;font-weight:700;font-size:12px;font-family:inherit")}>↺</button>
            </div>
          )}

          {/* Kanban board */}
          <div style={s("display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;align-items:flex-start")}>
            {COLUMNS.map((col) => {
              const items = colTasks(col.key);
              const over = overCol === col.key;
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); }}
                  onDragLeave={() => setOverCol((o) => (o === col.key ? null : o))}
                  onDrop={(e) => { e.preventDefault(); if (dragId) moveTask(dragId, col.key); setDragId(null); setOverCol(null); }}
                  style={s(`flex:1;min-width:270px;max-width:360px;background:${over ? "#eef4ff" : "#f4f6f9"};border:1.5px ${over ? "dashed #2563eb" : "solid #eaeef3"};border-radius:18px;padding:12px 12px 16px;transition:background .12s`)}
                >
                  <div style={s("display:flex;align-items:center;gap:8px;margin:2px 4px 12px")}>
                    <span style={s(`width:9px;height:9px;border-radius:50%;background:${col.color}`)} />
                    <span style={s("font-family:var(--grotesk);font-weight:700;font-size:14px")}>{col.label}</span>
                    <span style={s("background:#fff;color:#5c6675;font-size:11px;font-weight:700;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;border:1px solid #e7ebf2")}>{items.length}</span>
                  </div>
                  <div style={s("display:flex;flex-direction:column;gap:10px;min-height:60px")}>
                    {items.map((tk) => <TaskCard key={tk.id} tk={tk} />)}
                    {items.length === 0 && (
                      <div style={s("border:1.5px dashed #dbe1ea;border-radius:12px;padding:20px;text-align:center;color:#b3bac6;font-size:12px;font-weight:600")}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div>
          <div style={s("display:flex;justify-content:flex-end;margin-bottom:12px")}>
            <Hov tag="button" onClick={exportCsv} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:9px 16px;border-radius:999px;font-family:inherit;font-weight:700;font-size:13px;color:#0f172a" hover="border-color:#c8d0dc">⬇ {t.repExport}</Hov>
          </div>
          <div style={s("background:#fff;border:1px solid #e7ebf2;border-radius:18px;padding:6px 18px 14px;overflow-x:auto;box-shadow:0 10px 30px rgba(15,23,42,.05)")}>
            {reportRows.length === 0 ? (
              <div style={s("color:#8b93a1;font-size:14px;font-weight:600;padding:36px 4px;text-align:center")}>{t.repEmpty}</div>
            ) : (
              <table style={s("width:100%;border-collapse:collapse;min-width:640px")}>
                <thead>
                  <tr>
                    {[t.repColKind, t.repColTask, t.repColAssignee, t.repColEvent, t.repColBy, t.repColWhen].map((h) => (
                      <th key={h} style={s("text-align:start;font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;padding:12px 8px;border-bottom:1px solid #eef1f5")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r, i) => (
                    <tr key={i}>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9")}><span style={s(`font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:${r.kind === t.repKindPost ? "#eef2f8" : "#f0f9f6"};color:${r.kind === t.repKindPost ? "#2563eb" : "#128d81"}`)}>{r.kind}</span></td>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9;font-size:13px;font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{r.title}</td>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9;font-size:13px;color:#5c6675")}>{(r.assigneeId && userById[r.assigneeId]?.name) || "—"}</td>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9;font-size:13px;color:#5c6675")}>{eventName(r.eventId) || "—"}</td>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9;font-size:13px;color:#5c6675")}>{(r.byId && userById[r.byId]?.name) || "—"}</td>
                      <td style={s("padding:11px 8px;border-bottom:1px solid #f4f6f9;font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap")}>{fmtWhen(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function TaskCard({ tk }: { tk: TaskDTO }) {
    const status = (tk.status || "open") as "open" | "in_progress" | "completed";
    const done = status === "completed";
    const assignee = tk.assigneeId ? userById[tk.assigneeId] : undefined;
    const canToggle = isManager || tk.assigneeId === meId;
    const canDelete = isManager || tk.createdById === meId;
    const evName = eventName(tk.eventId);
    const pr = PRIO[tk.priority] ?? PRIO.normal;
    const dragging = dragId === tk.id;
    const overdue = isOverdue(tk);
    // Card tint reflects priority so urgent work stands out at a glance.
    const cardBg = done ? "#fff" : tk.priority === "high" ? "#fff5f8" : tk.priority === "low" ? "#fbfcfd" : "#fff";
    const cardBorder = done ? "#e7ebf2" : overdue ? "#f0a898" : tk.priority === "high" ? "#f4c9d8" : "#e7ebf2";
    return (
      <div
        draggable={canToggle}
        onDragStart={() => setDragId(tk.id)}
        onDragEnd={() => { setDragId(null); setOverCol(null); }}
        style={s(`position:relative;background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;padding:14px 14px 12px;box-shadow:0 4px 14px rgba(15,23,42,.05);overflow:hidden;${canToggle ? "cursor:grab;" : ""}${done ? "opacity:.72;" : ""}${dragging ? "opacity:.4;" : ""}`)}
      >
        <span style={s(`position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:${done ? "#17a99b" : status === "in_progress" ? "#f59e0b" : pr.accent}`)} />
        <div style={s("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;padding-inline-start:6px")}>
          <div style={s("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
            <span style={s(`display:inline-flex;align-items:center;gap:5px;background:${pr.tint};color:${pr.accent};font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em`)}><span style={s(`width:6px;height:6px;border-radius:50%;background:${pr.accent}`)} />{pr.label(t)}</span>
            {overdue && <span style={s("display:inline-flex;align-items:center;gap:4px;background:#fde7e2;color:#c0432b;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em")}>⚠ {t.overdueTag}</span>}
          </div>
          {canDelete && (
            <Hov tag="button" onClick={() => { if (confirm(t.taskDeleteConfirm)) app.deleteTask(tk.id); }} title={t.taskDelete} css="border:none;cursor:pointer;background:transparent;color:#c0c7d2;font-weight:700;font-size:14px;width:24px;height:24px;border-radius:50%;font-family:inherit;flex:none" hover="background:#fdf2f2;color:#d64545">✕</Hov>
          )}
        </div>
        <div style={s(`font-size:14px;font-weight:700;color:#0f172a;line-height:1.35;padding-inline-start:6px;${done ? "text-decoration:line-through" : ""}`)}>{tk.title}</div>
        {tk.notes && <div style={s("font-size:12px;color:#8b93a1;margin-top:5px;padding-inline-start:6px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{tk.notes}</div>}
        <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:11px 0;padding-inline-start:6px")}>
          {evName && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#f4f6f9;font-size:11px;font-weight:600;color:#5c6675;padding:4px 9px;border-radius:999px")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${eventColor(tk.eventId)}`)} />{evName}</span>}
          {tk.dueDate && <span style={s("display:inline-flex;align-items:center;gap:4px;background:#f4f6f9;font-size:11px;font-weight:600;color:#5c6675;padding:4px 9px;border-radius:999px")}>📅 {tk.dueDate}</span>}
        </div>
        <div style={s("display:flex;align-items:center;gap:10px;padding-inline-start:6px;border-top:1px solid #f2f4f7;padding-top:10px")}>
          <Avatar u={assignee} />
          <span style={s("flex:1;min-width:0;font-size:12px;font-weight:600;color:#5c6675;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{assignee?.name || t.taskUnassigned}</span>
          {canToggle && (
            <div style={s("display:flex;align-items:center;gap:4px;flex:none")}>
              {COLUMNS.map((c) => {
                const active = status === c.key;
                return (
                  <button key={c.key} title={c.label} onClick={() => moveTask(tk.id, c.key)} style={s(`height:14px;width:${active ? 22 : 14}px;border-radius:999px;border:none;cursor:pointer;background:${active ? c.color : "#dfe4ea"};padding:0;transition:width .12s`)} />
                );
              })}
            </div>
          )}
        </div>
        {done && tk.completedAt && (
          <div style={s("font-size:10.5px;color:#128d81;font-weight:600;margin-top:8px;padding-inline-start:6px")}>{t.taskStatusDone} · {fmtWhen(tk.completedAt)}</div>
        )}
      </div>
    );
  }
}
