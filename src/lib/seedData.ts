// Seed data + seeding logic — shared by the CLI seed (prisma/seed.ts) and the
// runtime auto-seed (ensureSeeded), so a freshly-deployed empty database
// populates itself on first load with no manual step.

import type { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { prisma } from "./db";

type Db = PrismaClient | Prisma.TransactionClient;

function isoDate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const SUFFIX: Record<string, { en: string; ar: string; capEn: string; capAr: string }> = {
  teaser: { en: "Teaser", ar: "تشويق", capEn: "Save the date — something big is coming.", capAr: "احجزوا الموعد — شيء كبير قادم." },
  lineup: { en: "Exhibitor lineup", ar: "قائمة العارضين", capEn: "Meet the brands exhibiting this year.", capAr: "تعرّفوا على العلامات المشاركة هذا العام." },
  tickets: { en: "Tickets live", ar: "التذاكر متاحة", capEn: "Passes are now available — grab yours before they sell out.", capAr: "التذاكر متاحة الآن — احجزوا قبل نفادها." },
  speaker: { en: "Speaker reveal", ar: "الكشف عن المتحدثين", capEn: "Our keynote lineup just dropped. Swipe to see who is joining.", capAr: "أعلنّا عن قائمة المتحدثين الرئيسيين. اكتشفوا من سينضم." },
  recap: { en: "Day 1 recap", ar: "ملخص اليوم الأول", capEn: "Day one, in 30 seconds. Watch till the end.", capAr: "اليوم الأول في 30 ثانية. شاهدوا حتى النهاية." },
  bts: { en: "Behind the scenes", ar: "خلف الكواليس", capEn: "A peek at how it all comes together.", capAr: "نظرة على كيفية تجهيز كل شيء." },
  countdown: { en: "Countdown", ar: "العد التنازلي", capEn: "Only a few days to go. Are you ready?", capAr: "أيام قليلة تبقّت. هل أنتم مستعدون؟" },
  highlights: { en: "Highlights", ar: "أبرز اللحظات", capEn: "The best moments, all in one reel.", capAr: "أفضل اللحظات في ريل واحد." },
};

interface SeedEvent {
  slug: string; en: string; ar: string; color: string; barIx: number;
  socials: { key: string; handle: string; f: number }[];
}

const EVENTS: SeedEvent[] = [
  { slug: "auto", en: "Riyadh Auto Show", ar: "معرض الرياض للسيارات", color: "#e0457b", barIx: 0, socials: [
    { key: "instagram", handle: "@riyadhautoshow", f: 128000 }, { key: "tiktok", handle: "@riyadhauto", f: 96000 }, { key: "x", handle: "@RiyadhAutoShow", f: 41000 }, { key: "facebook", handle: "Riyadh Auto Show", f: 63000 }, { key: "linkedin", handle: "Riyadh Auto Show", f: 22000 } ] },
  { slug: "food", en: "Saudi Food Expo", ar: "إكسبو الغذاء السعودي", color: "#17a99b", barIx: 1, socials: [
    { key: "instagram", handle: "@saudifoodexpo", f: 74000 }, { key: "tiktok", handle: "@saudifood", f: 52000 }, { key: "facebook", handle: "Saudi Food Expo", f: 38000 }, { key: "linkedin", handle: "Saudi Food Expo", f: 31000 } ] },
  { slug: "beauty", en: "Beauty World KSA", ar: "بيوتي وورلد السعودية", color: "#7c5cf0", barIx: 2, socials: [
    { key: "instagram", handle: "@beautyworldksa", f: 210000 }, { key: "tiktok", handle: "@beautyworldksa", f: 175000 }, { key: "x", handle: "@BeautyWorldKSA", f: 33000 }, { key: "linkedin", handle: "Beauty World KSA", f: 18000 } ] },
  { slug: "big5", en: "Big 5 Construct Saudi", ar: "بيغ 5 للإنشاءات السعودية", color: "#2563eb", barIx: 3, socials: [
    { key: "instagram", handle: "@big5saudi", f: 45000 }, { key: "x", handle: "@Big5Saudi", f: 28000 }, { key: "facebook", handle: "Big 5 Construct Saudi", f: 51000 }, { key: "linkedin", handle: "Big 5 Construct Saudi", f: 96000 } ] },
  { slug: "gaming", en: "Gaming & Esports Expo", ar: "إكسبو الألعاب والرياضات الإلكترونية", color: "#f59e0b", barIx: 4, socials: [
    { key: "instagram", handle: "@gamingexpoksa", f: 156000 }, { key: "tiktok", handle: "@gamingexpo", f: 240000 }, { key: "x", handle: "@GamingExpoKSA", f: 88000 }, { key: "facebook", handle: "Gaming Esports Expo", f: 72000 }, { key: "linkedin", handle: "Gaming & Esports Expo", f: 27000 } ] },
];

const POST_PLAN: Record<string, [number, string, string, string[], string][]> = {
  auto: [[-3, "18:00", "teaser", ["instagram", "tiktok"], "posted"], [0, "18:00", "tickets", ["instagram", "tiktok", "facebook"], "scheduled"], [3, "12:00", "lineup", ["instagram", "x"], "scheduled"], [7, "20:30", "countdown", ["tiktok"], "scheduled"]],
  food: [[-1, "12:00", "bts", ["instagram"], "posted"], [1, "09:00", "lineup", ["instagram", "facebook"], "scheduled"], [5, "15:00", "tickets", ["instagram", "tiktok"], "scheduled"], [9, "18:00", "highlights", ["facebook", "instagram"], "scheduled"]],
  beauty: [[-2, "18:00", "speaker", ["instagram", "tiktok"], "posted"], [0, "20:00", "tickets", ["instagram", "tiktok", "x"], "scheduled"], [4, "12:00", "bts", ["instagram"], "scheduled"], [11, "15:00", "countdown", ["tiktok", "x"], "scheduled"]],
  big5: [[2, "09:00", "speaker", ["linkedin", "x"], "scheduled"], [6, "12:00", "lineup", ["linkedin", "facebook"], "scheduled"], [13, "10:00", "tickets", ["instagram", "facebook"], "scheduled"]],
  gaming: [[-1, "21:00", "teaser", ["tiktok", "instagram"], "posted"], [0, "18:00", "countdown", ["instagram", "tiktok", "x", "facebook"], "scheduled"], [2, "20:30", "highlights", ["tiktok"], "scheduled"], [8, "19:00", "speaker", ["instagram", "x"], "scheduled"], [15, "12:00", "tickets", ["instagram", "facebook"], "scheduled"]],
};

const APPROVAL_PLAN: Record<string, [string, string, string, string, string, string, string][]> = {
  auto: [["speaker", "Maya K.", "مايا ك.", "MK", "#7c5cf0", "today", "pending"], ["bts", "Omar R.", "عمر ر.", "OR", "#f59e0b", "today", "pending"]],
  food: [["lineup", "Lina S.", "لينا س.", "LS", "#17a99b", "yesterday", "pending"]],
  beauty: [["tickets", "Maya K.", "مايا ك.", "MK", "#7c5cf0", "today", "pending"], ["countdown", "Sara N.", "سارة ن.", "SN", "#e0457b", "yesterday", "approved"]],
  big5: [["speaker", "Omar R.", "عمر ر.", "OR", "#f59e0b", "yesterday", "pending"]],
  gaming: [["highlights", "Yusuf A.", "يوسف أ.", "YA", "#2563eb", "today", "pending"], ["teaser", "Lina S.", "لينا س.", "LS", "#17a99b", "yesterday", "approved"]],
};

const USERS = [
  { name: "Sara Al-Sunaidi", email: "sara@sunaidiexpo.com", init: "SA", avColor: "#e0457b", role: "Admin", mfa: true, status: "active" },
  { name: "Maya Khan", email: "maya@sunaidiexpo.com", init: "MK", avColor: "#7c5cf0", role: "Manager", mfa: true, status: "active" },
  { name: "Omar Rashed", email: "omar@sunaidiexpo.com", init: "OR", avColor: "#f59e0b", role: "Editor", mfa: false, status: "active" },
  { name: "Lina Saeed", email: "lina@sunaidiexpo.com", init: "LS", avColor: "#17a99b", role: "Viewer", mfa: false, status: "active" },
  { name: "Yusuf Ahmed", email: "yusuf@sunaidiexpo.com", init: "YA", avColor: "#2563eb", role: "Editor", mfa: true, status: "active" },
  { name: "Nora Fahad", email: "nora@sunaidiexpo.com", init: "NF", avColor: "#0ea5a3", role: "Viewer", mfa: false, status: "invited" },
];

const API_PREFIX: Record<string, string> = { instagram: "IG", tiktok: "TT", x: "X", facebook: "FB", linkedin: "LI" };
export const DEMO_PASSWORD = "password";

// Inserts users, events (+accounts), posts and approvals. Assumes the tables
// are empty and does NOT touch Setting (the caller manages that as a lock).
export async function seedCore(db: Db) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of USERS) {
    await db.user.create({
      data: {
        name: u.name, email: u.email, init: u.init, avColor: u.avColor,
        role: u.role, status: u.status, mfaEnabled: u.mfa,
        totpSecret: authenticator.generateSecret(), passwordHash,
      },
    });
  }

  const slugToId: Record<string, string> = {};
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    const created = await db.event.create({
      data: {
        slug: e.slug, nameEn: e.en, nameAr: e.ar, color: e.color, barIx: e.barIx, order: i,
        accounts: {
          create: e.socials.map((sq) => {
            const connected = !(sq.key === "linkedin" || sq.key === "x");
            return {
              platform: sq.key, handle: sq.handle, followers: sq.f, connected,
              apiKey: connected ? `${API_PREFIX[sq.key]}-live-${e.slug}${sq.key.slice(0, 3)}` : null,
            };
          }),
        },
      },
    });
    slugToId[e.slug] = created.id;
  }

  for (const e of EVENTS) {
    for (const [off, time, key, plats, status] of POST_PLAN[e.slug] || []) {
      const sfx = SUFFIX[key];
      await db.post.create({
        data: {
          eventId: slugToId[e.slug], date: isoDate(addDays(today, off as number)), time: time as string,
          titleEn: `${e.en} · ${sfx.en}`, titleAr: `${e.ar} · ${sfx.ar}`,
          captionEn: sfx.capEn, captionAr: sfx.capAr,
          platformsCsv: (plats as string[]).join(","), status: status as string,
        },
      });
    }
  }

  for (const e of EVENTS) {
    const firstTwo = e.socials.slice(0, 2).map((sq) => sq.key);
    for (const [key, whoEn, whoAr, init, avColor, when, status] of APPROVAL_PLAN[e.slug] || []) {
      const sfx = SUFFIX[key];
      await db.approval.create({
        data: {
          eventId: slugToId[e.slug], whoEn, whoAr, init, avColor,
          titleEn: `${e.en} · ${sfx.en}`, titleAr: `${e.ar} · ${sfx.ar}`,
          captionEn: sfx.capEn, captionAr: sfx.capAr,
          platformsCsv: firstTwo.join(","), whenLabel: when, status,
        },
      });
    }
  }
}

