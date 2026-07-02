// Deterministic sample content — ported from the design.
// SUFFIX drives seeded post/approval titles + captions; the caption/hashtag
// sets back the "Generate with AI" mock; LIB backs the content library.

import type { Lang } from "./i18n";

export type SuffixKey =
  | "teaser"
  | "lineup"
  | "tickets"
  | "speaker"
  | "recap"
  | "bts"
  | "countdown"
  | "highlights";

export interface Suffix {
  en: string;
  ar: string;
  capEn: string;
  capAr: string;
}

export const SUFFIX: Record<SuffixKey, Suffix> = {
  teaser: {
    en: "Teaser",
    ar: "تشويق",
    capEn: "Save the date — something big is coming.",
    capAr: "احجزوا الموعد — شيء كبير قادم.",
  },
  lineup: {
    en: "Exhibitor lineup",
    ar: "قائمة العارضين",
    capEn: "Meet the brands exhibiting this year.",
    capAr: "تعرّفوا على العلامات المشاركة هذا العام.",
  },
  tickets: {
    en: "Tickets live",
    ar: "التذاكر متاحة",
    capEn: "Passes are now available — grab yours before they sell out.",
    capAr: "التذاكر متاحة الآن — احجزوا قبل نفادها.",
  },
  speaker: {
    en: "Speaker reveal",
    ar: "الكشف عن المتحدثين",
    capEn: "Our keynote lineup just dropped. Swipe to see who is joining.",
    capAr: "أعلنّا عن قائمة المتحدثين الرئيسيين. اكتشفوا من سينضم.",
  },
  recap: {
    en: "Day 1 recap",
    ar: "ملخص اليوم الأول",
    capEn: "Day one, in 30 seconds. Watch till the end.",
    capAr: "اليوم الأول في 30 ثانية. شاهدوا حتى النهاية.",
  },
  bts: {
    en: "Behind the scenes",
    ar: "خلف الكواليس",
    capEn: "A peek at how it all comes together.",
    capAr: "نظرة على كيفية تجهيز كل شيء.",
  },
  countdown: {
    en: "Countdown",
    ar: "العد التنازلي",
    capEn: "Only a few days to go. Are you ready?",
    capAr: "أيام قليلة تبقّت. هل أنتم مستعدون؟",
  },
  highlights: {
    en: "Highlights",
    ar: "أبرز اللحظات",
    capEn: "The best moments, all in one reel.",
    capAr: "أفضل اللحظات في ريل واحد.",
  },
};

export type Tone = "punchy" | "professional" | "friendly";

const CAPTION_SETS: Record<Lang, Record<Tone, string[]>> = {
  en: {
    punchy: [
      "Stop the scroll. This is the one you save the date for.",
      "Zero fluff. All hype. Watch this one to the end.",
      "You will not want to miss this. Proof inside.",
    ],
    professional: [
      "Registration is now open — reserve your place at this year’s edition.",
      "A closer look at what to expect on the show floor this year.",
      "This year’s programme is live. Here is what to plan for.",
    ],
    friendly: [
      "We cannot wait to see you there! Here is a little preview.",
      "Big things planned this year — take a look at what is coming.",
      "Mark your calendar, friends. You will want to be in the room.",
    ],
  },
  ar: {
    punchy: [
      "توقفوا عن التمرير. هذه الفعالية التي تستحق حجز الموعد لها.",
      "بلا مقدمات. كل الحماس هنا. شاهدوا حتى النهاية.",
      "لن ترغبوا في تفويت هذا. الدليل في الداخل.",
    ],
    professional: [
      "التسجيل مفتوح الآن — احجزوا مكانكم في نسخة هذا العام.",
      "نظرة أقرب على ما ينتظركم في أرض المعرض هذا العام.",
      "برنامج هذا العام متاح الآن. إليكم ما يمكنكم التخطيط له.",
    ],
    friendly: [
      "لا نطيق الانتظار لرؤيتكم هناك! إليكم لمحة صغيرة.",
      "أمور كبيرة مخطط لها هذا العام — ألقوا نظرة على ما هو قادم.",
      "دوّنوا الموعد يا أصدقاء. ستودّون التواجد في القاعة.",
    ],
  },
};

const HASHTAG_SETS: Record<Lang, string[][]> = {
  en: [
    ["#SunaidiExpo", "#SaveTheDate", "#Riyadh"],
    ["#TradeShow", "#Exhibition", "#KSAEvents"],
    ["#MarketingTeam", "#SocialFirst", "#SeeYouThere"],
  ],
  ar: [
    ["#سنيدي_إكسبو", "#احجز_الموعد", "#الرياض"],
    ["#معرض", "#فعاليات_السعودية", "#إكسبو"],
    ["#فريق_التسويق", "#السوشيال_أولاً", "#نراكم_هناك"],
  ],
};

// Mock "Generate with AI": pick a caption + hashtag set by tone / lang / index.
export function generateCaption(lang: Lang, tone: Tone, index: number) {
  const caps = CAPTION_SETS[lang]?.[tone] || CAPTION_SETS.en.punchy;
  const tags = HASHTAG_SETS[lang] || HASHTAG_SETS.en;
  return {
    caption: caps[index % caps.length],
    hashtags: tags[index % tags.length],
  };
}

export type AssetType = "Video" | "Reel" | "Image";

export interface LibraryAsset {
  name: string;
  type: AssetType;
  dur: string;
  hintEn: string;
}

export const LIBRARY: LibraryAsset[] = [
  { name: "teaser-cut.mp4", type: "Video", dur: "0:32", hintEn: "video · 16:9" },
  { name: "floor-bts-reel.mp4", type: "Reel", dur: "0:18", hintEn: "reel · 9:16" },
  { name: "hero-keyvisual.png", type: "Image", dur: "PNG", hintEn: "image · 1:1" },
  { name: "exhibitor-spotlight.mp4", type: "Reel", dur: "0:41", hintEn: "reel · 9:16" },
  { name: "howto-60s.mp4", type: "Video", dur: "1:00", hintEn: "video · 16:9" },
  { name: "lineup-card.png", type: "Image", dur: "PNG", hintEn: "image · 4:5" },
  { name: "speaker-teaser.mp4", type: "Reel", dur: "0:15", hintEn: "reel · 9:16" },
  { name: "day1-recap.mp4", type: "Video", dur: "0:29", hintEn: "video · 16:9" },
];

export function libraryHint(hintEn: string, lang: Lang): string {
  return lang === "ar"
    ? hintEn.replace("video", "فيديو").replace("reel", "ريل").replace("image", "صورة")
    : hintEn;
}
