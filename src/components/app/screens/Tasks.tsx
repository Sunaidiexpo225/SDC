"use client";

import { useMemo, useRef, useState } from "react";
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

export default function Tasks() {
  const app = useApp();
  const { t, lang } = useLang();
  const { data, events, currentUser } = app;
  const locale = lang === "ar" ? "ar" : "en";

  const [view, setView] = useState<"list" | "report">("list");
  const [filter, setFilter] = useState<"all" | "open" | "done" | "mine">("all");

  // new-task form state
  const [fTitle, setFTitle] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [fEvent, setFEvent] = useState("");
  const [fDue, setFDue] = useState("");
  const [fPrio, setFPrio] = useState<"low" | "normal" | "high">("normal");
  const [notesOpen, setNotesOpen] = useState(false);

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

  // Smart quick-add: parse @mentions + date words out of the title as you type.
  const smartUsers: SmartUser[] = data.users.map((u) => ({ id: u.id, name: u.name, init: u.init }));
  const parsed = useMemo(() => parseSmartTask(fTitle, smartUsers, app.today), [fTitle, smartUsers, app.today]);
  const mentionFrag = trailingMention(fTitle);
  const candidates = mentionFrag !== null ? mentionCandidates(mentionFrag, smartUsers) : [];
  const titleRef = useRef<HTMLInputElement>(null);
  const pickMention = (u: SmartUser) => {
    setFTitle((prev) => prev.replace(/@([^\s@]*)$/, `@${u.init} `));
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const effAssignee = fAssignee || parsed.assigneeId || null;
  const effDue = fDue || parsed.dueDate || null;
  const effTitle = parsed.cleanTitle || fTitle.trim();

  const tasks = data.tasks;
  const filtered = tasks.filter((tk) => {
    if (filter === "open") return tk.status === "open";
    if (filter === "done") return tk.status === "completed";
    if (filter === "mine") return tk.assigneeId === meId;
    return true;
  });
  const openTasks = filtered.filter((tk) => tk.status === "open");
  const doneTasks = filtered.filter((tk) => tk.status === "completed");

  const submit = async () => {
    if (!effTitle) return;
    const ok = await app.createTask({
      title: effTitle,
      notes: fNotes.trim() || undefined,
      assigneeId: effAssignee,
      eventId: fEvent || null,
      dueDate: effDue,
      priority: fPrio,
    });
    if (ok) {
      setFTitle(""); setFNotes(""); setFAssignee(""); setFEvent(""); setFDue(""); setFPrio("normal");
      setNotesOpen(false);
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
                <input
                  ref={titleRef}
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (candidates.length && mentionFrag !== null) { e.preventDefault(); pickMention(candidates[0]); }
                      else if (effTitle) { e.preventDefault(); submit(); }
                    }
                  }}
                  placeholder={t.taskTitlePh}
                  style={s("box-sizing:border-box;width:100%;border:1.5px solid #e3e8ef;border-radius:14px;padding:14px 16px;font-family:inherit;font-size:16px;font-weight:600;color:#0f172a;background:#fbfcfe;outline:none")}
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
              {(parsed.assigneeName || parsed.dueLabel) && (
                <div style={s("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px")}>
                  {parsed.assigneeName && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#eef2f8;color:#2563eb;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px")}>@ {parsed.assigneeName}</span>}
                  {parsed.dueLabel && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#f0f9f6;color:#128d81;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px")}>📅 {parsed.dueLabel}{parsed.dueDate ? ` · ${parsed.dueDate}` : ""}</span>}
                </div>
              )}

              {/* Assign-to avatar chips */}
              <div style={s("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px")}>
                <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;flex:none")}>{t.assignToLabel}</span>
                <div style={s("display:flex;gap:6px;flex-wrap:wrap")}>
                  {data.users.map((u) => {
                    const on = (fAssignee || parsed.assigneeId) === u.id;
                    return (
                      <button key={u.id} onClick={() => setFAssignee(on ? "" : u.id)} title={u.name} style={s(`border:none;cursor:pointer;background:transparent;padding:0;border-radius:50%;font-family:inherit;flex:none;opacity:${on ? 1 : 0.55};transition:opacity .15s`)}>
                        <Avatar u={u} size={30} ring={on} />
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
                <input type="date" value={dueVal} onChange={(e) => setFDue(e.target.value)} style={s("border:1px solid #e3e8ef;border-radius:999px;padding:6px 12px;font-family:inherit;font-size:12px;color:#0f172a;background:#fbfcfe")} />
              </div>

              {/* Priority + event pills */}
              <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px")}>
                <span style={s("font-size:11px;font-weight:700;color:#8b93a1;text-transform:uppercase;letter-spacing:.05em;flex:none")}>{t.taskPriority}</span>
                {(["low", "normal", "high"] as const).map((p) => {
                  const on = fPrio === p;
                  return (
                    <button key={p} onClick={() => setFPrio(p)} style={s(`display:inline-flex;align-items:center;gap:6px;border:1px solid ${on ? PRIO[p].accent : "#e3e8ef"};cursor:pointer;background:${on ? PRIO[p].tint : "#fff"};color:${on ? PRIO[p].accent : "#8b93a1"};font-weight:700;font-size:12px;padding:7px 13px;border-radius:999px;font-family:inherit`)}><span style={s(`width:8px;height:8px;border-radius:50%;background:${PRIO[p].accent}`)} />{PRIO[p].label(t)}</button>
                  );
                })}
                {events.length > 0 && (
                  <select value={fEvent} onChange={(e) => setFEvent(e.target.value)} style={s("margin-inline-start:auto;border:1px solid #e3e8ef;border-radius:999px;padding:7px 12px;font-family:inherit;font-size:12px;color:#0f172a;background:#fbfcfe")}>
                    <option value="">{t.taskNoEvent}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.nameAr : e.nameEn}</option>)}
                  </select>
                )}
              </div>

              {notesOpen ? (
                <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder={t.taskNotesPh} autoFocus style={s("box-sizing:border-box;width:100%;height:60px;resize:none;border:1px solid #e3e8ef;border-radius:12px;padding:10px 13px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe;margin-bottom:12px")} />
              ) : null}

              <div style={s("display:flex;align-items:center;gap:10px")}>
                {!notesOpen && (
                  <button onClick={() => setNotesOpen(true)} style={s("border:1px dashed #c8d0dc;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:12px;padding:8px 14px;border-radius:999px;font-family:inherit")}>+ {t.taskAddDetails}</button>
                )}
                <span style={s("font-size:11px;color:#a3abb8;flex:1;min-width:0")}>{t.taskSmartHint}</span>
                <Hov tag="button" onClick={submit} css={`border:none;cursor:pointer;background:linear-gradient(135deg,#2563eb,#7c5cf0);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:999px;font-family:inherit;flex:none;opacity:${effTitle ? 1 : 0.5};box-shadow:0 8px 20px rgba(37,99,235,.28)`} hover={effTitle ? "filter:brightness(1.08)" : ""}>{t.taskCreate}</Hov>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={s("display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px")}>
            {([["all", t.fltAll], ["open", t.fltOpen], ["done", t.fltDone], ["mine", t.fltMine]] as const).map(([k, lb]) => (
              <button key={k} onClick={() => setFilter(k)} style={s(`border:1px solid ${filter === k ? "#2563eb" : "#e3e8ef"};cursor:pointer;background:${filter === k ? "#eef2f8" : "#fff"};color:${filter === k ? "#2563eb" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 15px;border-radius:999px;font-family:inherit`)}>{lb}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={s("background:#fff;border:1.5px dashed #dbe1ea;border-radius:20px;padding:52px 20px;text-align:center")}>
              <div style={s("font-size:34px;margin-bottom:8px")}>🎯</div>
              <div style={s("color:#8b93a1;font-size:14px;font-weight:600")}>{t.tasksEmpty}</div>
            </div>
          ) : (
            <div style={s("display:flex;flex-direction:column;gap:20px")}>
              {openTasks.length > 0 && (
                <Section label={t.boardToDo} count={openTasks.length} color="#2563eb">
                  {openTasks.map((tk) => <TaskCard key={tk.id} tk={tk} />)}
                </Section>
              )}
              {doneTasks.length > 0 && (
                <Section label={t.boardDone} count={doneTasks.length} color="#17a99b">
                  {doneTasks.map((tk) => <TaskCard key={tk.id} tk={tk} />)}
                </Section>
              )}
            </div>
          )}
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

  function Section({ label, count, color, children }: { label: string; count: number; color: string; children: React.ReactNode }) {
    return (
      <div>
        <div style={s("display:flex;align-items:center;gap:8px;margin-bottom:12px")}>
          <span style={s(`width:9px;height:9px;border-radius:50%;background:${color}`)} />
          <span style={s("font-family:var(--grotesk);font-weight:700;font-size:15px")}>{label}</span>
          <span style={s("background:#eef1f5;color:#5c6675;font-size:11px;font-weight:700;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center")}>{count}</span>
        </div>
        <div style={s("display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px")}>{children}</div>
      </div>
    );
  }

  function TaskCard({ tk }: { tk: TaskDTO }) {
    const done = tk.status === "completed";
    const assignee = tk.assigneeId ? userById[tk.assigneeId] : undefined;
    const canToggle = isManager || tk.assigneeId === meId;
    const canDelete = isManager || tk.createdById === meId;
    const evName = eventName(tk.eventId);
    const pr = PRIO[tk.priority] ?? PRIO.normal;
    return (
      <div style={s(`position:relative;background:#fff;border:1px solid #e7ebf2;border-radius:16px;padding:16px 16px 14px;box-shadow:0 6px 18px rgba(15,23,42,.05);overflow:hidden;${done ? "opacity:.72" : ""}`)}>
        <span style={s(`position:absolute;inset-inline-start:0;top:0;bottom:0;width:5px;background:${done ? "#17a99b" : pr.accent}`)} />
        <div style={s("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;padding-inline-start:6px")}>
          <span style={s(`display:inline-flex;align-items:center;gap:5px;background:${pr.tint};color:${pr.accent};font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em`)}><span style={s(`width:6px;height:6px;border-radius:50%;background:${pr.accent}`)} />{pr.label(t)}</span>
          {canDelete && (
            <Hov tag="button" onClick={() => { if (confirm(t.taskDeleteConfirm)) app.deleteTask(tk.id); }} title={t.taskDelete} css="border:none;cursor:pointer;background:transparent;color:#c0c7d2;font-weight:700;font-size:14px;width:24px;height:24px;border-radius:50%;font-family:inherit;flex:none" hover="background:#fdf2f2;color:#d64545">✕</Hov>
          )}
        </div>
        <div style={s(`font-size:14.5px;font-weight:700;color:#0f172a;line-height:1.35;padding-inline-start:6px;${done ? "text-decoration:line-through" : ""}`)}>{tk.title}</div>
        {tk.notes && <div style={s("font-size:12px;color:#8b93a1;margin-top:5px;padding-inline-start:6px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden")}>{tk.notes}</div>}
        <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0 12px;padding-inline-start:6px")}>
          {evName && <span style={s("display:inline-flex;align-items:center;gap:5px;background:#f4f6f9;font-size:11px;font-weight:600;color:#5c6675;padding:4px 9px;border-radius:999px")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${eventColor(tk.eventId)}`)} />{evName}</span>}
          {tk.dueDate && <span style={s("display:inline-flex;align-items:center;gap:4px;background:#f4f6f9;font-size:11px;font-weight:600;color:#5c6675;padding:4px 9px;border-radius:999px")}>📅 {tk.dueDate}</span>}
        </div>
        <div style={s("display:flex;align-items:center;gap:10px;padding-inline-start:6px;border-top:1px solid #f2f4f7;padding-top:11px")}>
          <Avatar u={assignee} />
          <span style={s("flex:1;min-width:0;font-size:12px;font-weight:600;color:#5c6675;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{assignee?.name || t.taskUnassigned}</span>
          {canToggle && (
            <Hov tag="button" onClick={() => app.updateTask(tk.id, { status: done ? "open" : "completed" })} css={`border:1px solid ${done ? "#e3e8ef" : "#b7e3d8"};cursor:pointer;background:${done ? "#fff" : "#e7f6f3"};color:${done ? "#5c6675" : "#128d81"};font-weight:700;font-size:12px;padding:7px 13px;border-radius:999px;font-family:inherit;flex:none;white-space:nowrap`} hover={done ? "border-color:#c8d0dc" : "background:#d9efe9"}>{done ? t.taskReopen : `✓ ${t.taskMarkDone}`}</Hov>
          )}
        </div>
        {done && tk.completedAt && (
          <div style={s("font-size:10.5px;color:#128d81;font-weight:600;margin-top:8px;padding-inline-start:6px")}>{t.taskStatusDone} · {fmtWhen(tk.completedAt)}</div>
        )}
      </div>
    );
  }
}
