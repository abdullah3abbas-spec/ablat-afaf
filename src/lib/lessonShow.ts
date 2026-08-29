/**
 * «العرض المساعد» — برزنتيشن الحصة الكامل لكل درس، يُبنى فورياً بلا ذكاء
 * اصطناعي من: بنية الكتاب (أهداف/مفردات/خلاصات «ماذا تعلمت») + إثراء
 * الدرس المقرَّر (قصة/لعبة/بطاقات… تُنسج شرائح تفاعلية) + أسئلة بنك الكتاب.
 *
 * القوس الوزاري: قيمة وقوانين ← مراجعة السابق ← نشاط افتتاحي ← أهداف ←
 * مفردات ← شرح ← الإثراء ← نتحقق (إجابات خلف ضغطة المعلّمة) ← هل حققنا
 * الأهداف؟ ← كرت الخروج والواجب على نظام قطر للتعليم.
 */
import type { Question, VisualSlide } from "@/db/schema";
import { BOOK_UNITS, bookLessonByCode, type BookLessonMeta, type BookUnitMeta } from "@/content/bookG05S1P1";
import { enrichmentByCode, type LessonEnrichment } from "@/content/enrichment";
import { CLASSROOM_RULES, LESSON_VALUES_POOL, MINISTRY_HOMEWORK_CHANNEL } from "@/content/ministryTemplates";
import { formatAnswer, pickGameQuestions } from "./classMode";

/** الدرس السابق في ترتيب الكتاب — لمراجعة «تعلمنا في الدرس السابق» */
export function previousBookLesson(code: string): BookLessonMeta | undefined {
  const flat = BOOK_UNITS.flatMap((u) => u.lessons);
  const i = flat.findIndex((l) => l.code === code);
  return i > 0 ? flat[i - 1] : undefined;
}

/** تقطيع الخلاصات لشرائح شرح ≤ ٣ نقاط */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** شرائح الإثراء — كل وسيلة تُنسج بشكلها الخاص */
function enrichmentSlides(e: LessonEnrichment, lesson: BookLessonMeta): VisualSlide[] {
  const slides: VisualSlide[] = [];
  const minutesNote = `الوسيلة: ${e.vehicle} · ${e.minutes} دقيقة · الأدوات: ${e.materials.join(" · ")}`;

  if (e.story?.length) {
    slides.push({
      layout: "bullets",
      title: `حان وقت الحكاية 📖`,
      bullets: [`«${e.title}»`, "استمعن جيداً — بعد الحكاية أسئلة!"],
      note: { say: `${e.why}\n${minutesNote}` },
      source: "إثراء الحصة",
    });
    e.story.forEach((paragraph, i) => {
      slides.push({
        layout: "bullets",
        title: `الحكاية (${i + 1} من ${e.story!.length})`,
        bullets: [paragraph],
        note: { say: e.steps[Math.min(i, e.steps.length - 1)] ?? "تابعي القراءة بصوت مسرحي." },
        source: "إثراء الحصة",
      });
    });
    slides.push({
      layout: "interaction",
      title: "ماذا فهمنا من الحكاية؟",
      interaction: {
        kind: "question",
        prompt: e.debrief[0],
        answer: lesson.takeaways[0] ?? e.debrief[0],
      },
      note: { say: "اسألي، واتركي النقاش يكتمل قبل كشف الإجابة.", ask: e.debrief[1] },
      source: "إثراء الحصة",
    });
  } else {
    slides.push({
      layout: "steps",
      title: `${e.vehicle}: ${e.title}`,
      steps: { steps: e.steps.slice(0, 6) },
      note: { say: `${e.why}\n${minutesNote}`, ask: e.debrief[0] },
      source: "إثراء الحصة",
      action: e.vehicle === "لعبة" ? { label: "افتحيها لعبةً في وضع الفصل 🎮", to: "/class" } : undefined,
    });
    if (e.cards?.length) {
      slides.push({
        layout: "bullets",
        title: e.vehicle === "كروت" ? "بطاقاتنا اليوم" : "بطاقات النشاط",
        bullets: [...e.cards.slice(0, 5), ...(e.cards.length > 5 ? ["…وبقية البطاقات مطبوعة معكن"] : [])],
        note: { say: "البطاقات نفسها مطبوعة من صفحة الدرس — هذه للعرض والتذكير.", ask: e.debrief[1] ?? e.debrief[0] },
        source: "إثراء الحصة",
      });
    }
  }
  return slides;
}

export interface LessonShow {
  title: string;
  slides: VisualSlide[];
}

/**
 * بناء العرض المساعد الكامل لدرس — حتمي وقابل للاختبار:
 * bankQuestions أسئلة الدرس من البنك (تُختار منها أسئلة التحقق)،
 * وrnd قابل للحقن لثبات الاختيار في الاختبارات.
 */
