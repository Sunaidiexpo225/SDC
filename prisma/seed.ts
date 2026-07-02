import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";

const prisma = new PrismaClient();

// ---- date helpers (dates are seeded relative to "today") ----
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
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

// ---- content suffixes (mirror of src/lib/content.ts) ----
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
  slug: string;
  en: string;
  ar: string;
  color: string;
  barIx: number;
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
const DEMO_PASSWORD = "password";

async function main() {
  // wipe (respecting FK order)
  await prisma.post.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // users
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        name: u.name, email: u.email, init: u.init, avColor: u.avColor,
        role: u.role, status: u.status, mfaEnabled: u.mfa,
        totpSecret: authenticator.generateSecret(), passwordHash,
      },
    });
  }

  // events + accounts + connections
  const slugToId: Record<string, string> = {};
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    const created = await prisma.event.create({
      data: {
        slug: e.slug, nameEn: e.en, nameAr: e.ar, color: e.color, barIx: e.barIx, order: i,
        accounts: {
          create: e.socials.map((s) => {
            const connected = !(s.key === "linkedin" || s.key === "x");
            return {
              platform: s.key, handle: s.handle, followers: s.f, connected,
              apiKey: connected ? `${API_PREFIX[s.key]}-live-${e.slug}${s.key.slice(0, 3)}` : null,
            };
          }),
        },
      },
    });
    slugToId[e.slug] = created.id;
  }

  // posts
  for (const e of EVENTS) {
    const plan = POST_PLAN[e.slug] || [];
    for (const [off, time, key, plats, status] of plan) {
      const sfx = SUFFIX[key];
      await prisma.post.create({
        data: {
          eventId: slugToId[e.slug], date: isoDate(addDays(today, off)), time,
          titleEn: `${e.en} · ${sfx.en}`, titleAr: `${e.ar} · ${sfx.ar}`,
          captionEn: sfx.capEn, captionAr: sfx.capAr,
          platformsCsv: plats.join(","), status,
        },
      });
    }
  }

  // approvals
  for (const e of EVENTS) {
    const plan = APPROVAL_PLAN[e.slug] || [];
    const firstTwo = e.socials.slice(0, 2).map((s) => s.key);
    for (const [key, whoEn, whoAr, init, avColor, when, status] of plan) {
      const sfx = SUFFIX[key];
      await prisma.approval.create({
        data: {
          eventId: slugToId[e.slug], whoEn, whoAr, init, avColor,
          titleEn: `${e.en} · ${sfx.en}`, titleAr: `${e.ar} · ${sfx.ar}`,
          captionEn: sfx.capEn, captionAr: sfx.capAr,
          platformsCsv: firstTwo.join(","), whenLabel: when, status,
        },
      });
    }
  }

  // settings singleton
  await prisma.setting.create({ data: { id: 1 } });

  console.log("Seed complete:", {
    events: EVENTS.length,
    users: USERS.length,
    demoLogin: "sara@sunaidiexpo.com / " + DEMO_PASSWORD + " (MFA code: 123456)",
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
