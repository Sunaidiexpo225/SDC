"use client";

import { useMemo, useRef, useState } from "react";
import { useApp } from "../AppProvider";
import { useLang } from "../../LangProvider";
import { Hov } from "../../ui";
import { s } from "@/lib/style";
import { parseSmartTask, trailingMention, mentionCandidates, type SmartUser } from "@/lib/smartTask";
import type { TaskDTO, UserDTO } from "@/lib/types";

const MANAGER_ROLES = ["Admin", "Manager", "AsstManager"];

const PRIO_COLOR: Record<string, string> = { low: "#8b93a1", normal: "#2563eb", high: "#e0457b" };

export default function Tasks() {
  const app = useApp();
  const { t, lang } = useLang();
  const { data, events, currentUser } = app;
  const locale = lang === "ar" ? "ar" : "en";

  const [view, setView] = useState<"list" | "report">("list");
  const [filter, setFilter] = useState<"all" | "open" | "done" | "mine">("all");
  const [showForm, setShowForm] = useState(false);

  // new-task form state
  const [fTitle, setFTitle] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [fEvent, setFEvent] = useState("");
  const [fDue, setFDue] = useState("");
  const [fPrio, setFPrio] = useState<"low" | "normal" | "high">("normal");

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
  // Effective values: an explicit dropdown choice wins over the parsed one.
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
      setShowForm(false);
    }
  };

  const Avatar = ({ u, size = 26 }: { u?: UserDTO; size?: number }) =>
    u ? (
      <span title={u.name} style={s(`width:${size}px;height:${size}px;border-radius:50%;background:${u.avColor};display:grid;place-items:center;color:#fff;font-weight:700;font-size:${Math.round(size * 0.42)}px;flex:none`)}>{u.init}</span>
    ) : (
      <span style={s(`width:${size}px;height:${size}px;border-radius:50%;background:#e3e8ef;display:grid;place-items:center;color:#8b93a1;font-weight:700;font-size:${Math.round(size * 0.42)}px;flex:none`)}>?</span>
    );

  const seg = (active: boolean) =>
    `border:1px solid ${active ? "#0f172a" : "#e3e8ef"};cursor:pointer;background:${active ? "#0f172a" : "#fff"};color:${active ? "#fff" : "#5c6675"};font-weight:700;font-size:13px;padding:8px 16px;border-radius:999px;font-family:inherit`;

  // ---- Completion report: completed tasks + produced posts ----
  const reportRows = useMemo(() => {
    const fromTasks = tasks
      .filter((tk) => tk.status === "completed")
      .map((tk) => ({
        kind: t.repKindTask,
        title: tk.title,
        assigneeId: tk.assigneeId,
        eventId: tk.eventId,
        byId: tk.completedById,
        at: tk.completedAt,
      }));
    const fromPosts = data.posts
      .filter((p) => p.completed && p.completedAt)
      .map((p) => ({
        kind: t.repKindPost,
        title: (lang === "ar" ? p.titleAr : p.titleEn) || p.captionEn.slice(0, 40),
        assigneeId: p.assigneeId,
        eventId: p.eventId,
        byId: p.completedById,
        at: p.completedAt,
      }));
    return [...fromTasks, ...fromPosts].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }, [tasks, data.posts, t, lang]);

  const fmtWhen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";

  const exportCsv = () => {
    const head = [t.repColKind, t.repColTask, t.repColAssignee, t.repColEvent, t.repColBy, t.repColWhen];
    const rows = reportRows.map((r) => [
      r.kind,
      r.title,
      (r.assigneeId && userById[r.assigneeId]?.name) || "",
      eventName(r.eventId) || "",
      (r.byId && userById[r.byId]?.name) || "",
      fmtWhen(r.at),
    ]);
    const csv = [head, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "completion-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s("padding:28px 32px;max-width:1000px")}>
      <div style={s("display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px")}>
        <div>
          <h2 style={s("font-family:var(--grotesk);font-weight:700;font-size:28px;letter-spacing:-1px;margin:0 0 4px")}>{t.tasksH2}</h2>
          <p style={s("font-size:14px;color:#5c6675;margin:0")}>{t.tasksSub}</p>
        </div>
        <div style={s("display:flex;gap:8px")}>
          <button onClick={() => setView("list")} style={s(seg(view === "list"))}>{t.tabTasksList}</button>
          <button onClick={() => setView("report")} style={s(seg(view === "report"))}>{t.tabReport}</button>
        </div>
      </div>

      {view === "list" ? (
        <div style={s("margin-top:18px")}>
          <div style={s("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px")}>
            <div style={s("display:flex;gap:6px;flex-wrap:wrap")}>
              {([["all", t.fltAll], ["open", t.fltOpen], ["done", t.fltDone], ["mine", t.fltMine]] as const).map(([k, lb]) => (
                <button key={k} onClick={() => setFilter(k)} style={s(`border:1px solid ${filter === k ? "#2563eb" : "#e3e8ef"};cursor:pointer;background:${filter === k ? "#eef2f8" : "#fff"};color:${filter === k ? "#2563eb" : "#5c6675"};font-weight:700;font-size:12px;padding:7px 14px;border-radius:999px;font-family:inherit`)}>{lb}</button>
              ))}
            </div>
            {canCreate && (
              <Hov tag="button" onClick={() => setShowForm((v) => !v)} css="border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:9px 18px;border-radius:999px;font-family:inherit" hover="background:#1d4ed8">+ {t.taskNew}</Hov>
            )}
          </div>

          {showForm && canCreate && (
            <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:18px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px")}>
              <div style={s("position:relative")}>
                <input
                  ref={titleRef}
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && candidates.length && mentionFrag !== null) {
                      e.preventDefault();
                      pickMention(candidates[0]);
                    }
                  }}
                  placeholder={t.taskTitlePh}
                  style={s("box-sizing:border-box;width:100%;border:1px solid #e3e8ef;border-radius:10px;padding:11px 13px;font-family:inherit;font-size:15px;font-weight:600;color:#0f172a;background:#fbfcfe")}
                />
                {mentionFrag !== null && candidates.length > 0 && (
                  <div style={s("position:absolute;top:calc(100% + 4px);inset-inline-start:0;z-index:30;min-width:220px;background:#fff;border:1px solid #e3e8ef;border-radius:12px;box-shadow:0 14px 36px rgba(15,23,42,.16);padding:6px")}>
                    {candidates.map((u) => (
                      <Hov key={u.id} tag="button" onClick={() => pickMention(u)} css="width:100%;box-sizing:border-box;display:flex;align-items:center;gap:9px;border:none;cursor:pointer;background:transparent;padding:8px;border-radius:9px;font-family:inherit;text-align:start" hover="background:#f4f6f9">
                        <span style={s(`width:26px;height:26px;border-radius:50%;background:${data.users.find((x) => x.id === u.id)?.avColor || "#94a3b8"};display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex:none`)}>{u.init}</span>
                        <span style={s("flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{u.name}</span>
                        <span dir="ltr" style={s("font-size:11px;color:#8b93a1;font-family:ui-monospace,Menlo,monospace")}>@{u.init}</span>
                      </Hov>
                    ))}
                  </div>
                )}
              </div>
              <div style={s("display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-4px")}>
                <span style={s("font-size:11px;color:#a3abb8")}>{t.taskSmartHint}</span>
                {parsed.assigneeName && (
                  <span style={s("display:inline-flex;align-items:center;gap:5px;background:#eef2f8;color:#2563eb;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px")}>@ {parsed.assigneeName}</span>
                )}
                {parsed.dueLabel && (
                  <span style={s("display:inline-flex;align-items:center;gap:5px;background:#f0f9f6;color:#128d81;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px")}>📅 {parsed.dueLabel}{parsed.dueDate ? ` · ${parsed.dueDate}` : ""}</span>
                )}
              </div>
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder={t.taskNotesPh} style={s("box-sizing:border-box;height:64px;resize:none;border:1px solid #e3e8ef;border-radius:10px;padding:10px 13px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe")} />
              <div style={s("display:flex;gap:10px;flex-wrap:wrap")}>
                <label style={s("flex:1;min-width:150px;font-size:11px;font-weight:700;color:#8b93a1")}>{t.taskAssignee}
                  <select value={fAssignee || parsed.assigneeId || ""} onChange={(e) => setFAssignee(e.target.value)} style={s("display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #e3e8ef;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe")}>
                    <option value="">{t.taskUnassigned}</option>
                    {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
                <label style={s("flex:1;min-width:150px;font-size:11px;font-weight:700;color:#8b93a1")}>{t.taskEvent}
                  <select value={fEvent} onChange={(e) => setFEvent(e.target.value)} style={s("display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #e3e8ef;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe")}>
                    <option value="">{t.taskNoEvent}</option>
                    {events.map((e) => <option key={e.id} value={e.id}>{lang === "ar" ? e.nameAr : e.nameEn}</option>)}
                  </select>
                </label>
                <label style={s("min-width:130px;font-size:11px;font-weight:700;color:#8b93a1")}>{t.taskDue}
                  <input type="date" value={fDue || parsed.dueDate || ""} onChange={(e) => setFDue(e.target.value)} style={s("display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #e3e8ef;border-radius:10px;padding:8px 11px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe")} />
                </label>
                <label style={s("min-width:120px;font-size:11px;font-weight:700;color:#8b93a1")}>{t.taskPriority}
                  <select value={fPrio} onChange={(e) => setFPrio(e.target.value as "low" | "normal" | "high")} style={s("display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #e3e8ef;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:13px;color:#0f172a;background:#fbfcfe")}>
                    <option value="low">{t.prioLow}</option>
                    <option value="normal">{t.prioNormal}</option>
                    <option value="high">{t.prioHigh}</option>
                  </select>
                </label>
              </div>
              <div style={s("display:flex;gap:8px;justify-content:flex-end")}>
                <Hov tag="button" onClick={() => setShowForm(false)} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#5c6675;font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;font-family:inherit" hover="border-color:#c8d0dc">{t.taskCancel}</Hov>
                <Hov tag="button" onClick={submit} css={`border:none;cursor:pointer;background:#2563eb;color:#fff;font-weight:700;font-size:13px;padding:9px 18px;border-radius:999px;font-family:inherit;opacity:${effTitle ? 1 : 0.5}`} hover={effTitle ? "background:#1d4ed8" : ""}>{t.taskCreate}</Hov>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:40px;text-align:center;color:#8b93a1;font-size:14px;font-weight:600")}>{t.tasksEmpty}</div>
          ) : (
            <div style={s("display:flex;flex-direction:column;gap:10px")}>
              {filtered.map((tk) => (
                <TaskRow key={tk.id} tk={tk} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={s("margin-top:18px")}>
          <div style={s("display:flex;justify-content:flex-end;margin-bottom:12px")}>
            <Hov tag="button" onClick={exportCsv} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;padding:9px 14px;border-radius:999px;font-family:inherit;font-weight:700;font-size:13px;color:#0f172a" hover="border-color:#c8d0dc">{t.repExport}</Hov>
          </div>
          <div style={s("background:#fff;border:1px solid #e3e8ef;border-radius:16px;padding:6px 18px 14px;overflow-x:auto")}>
            {reportRows.length === 0 ? (
              <div style={s("color:#8b93a1;font-size:14px;font-weight:600;padding:32px 4px;text-align:center")}>{t.repEmpty}</div>
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

  function TaskRow({ tk }: { tk: TaskDTO }) {
    const done = tk.status === "completed";
    const assignee = tk.assigneeId ? userById[tk.assigneeId] : undefined;
    const canToggle = isManager || tk.assigneeId === meId;
    const canDelete = isManager || tk.createdById === meId;
    const evName = eventName(tk.eventId);
    return (
      <div style={s(`background:#fff;border:1px solid #e3e8ef;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;opacity:${done ? 0.72 : 1}`)}>
        <span style={s(`width:6px;align-self:stretch;border-radius:999px;background:${PRIO_COLOR[tk.priority]};flex:none`)} />
        <div style={s("flex:1;min-width:0")}>
          <div style={s(`font-size:14px;font-weight:700;color:#0f172a;${done ? "text-decoration:line-through" : ""}`)}>{tk.title}</div>
          {tk.notes && <div style={s("font-size:12px;color:#8b93a1;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{tk.notes}</div>}
          <div style={s("display:flex;align-items:center;gap:12px;margin-top:6px;flex-wrap:wrap")}>
            {evName && <span style={s("display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#5c6675")}><span style={s(`width:7px;height:7px;border-radius:50%;background:${eventColor(tk.eventId)}`)} />{evName}</span>}
            {tk.dueDate && <span style={s("font-size:11px;color:#8b93a1")}>{t.taskDue}: {tk.dueDate}</span>}
            {done && tk.completedAt && <span style={s("font-size:11px;color:#128d81;font-weight:600")}>{t.taskStatusDone} · {fmtWhen(tk.completedAt)}</span>}
          </div>
        </div>
        <Avatar u={assignee} />
        {canToggle && (
          <Hov tag="button" onClick={() => app.updateTask(tk.id, { status: done ? "open" : "completed" })} css={`border:1px solid ${done ? "#e3e8ef" : "#b7e3d8"};cursor:pointer;background:${done ? "#fff" : "#e7f6f3"};color:${done ? "#5c6675" : "#128d81"};font-weight:700;font-size:12px;padding:8px 14px;border-radius:999px;font-family:inherit;flex:none`} hover={done ? "border-color:#c8d0dc" : "background:#d9efe9"}>{done ? t.taskReopen : t.taskMarkDone}</Hov>
        )}
        {canDelete && (
          <Hov tag="button" onClick={() => { if (confirm(t.taskDeleteConfirm)) app.deleteTask(tk.id); }} title={t.taskDelete} css="border:1px solid #e3e8ef;cursor:pointer;background:#fff;color:#a3abb8;font-weight:700;font-size:13px;width:32px;height:32px;border-radius:50%;font-family:inherit;flex:none" hover="border-color:#d64545;color:#d64545">✕</Hov>
        )}
      </div>
    );
  }
}
