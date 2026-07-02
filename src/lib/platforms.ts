// Static platform metadata — shared by client and server.
// Colours and names are ported verbatim from the design's PLATFORMS array.

export type PlatformKey = "instagram" | "tiktok" | "x" | "facebook" | "linkedin";

export interface PlatformMeta {
  key: PlatformKey;
  en: string;
  ar: string;
  color: string;
}

export const PLATFORMS: PlatformMeta[] = [
  { key: "instagram", en: "Instagram", ar: "إنستغرام", color: "#e0457b" },
  { key: "tiktok", en: "TikTok", ar: "تيك توك", color: "#17a99b" },
  { key: "x", en: "X", ar: "إكس", color: "#0f172a" },
  { key: "facebook", en: "Facebook", ar: "فيسبوك", color: "#2563eb" },
  { key: "linkedin", en: "LinkedIn", ar: "لينكدإن", color: "#0a66c2" },
];

const PMAP: Record<string, PlatformMeta> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p]),
);

export function platformName(key: string, lang: "en" | "ar"): string {
  const p = PMAP[key];
  return p ? p[lang] : key;
}

export function platformColor(key: string): string {
  const p = PMAP[key];
  return p ? p.color : "#94a3b8";
}

export const PLATFORM_ORDER: PlatformKey[] = PLATFORMS.map((p) => p.key);
