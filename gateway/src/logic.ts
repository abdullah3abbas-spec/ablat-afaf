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

// ═══════════ توليد العروض البصرية (زكريت م٣) ═══════════

/** الأيقونات المسموحة في شريحة الأيقونات — أسماء lucide ثابتة يعرفها التطبيق */
export const ALLOWED_ICONS = [
  "droplets", "flask-conical", "leaf", "sun", "cloud", "thermometer", "magnet",
  "zap", "heart", "wind", "snowflake", "flame", "atom", "eye", "ear", "sprout",
] as const;

export const SLIDE_LAYOUTS = [
  "cover", "objectives", "bullets", "comparison", "cycle", "steps", "labeled", "icons", "interaction",
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export interface GenSlide {
  layout: SlideLayout;
  title: string;
  bullets?: string[];
  comparison?: { headers: string[]; rows: string[][] };
  cycle?: { steps: string[] };
  steps?: { steps: string[] };
  labeled?: { center: string; labels: string[] };
  icons?: { items: { icon: string; text: string }[] };
  interaction?: { kind: "question" | "predict" | "challenge"; prompt: string; answer: string };
  chart?: { kind: "pie" | "bars"; items: { label: string; value: number }[]; unit?: string };
  image?: { prompt: string; dataUrl?: string };
  note: { say: string; ask?: string; expected?: string; misconception?: string };
  source?: string;
}

export const GEN_LIMITS = {
  minSlides: 8,
  maxSlides: 14,
  maxAnswerTokens: 8192,
} as const;

/** تعليمات النظام لمولّد العروض — معيار «النص وحده مرفوض» كاملاً */
export function slidesSystemPrompt(): string {
  return [
    "أنتِ مصمّمة عروض تعليمية لمادة العلوم، الصف الخامس الابتدائي (بنات)، دولة قطر.",
    "ابني عرضاً بصرياً قابلاً للتدريس من «المصادر» المرفقة فقط — لا معرفة خارجية، والمصطلحات العلمية حرفياً كما وردت في المصادر.",
    `أخرجي JSON فقط (بلا أي نص آخر): مصفوفة من ${GEN_LIMITS.minSlides} إلى ${GEN_LIMITS.maxSlides} شريحة.`,
    "شكل كل شريحة: {layout, title, bullets?, comparison?, cycle?, steps?, labeled?, icons?, interaction?, note, source?}.",
    "الأشكال المتداخلة حرفياً — لا تخرجي عنها:",
    'comparison: {"headers":["الحالة","الشكل"],"rows":[["الصلبة","ثابت"],["السائلة","متغير"]]} (rows مصفوفات نصوص بنفس طول headers)',
    'cycle: {"steps":["تبخر","تكاثف","هطول"]} · steps: {"steps":["الخطوة الأولى","الثانية"]} (نصوص فقط)',
    'labeled: {"center":"المادة","labels":["لها كتلة","تشغل حيزا"]}',
    'icons: {"items":[{"icon":"droplets","text":"الماء سائل"}]}',
    'interaction: {"kind":"question","prompt":"...","answer":"..."}',
    'chart: {"kind":"pie"|"bars","items":[{"label":"آكلة العشب","value":6}],"unit":"?"} — أضيفي رسماً بيانياً حين توجد أعداد أو نسب تُفهم بصرياً أفضل (تصنيفات، مقارنات كمية).',
    'image: {"prompt":"وصف مشهد بالعربية"} — أضيفيه لشريحتين إلى أربع شرائح يخدمها رسم توضيحي: صفي المشهد من محتوى المصادر فقط (كائنات الدرس وبيئتها) بجملة غنية، ولا تطلبي أي نص داخل الصورة.',
    'note: {"say":"...","ask":"...","expected":"...","misconception":"..."}',

    "قيم layout المسموحة: cover, objectives, bullets, comparison, cycle, steps, labeled, icons, interaction.",
    "البنية الإلزامية — قوس العرض الوزاري القطري بالترتيب:",
    "١) cover (title = اسم الدرس) · ٢) bullets بعنوان «تعلمنا في الدرس السابق» تمهّد من الدرس الذي قبله · ٣) interaction من نوع predict = النشاط الافتتاحي، واذكري في prompt صفحة الكتاب («افتحي الكتاب ص…») إن وردت في المصادر · ٤) objectives (أهداف الحصة بصياغة تناسب الطالبات).",
    "ثم شرائح المحتوى والأنشطة، وكل نشاط يُذكر فيه رقم صفحته من الكتاب إن ورد في المصادر.",
    "قرب الختام إلزامياً: شريحة interaction من نوع challenge بعنوان «فكّر» (سؤال أعمق) · ثم bullets بعنوان «ماذا تعلمنا؟ هل حققنا الأهداف؟» تلخص وتعود للأهداف · ثم bullets بعنوان «نتحقق مما تعلمنا» تحيل لأسئلة الكتاب بصفحاتها · وآخر شريحة bullets بعنوان «الواجب» ونصها «حل الواجب المسند على نظام قطر للتعليم».",
    "القصة التعليمية داخل المحتوى: إثارة فضول ← اكتشاف ← تفسير ← تطبيق ← تقويم.",
    "٦٠٪ من الشرائح على الأقل بصرية: استخدمي comparison (مقارنة صفوف يمين/يسار) أو cycle (دورة ٣–٦ خطوات) أو steps (خطوات مرتبة ٣–٦) أو labeled (مفهوم مركزي وحوله تسميات) أو icons (عناصر بأيقونات).",
    `أسماء الأيقونات المسموحة فقط: ${ALLOWED_ICONS.join(", ")}.`,
    "كل ٣–٤ شرائح ضعي شريحة interaction: {kind: question|predict|challenge, prompt, answer} — الإجابة تُعرض للمعلّمة فقط ولا تظهر للطالبات حتى تضغط «أظهري الإجابة».",
    "حدود النص: العنوان ≤ ٨ كلمات · كل نقطة ≤ ١٢ كلمة · لا تتجاوز الشريحة ٤٥ كلمة إجمالاً. جزّئي المحتوى الطويل على شرائح.",
    "لكل شريحة note إلزامية للمعلّمة: {say: ماذا تقولين، ask?: سؤال تطرحينه، expected?: الإجابة المتوقعة، misconception?: الخطأ الشائع}.",
    "لكل شريحة معلوماتية source: «اسم المصدر — الموضع» من المصادر المرفقة.",
    "اللغة: عربية فصحى مبسطة تناسب عمر ١٠ سنوات، وخطاب الطالبات بصيغة المؤنث.",
    "روح العرض «رحلة استكشاف» لبنات في العاشرة: جمل قصيرة حيّة، تشبيه أو مثال من بيئة قطر (البحر، الصحراء، المها، النخيل، البيت) في كل شريحتين إلى ثلاث، وسؤال فضول يفتح الشريحة الجديدة — من غير طفولية زائدة ولا تهريج: عالمات صغيرات لا روضة. المصطلح العلمي يبقى حرفياً من الكتاب.",
  ].join("\n");
}

export function slidesUserPrompt(lessonTitle: string, sources: AskSource[]): string {
  return userPrompt(`ابني العرض البصري الكامل لدرس «${lessonTitle}»`, sources);
}

/** مخطط JSON الصارم لـ OpenAI structured outputs */
export const SLIDES_OPENAI_SCHEMA = {
  name: "visual_slides",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["slides"],
    properties: {
      slides: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["layout", "title", "note"],
          properties: {
            layout: { type: "string", enum: [...SLIDE_LAYOUTS] },
            title: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            comparison: {
              type: "object",
              additionalProperties: false,
              required: ["headers", "rows"],
              properties: {
                headers: { type: "array", items: { type: "string" } },
                rows: { type: "array", items: { type: "array", items: { type: "string" } } },
              },
            },
            cycle: {
              type: "object", additionalProperties: false, required: ["steps"],
              properties: { steps: { type: "array", items: { type: "string" } } },
            },
            steps: {
              type: "object", additionalProperties: false, required: ["steps"],
              properties: { steps: { type: "array", items: { type: "string" } } },
            },
            labeled: {
              type: "object", additionalProperties: false, required: ["center", "labels"],
              properties: { center: { type: "string" }, labels: { type: "array", items: { type: "string" } } },
            },
            icons: {
              type: "object", additionalProperties: false, required: ["items"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false, required: ["icon", "text"],
                    properties: { icon: { type: "string" }, text: { type: "string" } },
                  },
                },
              },
            },
            interaction: {
              type: "object", additionalProperties: false, required: ["kind", "prompt", "answer"],
              properties: {
                kind: { type: "string", enum: ["question", "predict", "challenge"] },
                prompt: { type: "string" },
                answer: { type: "string" },
              },
            },
            image: {
              type: "object", additionalProperties: false, required: ["prompt"],
              properties: { prompt: { type: "string" } },
            },
            chart: {
              type: "object", additionalProperties: false, required: ["kind", "items"],
              properties: {
                kind: { type: "string", enum: ["pie", "bars"] },
                unit: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object", additionalProperties: false, required: ["label", "value"],
                    properties: { label: { type: "string" }, value: { type: "number" } },
                  },
                },
              },
            },
            note: {
              type: "object", additionalProperties: false, required: ["say"],
              properties: {
                say: { type: "string" }, ask: { type: "string" },
                expected: { type: "string" }, misconception: { type: "string" },
              },
            },
            source: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/** تطبيع الأشكال المتداخلة — النماذج تنحرف عن المخطط بأشكال شائعة معروفة */
