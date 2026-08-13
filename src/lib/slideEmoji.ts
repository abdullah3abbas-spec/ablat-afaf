/**
 * الهوية البصرية للشرائح (صقل زكريت):
 * رمز تعبيري لكل شريحة من محتواها العلمي + لون مميّز يتناوب —
 * محلي بالكامل وحتمي (نفس الشريحة = نفس الرمز واللون دائماً).
 */
import type { VisualSlide } from "@/db/schema";

/** كلمة علمية → رمز — الأسبق أولاً */
const KEYWORD_EMOJI: [RegExp, string][] = [
  [/بخار|تبخ/u, "☁️"],
  [/جليد|ثلج|تجم/u, "🧊"],
  [/مطر|هطول/u, "🌧️"],
  [/ماء|سائل/u, "💧"],
  [/حرار|تسخين|درجة/u, "🌡️"],
  [/نار|احتراق|لهب/u, "🔥"],
  [/خلط|مخلوط|محلول/u, "🥤"],
  [/ذوبان|ملح/u, "🧂"],
  [/هضم|معدة|غذاء|طعام/u, "🍎"],
  [/تنفس|رئة|هواء/u, "🫁"],
  [/قلب|دم|دورا/u, "❤️"],
  [/عظم|هيكل/u, "🦴"],
  [/دماغ|عصب|حواس/u, "🧠"],
  [/نبات|ورق|جذر|بذر/u, "🌱"],
  [/شمس|ضوء/u, "☀️"],
  [/كهرب/u, "⚡"],
  [/مغناطيس/u, "🧲"],
  [/صوت/u, "🔊"],
  [/كتلة|ميزان|وزن/u, "⚖️"],
  [/حجم|لتر|مخبار/u, "🧪"],
  [/كثافة|طفو|يغوص/u, "🛟"],
  [/خلية|مجهر/u, "🔬"],
  [/صخر|تربة|حجر/u, "🪨"],
  [/قمر|نجم|فضاء|كوكب/u, "🌙"],
];

/** رمز افتراضي حسب نوع الشريحة إن لم تسعفنا الكلمات */
const LAYOUT_EMOJI: Record<VisualSlide["layout"], string> = {
  cover: "🔬",
  objectives: "🎯",
  bullets: "📖",
  comparison: "⚖️",
  cycle: "🔄",
  steps: "🪜",
  labeled: "🧭",
  icons: "✨",
  interaction: "🤔",
};

export function emojiFor(slide: VisualSlide): string {
  const haystack = [slide.title, ...(slide.bullets ?? []), slide.interaction?.prompt ?? ""].join(" ");
  for (const [re, emoji] of KEYWORD_EMOJI) if (re.test(haystack)) return emoji;
  return LAYOUT_EMOJI[slide.layout];
}

/** لوحة ألوان الشريحة — تتناوب بثبات حسب موضع الشريحة */
export interface SlideAccent {
  /** شريط الرأس المتدرّج */
  band: string;
  /** لون النص المميّز */
  text: string;
  /** خلفية ناعمة للبطاقات الداخلية */
  soft: string;
  /** حد */
  border: string;
}

const ACCENTS: SlideAccent[] = [
  { band: "from-teal to-teal-dark", text: "text-teal-dark", soft: "bg-teal-bg", border: "border-teal" },
  { band: "from-gold to-gold-dark", text: "text-gold-dark", soft: "bg-gold-bg", border: "border-gold" },
  { band: "from-maroon to-maroon-dark", text: "text-maroon", soft: "bg-danger-bg", border: "border-maroon" },
  { band: "from-ok to-teal-dark", text: "text-ok", soft: "bg-teal-bg", border: "border-ok" },
];

export function accentFor(index: number): SlideAccent {
  return ACCENTS[index % ACCENTS.length];
}
