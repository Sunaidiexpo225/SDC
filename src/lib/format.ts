import type { Lang } from "./i18n";

// Compact number formatting — ported from the design's `_fmt`.
export function fmt(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return (
      (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10)
        .toString()
        .replace(/\.0$/, "") + "K"
    );
  }
  return n.toLocaleString("en-US");
}

export function localeFor(lang: Lang): string {
  return lang === "ar" ? "ar-u-nu-latn" : "en-US";
}

// 12-hour clock label with AM/PM localized (ص/م in Arabic).
export function fmt12(time: string, lang: Lang): string {
  const [h, m] = time.split(":").map(Number);
  const am = h < 12;
  const hh = h % 12 || 12;
  const ap = lang === "ar" ? (am ? "ص" : "م") : am ? "AM" : "PM";
  return hh + ":" + String(m).padStart(2, "0") + " " + ap;
}

export function isoDate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function todayMidnight(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