function coerceSlide(input: Record<string, unknown>): GenSlide {
  const s = { ...input } as unknown as GenSlide & Record<string, unknown>;

  // comparison: الشكل القديم {rightLabel,leftLabel,rows:[{right,left}]} → جدول عام
  const cmp = s.comparison as unknown as
    | { headers?: unknown[]; rows?: unknown[]; rightLabel?: string; leftLabel?: string }
    | undefined;
  if (cmp) {
    if (Array.isArray(cmp.headers) && Array.isArray(cmp.rows)) {
      s.comparison = {
        headers: cmp.headers.map(String),
        rows: cmp.rows.map((r) =>
          Array.isArray(r) ? r.map(String) : typeof r === "object" && r !== null ? Object.values(r).map(String) : [String(r)]
        ),
      };
    } else if (typeof cmp.rightLabel === "string" && typeof cmp.leftLabel === "string") {
      s.comparison = {
        headers: [cmp.rightLabel, cmp.leftLabel],
        rows: ((cmp.rows ?? []) as { right?: unknown; left?: unknown }[]).map((r) => [String(r.right ?? ""), String(r.left ?? "")]),
      };
    } else {
      delete (s as Record<string, unknown>).comparison;
    }
  }

  // cycle/steps: قد تأتي مصفوفة مباشرة أو عناصر كائنات {title,text}
  for (const key of ["cycle", "steps"] as const) {
    const v = s[key] as unknown;
    const arr = Array.isArray(v) ? v : (v as { steps?: unknown[] })?.steps;
    if (v != null) {
      if (Array.isArray(arr)) {
        s[key] = {
          steps: arr
            .map((st) =>
              typeof st === "string"
                ? st
                : [((st as Record<string, unknown>).title ?? "") as string, ((st as Record<string, unknown>).text ?? "") as string]
                    .filter(Boolean)
                    .join(": ")
            )
            .filter((x) => x.trim() !== ""),
        };
      } else delete (s as Record<string, unknown>)[key];
    }
  }

  // icons: قد تأتي مصفوفة مباشرة، وقد يحمل العنصر label إضافية
  const ic = s.icons as unknown;
  const icArr = Array.isArray(ic) ? ic : (ic as { items?: unknown[] })?.items;
  if (ic != null) {
    if (Array.isArray(icArr)) {
      s.icons = {
        items: icArr.map((raw) => {
          const it = raw as { icon?: unknown; text?: unknown; label?: unknown };
          const text = [it.label, it.text].filter((x) => typeof x === "string" && x.trim()).join(": ");
          return {
            icon: (ALLOWED_ICONS as readonly string[]).includes(String(it.icon)) ? String(it.icon) : "sprout",
            text: text || String(it.text ?? ""),
          };
        }),
      };
    } else delete (s as Record<string, unknown>).icons;
  }

  // chart: تطبيع القيم أرقاماً وإسقاط الفارغ
  const ch = s.chart as unknown as { kind?: string; items?: unknown[]; unit?: unknown } | undefined;
  if (ch) {
    const items = (Array.isArray(ch.items) ? ch.items : [])
      .map((it) => {
        const o = it as { label?: unknown; value?: unknown };
        return { label: String(o.label ?? "").trim(), value: Number(o.value) };
      })
      .filter((it) => it.label !== "" && Number.isFinite(it.value));
    if ((ch.kind === "pie" || ch.kind === "bars") && items.length >= 2) {
      s.chart = { kind: ch.kind, items, unit: typeof ch.unit === "string" ? ch.unit : undefined };
    } else {
      delete (s as Record<string, unknown>).chart;
    }
  }
  // image: نبقي الوصف النصي فقط (الصورة تولَّد لاحقاً بموافقة المعلّمة)
  const im = s.image as unknown as { prompt?: unknown; dataUrl?: unknown } | undefined;
  if (im) {
    const promptTxt = typeof im.prompt === "string" ? im.prompt.trim() : "";
    if (promptTxt.length >= 8) {
      s.image = { prompt: promptTxt, dataUrl: typeof im.dataUrl === "string" ? im.dataUrl : undefined };
    } else {
      delete (s as Record<string, unknown>).image;
    }
  }
  return s as GenSlide;
}

