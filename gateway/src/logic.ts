/**
 * منطق البوابة النقي — قابل للاختبار بلا شبكة:
 * اختيار المزوّد، تقدير التكلفة، عتبات الميزانية، مفاتيح الكاش والعدّادات.
 *
 * قاعدة الماستر برومبت: لا أسماء نماذج ولا أسعار مكتوبة في الكود —
 * كلها Environment Configuration تمرَّر لهذه الدوال كوسائط.
 */

export type Provider = "gemini" | "openai";

export interface ProviderPrices {
  /** دولار لكل مليون Token إدخال/إخراج */
  inPerM: number;
  outPerM: number;
}

/**
 * ترتيب المزوّدين للمهمة مع Failover:
 * «اسألي المنهج» فهمٌ لنصوص عربية طويلة → Gemini أولاً ثم OpenAI،
 * ولا يدخل القائمة إلا مزوّد مفتاحه مضبوط وميزانيته غير مستنفدة.
 */
export function pickProviders(opts: {
  geminiReady: boolean;
  openaiReady: boolean;
  geminiExhausted: boolean;
  openaiExhausted: boolean;
}): Provider[] {
  const order: Provider[] = ["gemini", "openai"];
  return order.filter((p) =>
    p === "gemini" ? opts.geminiReady && !opts.geminiExhausted : opts.openaiReady && !opts.openaiExhausted
  );
}

/** تقدير تكلفة نداء واحد بالدولار من عدد الـTokens والأسعار المضبوطة */
export function estimateCostUsd(inTokens: number, outTokens: number, prices: ProviderPrices): number {
  const cost = (inTokens / 1_000_000) * prices.inPerM + (outTokens / 1_000_000) * prices.outPerM;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** مستوى التنبيه حسب نسب الماستر برومبت: 60% ثم 80% ثم 95% ثم النفاد */
export function alertLevel(spentUsd: number, budgetUsd: number): 0 | 60 | 80 | 95 | 100 {
  if (budgetUsd <= 0) return 100;
  const pct = (spentUsd / budgetUsd) * 100;
  if (pct >= 100) return 100;
  if (pct >= 95) return 95;
  if (pct >= 80) return 80;
  if (pct >= 60) return 60;
  return 0;
}

/** مفتاح يوم العدّاد اليومي بتوقيت الدوحة (UTC+3 ثابت بلا توقيت صيفي) */
export function dohaDayKey(nowMs: number): string {
  const d = new Date(nowMs + 3 * 3600_000);
  return d.toISOString().slice(0, 10);
}

/** تمثيل ثابت للحمولة ثم SHA-256 — مفتاح كاش النواتج المتطابقة */
export async function cacheKeyOf(payload: unknown): Promise<string> {
  const text = JSON.stringify(payload);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AskSource {
  name: string;
  text: string;
  /** موضع الاقتباس: «شريحة ٣»، «الصفحة ١٢»… */
  locator?: string;
}

/** حدود حجم الطلب — حماية من طلب يستهلك الميزانية دفعة واحدة */
export const LIMITS = {
  questionMaxChars: 4_000,
  sourcesMaxChars: 150_000,
  sourcesMaxCount: 12,
  answerMaxTokens: 2_048,
} as const;

export function validateAsk(question: unknown, sources: unknown): string | null {
  if (typeof question !== "string" || question.trim().length === 0) return "سؤال فارغ";
  if (question.length > LIMITS.questionMaxChars) return "السؤال أطول من الحد المسموح";
  if (!Array.isArray(sources) || sources.length === 0) return "لا توجد مصادر مرفقة — اختاري درساً أو ملفاً أولاً";
  if (sources.length > LIMITS.sourcesMaxCount) return "عدد المصادر أكبر من الحد المسموح";
  let total = 0;
  for (const s of sources as AskSource[]) {
    if (typeof s?.name !== "string" || typeof s?.text !== "string") return "مصدر ناقص البيانات";
    total += s.text.length;
  }
  if (total > LIMITS.sourcesMaxChars) return "نصوص المصادر أكبر من الحد المسموح — اختاري أجزاء أقل";
  return null;
}

/** تعليمات النظام — الالتزام بالمصادر حرفياً والاستشهاد بها (المصداقية) */
export function systemPrompt(mode: "brief" | "detailed"): string {
  return [
    "أنتِ مساعدة منهج العلوم للصف الخامس الابتدائي (بنات) في دولة قطر.",
    "أجيبي عن سؤال المعلّمة اعتماداً على نصوص «المصادر» المرفقة أدناه فقط — لا تستخدمي أي معرفة خارجها، ولا تخترعي شيئاً.",
    "بعد كل معلومة اذكري مصدرها بين قوسين هكذا: (المصدر: اسم الملف — الموضع).",
    "إن لم تكن الإجابة موجودة في المصادر فقولي حرفياً: «هذه المعلومة غير موجودة في المصادر المرفوعة»، واذكري بجملة واحدة ما الذي يفيد رفعه.",
    "استخدمي مصطلحات المصادر كما وردت حرفياً — لا مرادفات.",
    "خاطبي المعلّمة بصيغة المؤنث، وبعربية فصحى مبسطة.",
    mode === "brief"
      ? "أجيبي بإيجاز شديد: الجواب المباشر في سطرين إلى أربعة أسطر."
      : "فصّلي الإجابة في نقاط واضحة مع كل الشواهد من المصادر.",
  ].join("\n");
}

/** نص المستخدم: السؤال ثم المصادر بترويسات واضحة */
export function userPrompt(question: string, sources: AskSource[]): string {
  const parts = [`سؤال المعلّمة: ${question.trim()}`, "", "المصادر:"];
  sources.forEach((s, i) => {
    parts.push(`### مصدر ${i + 1}: ${s.name}${s.locator ? ` — ${s.locator}` : ""}`);
    parts.push(s.text.trim());
    parts.push("");
  });
  return parts.join("\n");
}
