// Natural-language parsing for the task quick-add box: `@initials`/`@name`
// mentions resolve to an assignee, and words like "today"/"tomorrow"/weekday
// names (EN + AR) resolve to a due date. Pure + framework-free so it's easy to
// unit-test and reuse.

import { addDays, isoDate } from "./format";

export interface SmartUser {
  id: string;
  name: string;
  init: string;
}

export interface SmartParse {
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueLabel: string | null; // the word that matched (e.g. "tomorrow")
  cleanTitle: string; // title with the recognised @mention + date word removed
}

// Weekday names → 0..6 (Sun..Sat), EN + common AR.
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, "الأحد": 0, "الاحد": 0,
  monday: 1, mon: 1, "الإثنين": 1, "الاثنين": 1, "الاتنين": 1,
  tuesday: 2, tue: 2, tues: 2, "الثلاثاء": 2,
  wednesday: 3, wed: 3, "الأربعاء": 3, "الاربعاء": 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, "الخميس": 4,
  friday: 5, fri: 5, "الجمعة": 5,
  saturday: 6, sat: 6, "السبت": 6,
};

// Resolve a matched user for an `@token` by initials (exact) or name prefix.
function matchUser(token: string, users: SmartUser[]): SmartUser | null {
  const q = token.toLowerCase();
  const byInit = users.find((u) => u.init.toLowerCase() === q);
  if (byInit) return byInit;
  const byName = users.find((u) =>
    u.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) ||
    u.name.toLowerCase().startsWith(q),
  );
  return byName ?? null;
}

// Candidate users for the live `@` autocomplete, given the fragment after `@`.
export function mentionCandidates(fragment: string, users: SmartUser[]): SmartUser[] {
  const q = fragment.toLowerCase();
  if (!q) return users.slice(0, 6);
  return users
    .filter(
      (u) =>
        u.init.toLowerCase().startsWith(q) ||
        u.name.toLowerCase().includes(q),
    )
    .slice(0, 6);
}

// If the text ends in an in-progress `@fragment` (no space yet), return it so
// the UI can show the mention picker. Returns null otherwise.
export function trailingMention(text: string): string | null {
  const m = text.match(/@([^\s@]*)$/);
  return m ? m[1] : null;
}

export function parseSmartTask(
  text: string,
  users: SmartUser[],
  today: Date,
): SmartParse {
  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  let dueDate: string | null = null;
  let dueLabel: string | null = null;
  let clean = text;

  // --- assignee: first @token that resolves to a user ---
  const mentions = [...text.matchAll(/@([^\s@]+)/g)];
  for (const m of mentions) {
    const user = matchUser(m[1], users);
    if (user) {
      assigneeId = user.id;
      assigneeName = user.name;
      clean = clean.replace(m[0], " ");
      break;
    }
  }

  // --- due date: today / tomorrow / weekday / next week / explicit ISO ---
  const lower = clean.toLowerCase();
  const setDue = (offset: number, label: string, raw?: string) => {
    dueDate = isoDate(addDays(today, offset));
    dueLabel = label;
    if (raw) clean = clean.replace(new RegExp(raw, "i"), " ");
  };

  const iso = clean.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    dueDate = iso[1];
    dueLabel = iso[1];
    clean = clean.replace(iso[0], " ");
  } else if (/\b(today|tonight)\b/.test(lower) || /اليوم/.test(clean)) {
    setDue(0, "today", "today|tonight|اليوم");
  } else if (/\b(tomorrow|tmrw)\b/.test(lower) || /(غدًا|غداً|غدا|بكرة)/.test(clean)) {
    setDue(1, "tomorrow", "tomorrow|tmrw|غدًا|غداً|غدا|بكرة");
  } else if (/\bnext week\b/.test(lower) || /الأسبوع القادم/.test(clean)) {
    setDue(7, "next week", "next week|الأسبوع القادم");
  } else {
    for (const [word, dow] of Object.entries(WEEKDAYS)) {
      const isArabic = /[؀-ۿ]/.test(word);
      const re = isArabic ? new RegExp(word) : new RegExp(`\\b${word}\\b`, "i");
      if (re.test(isArabic ? clean : lower)) {
        const diff = (dow - today.getDay() + 7) % 7 || 7; // the *coming* weekday
        setDue(diff, word, isArabic ? word : `\\b${word}\\b`);
        break;
      }
    }
  }

  clean = clean.replace(/\s{2,}/g, " ").trim();
  return { assigneeId, assigneeName, dueDate, dueLabel, cleanTitle: clean };
}