/**
 * فحص وتنظيف مخرج المولّد — يقبل {slides:[…]} أو المصفوفة مباشرة،
 * يطبّع الانحرافات الشائعة، ويعيد رسالة عربية عند الرفض.
 */
export function validateSlidesPayload(raw: unknown): { ok: true; slides: GenSlide[] } | { ok: false; messageAr: string } {
  const arr: unknown = Array.isArray(raw) ? raw : (raw as { slides?: unknown })?.slides;
  if (!Array.isArray(arr)) return { ok: false, messageAr: "مخرج المولّد ليس قائمة شرائح" };
  if (arr.length < GEN_LIMITS.minSlides || arr.length > GEN_LIMITS.maxSlides)
    return { ok: false, messageAr: `عدد الشرائح ${arr.length} خارج الحد (${GEN_LIMITS.minSlides}–${GEN_LIMITS.maxSlides})` };

  const slides: GenSlide[] = [];
  for (const rawSlide of arr as Record<string, unknown>[]) {
    if (!rawSlide || typeof rawSlide !== "object") return { ok: false, messageAr: "شريحة غير مقروءة" };
    const s = coerceSlide(rawSlide);
    if (typeof s.title !== "string" || !SLIDE_LAYOUTS.includes(s.layout)) {
      return { ok: false, messageAr: "شريحة ناقصة العنوان أو التخطيط" };
    }
    if (typeof s.note?.say !== "string" || s.note.say.trim() === "") {
      return { ok: false, messageAr: `شريحة «${s.title}» بلا ملاحظة معلّمة` };
    }
    if (s.layout === "interaction" && (typeof s.interaction?.prompt !== "string" || typeof s.interaction?.answer !== "string")) {
      return { ok: false, messageAr: `شريحة تفاعلية «${s.title}» بلا سؤال أو إجابة` };
    }
    slides.push(s);
  }
  return { ok: true, slides };
}