export function buildLessonShow(
  lessonCode: string,
  bankQuestions: Question[],
  opts?: { rnd?: () => number }
): LessonShow | undefined {
  const found = bookLessonByCode(lessonCode);
  if (!found) return undefined;
  const { unit, lesson } = found as { unit: BookUnitMeta; lesson: BookLessonMeta };
  const enrichment = enrichmentByCode(lessonCode);
  const prev = previousBookLesson(lessonCode);
  const flatIndex = BOOK_UNITS.flatMap((u) => u.lessons).findIndex((l) => l.code === lessonCode);
  const value = LESSON_VALUES_POOL[flatIndex % LESSON_VALUES_POOL.length];
  const pagesLabel = `الكتاب ص${lesson.pageStart}–${lesson.pageEnd}`;

  const slides: VisualSlide[] = [];

  // ١) الغلاف
  slides.push({
    layout: "cover",
    title: lesson.title,
    bullets: [`${unit.title} · الدرس ${lesson.code}`, pagesLabel],
    // رسمة الدرس المولّدة (أصل محلي) — الغلاف يعرضها بإطار بولارويد
    image: { prompt: lesson.title, dataUrl: `/lesson-art/${lessonCode.replace(".", "-")}.jpg` },
    note: { say: `رحّبي بالطالبات. حصة اليوم: «${lesson.title}» — ${pagesLabel}.` },
    source: pagesLabel,
  });

  // ٢) قيمة اليوم وقوانيننا
  slides.push({
    layout: "bullets",
    title: "قيمة اليوم وقوانيننا",
    bullets: [`قيمتنا اليوم: ${value} ⭐`, ...CLASSROOM_RULES.slice(0, 3)],
    note: { say: "ذكّري بالقيمة واربطيها بسلوك الحصة، ثم راجعي القوانين سريعاً." },
  });

  // ٣) تعلمنا في الدرس السابق
  if (prev) {
    const reviewPoints = (prev.takeaways.length > 0 ? prev.takeaways : prev.objectives).slice(0, 3);
    slides.push({
      layout: "bullets",
      title: "تعلمنا في الدرس السابق",
      bullets: reviewPoints,
      note: { say: `مراجعة سريعة لدرس «${prev.title}» — اسألي قبل أن تعرضي.`, ask: `من تذكّرنا بما تعلمناه في «${prev.title}»؟` },
      source: `الكتاب ص${prev.pageStart}–${prev.pageEnd}`,
    });
  }

  // ٤) النشاط الافتتاحي — توقّع يثير الفضول
  slides.push({
    layout: "interaction",
    title: "نشاط افتتاحي",
    interaction: {
      kind: "predict",
      prompt: `افتحن الكتاب صفحة ${lesson.pageStart} ونفّذن النشاط الافتتاحي — ثم توقّعن: ${lesson.title}`,
      answer: lesson.takeaways[0] ?? lesson.objectives[0],
    },
    note: { say: "خذي توقعات ٣–٤ طالبات على السبورة قبل الكشف — لا تصحّحي الآن.", misconception: "التوقع الخاطئ ليس خطأً — هو بداية الاستقصاء." },
    source: `الكتاب ص${lesson.pageStart}`,
  });

  // ٥) الأهداف
  slides.push({
    layout: "objectives",
    title: "أهداف حصتنا",
    bullets: lesson.objectives,
    note: { say: "اقرئي الأهداف بصيغة «سوف أستطيع أن…» واطلبي ترديدها." },
    source: pagesLabel,
  });

  // ٦) المفردات
  if (lesson.vocab.length > 0) {
    slides.push({
      layout: "labeled",
      title: "مفردات أتعلمها",
      labeled: { center: "مفردات الدرس", labels: lesson.vocab.map((v) => `${v.term} (${v.en})`) },
      note: { say: "انطقي كل مصطلح واطلبي ترديده — المقابل الإنجليزي للاطلاع فقط." },
      source: pagesLabel,
    });
  }

  // ٧) الشرح — خلاصات الكتاب على دفعات ≤ ٣
  const groups = chunk(lesson.takeaways.length > 0 ? lesson.takeaways : lesson.objectives, 3);
  groups.forEach((g, i) => {
    slides.push({
      layout: "bullets",
      title: groups.length > 1 ? `نفهم معاً (${i + 1} من ${groups.length})` : "نفهم معاً",
      bullets: g,
      note: { say: "اشرحي كل نقطة بمثال من بيئة الطالبات، واسألي قبل أن تجيبي." },
      source: pagesLabel,
    });
  });

  // ٨) الإثراء — قلب الحصة
  if (enrichment) slides.push(...enrichmentSlides(enrichment, lesson));

  // ٩) نتحقق مما تعلمنا — من بنك أسئلة الكتاب، الإجابة خلف ضغطة
  const checks = pickGameQuestions(bankQuestions, { lessonId: bankQuestions[0]?.lessonId, count: 3, rnd: opts?.rnd });
  checks.forEach((q, i) => {
    const optionsLine = q.options?.length ? ` ${q.options.map((o) => `${o.key}) ${o.text}`).join(" · ")}` : "";
    const page = (q.tags ?? []).find((t) => t.startsWith("ص"));
    slides.push({
      layout: "interaction",
      title: `نتحقق مما تعلمنا (${i + 1} من ${checks.length})`,
      interaction: { kind: "question", prompt: `${q.text}${optionsLine}`, answer: formatAnswer(q.answerKey, q.options) },
      note: { say: "امنحيهن وقت تفكير، واطلبي التعليل قبل كشف الإجابة." },
      source: page ? `الكتاب ${page}` : pagesLabel,
    });
  });

  // ١٠) هل حققنا أهدافنا؟
  slides.push({
    layout: "bullets",
    title: "هل حققنا أهدافنا؟ 🎯",
    bullets: lesson.objectives.map((o) => `✓ ${o}`),
    note: { say: "عودي للأهداف هدفاً هدفاً — ارفعن الإبهام لما تحقق." },
  });

  // ١١) كرت الخروج والواجب
  slides.push({
    layout: "bullets",
    title: "قبل أن نفترق",
    bullets: [
      `كرت الخروج: ${enrichment?.debrief[enrichment.debrief.length - 1] ?? "اكتبي أهم ما تعلمتِ اليوم في سطر."}`,
      `الواجب: ${MINISTRY_HOMEWORK_CHANNEL}`,
    ],
    note: { say: "وزّعي كروت الخروج — دقيقتان فقط، وتُجمع عند الباب." },
  });

  return { title: `العرض المساعد — ${lesson.title}`, slides };
}