// CLI seed (wipe + reseed).
export async function seedDatabase(db: PrismaClient) {
  await db.post.deleteMany();
  await db.approval.deleteMany();
  await db.socialAccount.deleteMany();
  await db.event.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();
  await db.setting.create({ data: { id: 1 } });
  await seedCore(db);
}

// Runtime auto-seed: if the database is empty, populate it once. The Setting
// singleton row doubles as a lock so concurrent serverless instances don't
// double-seed.
let seeding: Promise<void> | null = null;
export async function ensureSeeded(): Promise<void> {
  try {
    const existing = await prisma.setting.findUnique({ where: { id: 1 } });
    if (existing) return;
  } catch {
    return; // tables not ready yet
  }
  if (!seeding) {
    seeding = (async () => {
      try {
        await prisma.setting.create({ data: { id: 1 } });
      } catch {
        return; // another instance grabbed the lock
      }
      try {
        // Run the inserts in a transaction so a mid-seed failure rolls back
        // every row — otherwise partial data (e.g. some users) would remain
        // and the unique-email constraint would make every retry fail.
        await prisma.$transaction((tx) => seedCore(tx), { timeout: 30_000 });
      } catch (e) {
        console.error("[seed] failed:", e);
        // Release the lock so a later request can retry from a clean slate.
        await prisma.setting.delete({ where: { id: 1 } }).catch(() => {});
        seeding = null;
      }
    })();
  }
  await seeding;
}