// ═══════════ توليد حزمة الحصة الكاملة (١٥/١٠) ═══════════

export const PACK_QUESTION_TYPES = ["mcq", "truefalse", "define", "fillblank", "order"] as const;
export type PackQuestionType = (typeof PACK_QUESTION_TYPES)[number];

export interface PackQuestion {
  type: PackQuestionType;
  text: string;
  options?: { key: string; text: string }[];
  /** mcq: رمز الخيار · order: خطوات بفواصل « ← » · غيره: نص الإجابة */
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  cognitiveLevel: "remember" | "understand" | "apply" | "higher";
}

export interface LessonPack {
  plan: { objectives: string[]; stages: { name: string; minutes: number; what: string }[] };
  opener: { title: string; text: string; minutes: number };
  discussion: string[];
  activityIndividual: { title: string; text: string };
  activityGroup: { title: string; text: string };
  questions: PackQuestion[];
  exitTicket: { questions: string[] };
  homework: { tasks: string[] };
  teacherNotes: { say: string; misconceptions: string[]; materials: string[] };
  sources: string[];
}

export function packSystemPrompt(): string {
  return [
    "أنتِ معلّمة علوم خبيرة للصف الخامس الابتدائي (بنات)، دولة قطر.",
    "ابني حزمة حصة كاملة لدرس واحد من «المصادر» المرفقة فقط — المصطلحات حرفياً من المصادر، ولا معرفة خارجية.",
    "أخرجي JSON واحداً فقط بهذا الشكل الحرفي:",
    '{"plan":{"objectives":["هدف"],"stages":[{"name":"التهيئة","minutes":5,"what":"..."}]},',
    '"opener":{"title":"...","text":"...","minutes":5},',
    '"discussion":["سؤال نقاش"],',
    '"activityIndividual":{"title":"...","text":"..."},',
    '"activityGroup":{"title":"...","text":"..."},',
    '"questions":[{"type":"mcq","text":"...","options":[{"key":"أ","text":"..."}],"answer":"أ","difficulty":"easy","cognitiveLevel":"remember"}],',
    '"exitTicket":{"questions":["..."]},',
    '"homework":{"tasks":["..."]},',
    '"teacherNotes":{"say":"...","misconceptions":["..."],"materials":["..."]},',
    '"sources":["اسم المصدر — الموضع"]}',
    "القواعد (بنية الحصة الوزارية القطرية):",
    "- خطة الحصة ٤٥ دقيقة: أهداف ٣–٤ بصياغة تناسب الطالبات، ومراحل ٤–٦ مجموع دقائقها ٤٥ بالضبط — أولها «التهيئة» (٥ د) وآخرها «الغلق الختامي» (٥ د).",
    "- النشاط الافتتاحي يثير الفضول (ظاهرة، سؤال محيّر، النشاط الافتتاحي في الكتاب بصفحته) في ٥ دقائق.",
    "- أسئلة النقاش ٣–٥ مفتوحة متدرجة.",
    "- النشاطان (فردي وجماعي) بتعليمات خطوة بخطوة قابلة للتنفيذ في الفصل بأدوات بسيطة، وفي كل نشاط سطر تمايز: (المبتدئة: تكليف أبسط · المتقدمة: تحدٍّ أعلى).",
    "- إن ورد في المصادر «إثراء الحصة المعتمد» فاجعلي النشاط الجماعي هو ذلك الإثراء نفسه بخطواته — لا تخترعي نشاطاً بديلاً.",
    "- أسندي كل نشاط وسؤال لصفحته من الكتاب إن وردت الصفحات في المصادر (مثال: «الكتاب ص45»).",
    "- الواجب يُسند عبر «نظام قطر للتعليم» مع مهمة قصيرة اختيارية.",
    `- الأسئلة ١٠–١٤ سؤالاً متنوعة الأنواع (${PACK_QUESTION_TYPES.join("، ")}) والمستويات (تذكر/فهم/تطبيق/عليا) والصعوبة:`,
    "  mcq: أربعة خيارات بمفاتيح أ، ب، ج، د والإجابة رمز الخيار الصحيح.",
    "  truefalse: الإجابة «صواب» أو «خطأ» مع التصويب إن كانت خطأ.",
    "  define: «عرّفي: المصطلح.» والإجابة التعريف من المصدر حرفياً.",
    "  order: خطوات في الإجابة مفصولة بـ« ← » (ثلاث خطوات فأكثر).",
    "  fillblank: فراغ واحد بشرطة طويلة والإجابة الكلمة الناقصة.",
    "- كرت الخروج ٢–٣ أسئلة سريعة، والواجب ٢–٣ مهام قصيرة اختيارية.",
    "- ملاحظات المعلّمة: ماذا تقول في اللحظات المفصلية، ٢–٣ أخطاء شائعة متوقعة، وقائمة الأدوات المطلوبة.",
    "- خاطبي الطالبات بصيغة المؤنث، بعربية فصحى مبسطة تناسب عمر ١٠ سنوات.",
    "- روح المواد «رحلة استكشاف»: أنشطة بأسماء مشوقة، أمثلة من بيئة قطر، وصياغة تحفّز عالمات صغيرات — بلا طفولية روضة ولا مساس بمصطلحات الكتاب الحرفية.",
  ].join("\n");
}

export function packUserPrompt(lessonTitle: string, sources: AskSource[]): string {
  return userPrompt(`ابني حزمة الحصة الكاملة لدرس «${lessonTitle}»`, sources);
}

const isStr = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";
const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter(isStr).map((s) => s.trim()) : []);

/** فحص وتطبيع حزمة الحصة — رسالة عربية عند الرفض */
export function validateLessonPack(raw: unknown): { ok: true; pack: LessonPack } | { ok: false; messageAr: string } {
  const p = raw as Partial<LessonPack> | null;
  if (!p || typeof p !== "object") return { ok: false, messageAr: "مخرج المولّد غير مقروء" };

  const objectives = strArr(p.plan?.objectives);
  const stages = (Array.isArray(p.plan?.stages) ? p.plan!.stages : [])
    .filter((st) => isStr(st?.name) && isStr(st?.what) && Number.isFinite(Number(st?.minutes)))
    .map((st) => ({ name: st.name.trim(), minutes: Math.max(1, Math.round(Number(st.minutes))), what: st.what.trim() }));
  if (objectives.length < 2 || stages.length < 3) return { ok: false, messageAr: "خطة الحصة ناقصة الأهداف أو المراحل" };

  if (!isStr(p.opener?.title) || !isStr(p.opener?.text)) return { ok: false, messageAr: "النشاط الافتتاحي ناقص" };
  if (!isStr(p.activityIndividual?.title) || !isStr(p.activityIndividual?.text)) return { ok: false, messageAr: "النشاط الفردي ناقص" };
  if (!isStr(p.activityGroup?.title) || !isStr(p.activityGroup?.text)) return { ok: false, messageAr: "النشاط الجماعي ناقص" };

  const questions: PackQuestion[] = [];
  for (const q of Array.isArray(p.questions) ? p.questions : []) {
    if (!q || !PACK_QUESTION_TYPES.includes(q.type as PackQuestionType) || !isStr(q.text) || !isStr(q.answer)) continue;
    const clean: PackQuestion = {
      type: q.type as PackQuestionType,
      text: q.text.trim(),
      answer: String(q.answer).trim(),
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty as string) ? (q.difficulty as PackQuestion["difficulty"]) : "medium",
      cognitiveLevel: ["remember", "understand", "apply", "higher"].includes(q.cognitiveLevel as string)
        ? (q.cognitiveLevel as PackQuestion["cognitiveLevel"])
        : "understand",
    };
    if (q.type === "mcq") {
      const opts = (Array.isArray(q.options) ? q.options : []).filter((o) => isStr(o?.key) && isStr(o?.text));
      if (opts.length < 3) continue;
      clean.options = opts.map((o) => ({ key: o.key.trim(), text: o.text.trim() }));
    }
    if (q.type === "order" && clean.answer.split("←").filter((x) => x.trim()).length < 3) continue;
    questions.push(clean);
  }
  if (questions.length < 8) return { ok: false, messageAr: `أسئلة صالحة قليلة (${questions.length}) — أعيدي المحاولة` };

  return {
    ok: true,
    pack: {
      plan: { objectives, stages },
      opener: { title: p.opener!.title.trim(), text: p.opener!.text.trim(), minutes: Math.max(1, Math.round(Number(p.opener?.minutes) || 5)) },
      discussion: strArr(p.discussion),
      activityIndividual: { title: p.activityIndividual!.title.trim(), text: p.activityIndividual!.text.trim() },
      activityGroup: { title: p.activityGroup!.title.trim(), text: p.activityGroup!.text.trim() },
      questions,
      exitTicket: { questions: strArr(p.exitTicket?.questions) },
      homework: { tasks: strArr(p.homework?.tasks) },
      teacherNotes: {
        say: isStr(p.teacherNotes?.say) ? p.teacherNotes!.say.trim() : "",
        misconceptions: strArr(p.teacherNotes?.misconceptions),
        materials: strArr(p.teacherNotes?.materials),
      },
      sources: strArr(p.sources),
    },
  };
}


// ═══════════ مرحلة المشرفة (زكريت — «كلود مشرف وGPT عامل») ═══════════

/**
 * تعليمات المشرفة: تراجع مخرج العامل كمشرفة تصميم وتعليم، تصلّح دون
 * إعادة اختراع، وتعيد JSON بنفس العقد تماماً.
 */
export function supervisorSlidesPrompt(): string {
  return [
    "أنتِ مشرفة جودة تعليمية وتصميمية خبيرة (عين مديرة إبداعية).",
    "أمامك مسودة شرائح من معلّم منفّذ — راجعيها وأعيدي JSON بنفس العقد تماماً (مصفوفة شرائح بنفس الحقول) بعد إصلاح:",
    "١) القوس الوزاري وترتيبه إن اختلّ · ٢) الكثافة: لا شريحة فوق ٤٥ كلمة — جزّئي · ٣) عربية سليمة بصيغة مؤنث للطالبات · ٤) مصطلحات المصادر حرفياً · ٥) أضيفي chart حيث توجد أعداد تُفهم بصرياً ولم يضعها · ٦) تنويع layouts بصرياً (٦٠٪ بصري) · ٧) note مكتملة لكل شريحة.",
    "لا تحذفي محتوى صحيحاً ولا تغيّري الحقائق — حسّني الشكل والصياغة والاكتمال فقط.",
    "أخرجي JSON فقط.",
  ].join("\n");
}

export function supervisorPackPrompt(): string {
  return [
    "أنتِ مشرفة جودة تعليمية خبيرة تراجع حزمة حصة أعدّها معلّم منفّذ.",
    "أعيدي JSON بنفس العقد تماماً بعد إصلاح: دقائق الخطة (تهيئة ٥ وغلق ٥ ومجموع ٤٥) · التمايز الثلاثي في النشاطين · صيغة المؤنث · مصطلحات المصادر حرفياً · الالتزام بالإثراء المعتمد إن ورد · جودة الأسئلة وتدرجها.",
    "لا تغيّري الحقائق — حسّني الاكتمال والصياغة فقط. أخرجي JSON فقط.",
  ].join("\n");
}
