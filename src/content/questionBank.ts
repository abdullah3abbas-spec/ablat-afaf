/**
 * بنك الأسئلة الابتدائي — يُولَّد من أسئلة أوراق عمل الحزم المؤلّفة
 * + إضافات مؤلّفة تغطي الأنواع الأحد عشر والمستويات المعرفية.
 * المصطلحات من محتوى الدروس حرفياً (§2-و).
 */
import type { CognitiveLevel, Question, QuestionType } from "@/db/schema";
import type { WsKind } from "./kitTypes";
import { ALL_KITS } from "./lessonKits";

/** تحويل نوع سؤال ورقة العمل إلى نوع بنك */
const KIND_TO_TYPE: Record<WsKind, QuestionType> = {
  define: "define",
  fill: "fillblank",
  truefalse: "truefalse",
  classify: "matching",
  justify: "justify",
  draw: "drawlabel",
};

/** المستوى المعرفي المناسب لكل نوع ورقة عمل */
const KIND_TO_COG: Record<WsKind, CognitiveLevel> = {
  define: "remember",
  fill: "remember",
  truefalse: "understand",
  classify: "understand",
  justify: "apply",
  draw: "apply",
};

const KIND_MARKS: Record<WsKind, number> = {
  define: 2,
  fill: 2,
  truefalse: 1,
  classify: 3,
  justify: 2,
  draw: 3,
};

interface ExtraQ {
  lesson: string;
  type: QuestionType;
  cog: CognitiveLevel;
  marks: number;
  minutes: number;
  text: string;
  options?: { key: string; text: string }[];
  answer: string;
}

/** إضافات مؤلّفة: اختيار من متعدد ورتّبي واقرئي الجدول واستقصاء ومقالي */
const EXTRAS: ExtraQ[] = [
  // ── الوحدة ١ ──
  { lesson: "خصائص المادة", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "وحدة قياس الكتلة هي:", options: [{ key: "أ", text: "اللتر" }, { key: "ب", text: "الكيلوجرام" }, { key: "ج", text: "المتر" }, { key: "د", text: "الدقيقة" }], answer: "ب" },
  { lesson: "خصائص المادة", type: "mcq", cog: "understand", marks: 1, minutes: 1, text: "أي الأدوات نستخدم لقياس حجم سائل؟", options: [{ key: "أ", text: "الميزان" }, { key: "ب", text: "المسطرة" }, { key: "ج", text: "المخبار المدرّج" }, { key: "د", text: "الساعة" }], answer: "ج" },
  { lesson: "حالات المادة الثلاث", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "المادة التي لها شكل ثابت وحجم ثابت هي:", options: [{ key: "أ", text: "الصلبة" }, { key: "ب", text: "السائلة" }, { key: "ج", text: "الغازية" }, { key: "د", text: "البخار" }], answer: "أ" },
  { lesson: "حالات المادة الثلاث", type: "order", cog: "apply", marks: 3, minutes: 3, text: "رتّبي حالات الماء من الأكثر تقارباً في الجزيئات إلى الأكثر تباعداً: (بخار الماء — الثلج — الماء السائل)", answer: "الثلج ← الماء السائل ← بخار الماء" },
  { lesson: "التغيّرات الفيزيائية", type: "mcq", cog: "understand", marks: 1, minutes: 1, text: "أي مما يلي تغيّر فيزيائي؟", options: [{ key: "أ", text: "احتراق الورق" }, { key: "ب", text: "صدأ الحديد" }, { key: "ج", text: "ذوبان الثلج" }, { key: "د", text: "فساد الحليب" }], answer: "ج" },
  { lesson: "التغيّرات الفيزيائية", type: "order", cog: "apply", marks: 3, minutes: 3, text: "رتّبي خطوات استعادة الملح من محلوله: (يتبخر الماء — نسخّن المحلول — يبقى الملح في الإناء)", answer: "نسخّن المحلول ← يتبخر الماء ← يبقى الملح في الإناء" },
  { lesson: "التغيّرات الكيميائية", type: "mcq", cog: "understand", marks: 1, minutes: 1, text: "ظهور فقاعات غاز عند خلط مادتين دليل على:", options: [{ key: "أ", text: "تغيّر فيزيائي" }, { key: "ب", text: "تغيّر كيميائي" }, { key: "ج", text: "انصهار" }, { key: "د", text: "تجمّد" }], answer: "ب" },
  { lesson: "التغيّرات الكيميائية", type: "inquiry", cog: "higher", marks: 4, minutes: 5, text: "تركت سارة مسمارين: الأول في هواء جاف والثاني في ماء. بعد أسبوع صدأ الثاني فقط. صمّمي تفسيراً علمياً لما حدث، واقترحي تجربة تتأكدين بها من دور الماء في الصدأ.", answer: "الماء يسرّع تفاعل الحديد مع الأكسجين (الصدأ) — التجربة: ثلاثة مسامير (جاف/ماء/ماء مغلي مغطى بزيت) والمقارنة بعد أسبوع" },
  { lesson: "المخاليط والمحاليل", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "في محلول السكر والماء، يسمى الماء:", options: [{ key: "أ", text: "المذاب" }, { key: "ب", text: "المذيب" }, { key: "ج", text: "الراسب" }, { key: "د", text: "الراشح" }], answer: "ب" },
  { lesson: "المخاليط والمحاليل", type: "readchart", cog: "apply", marks: 3, minutes: 4, text: "الجدول يبين كتلة الملح الذائبة في 100مل ماء: (20°: 36جم · 40°: 37جم · 60°: 39جم). ماذا تستنتجين عن علاقة الحرارة بالذوبان؟ وكم جراماً يذوب تقريباً عند 50°؟", answer: "كلما ارتفعت الحرارة زادت كمية الملح الذائبة قليلاً — عند 50° تقريباً 38جم" },
  { lesson: "المخاليط والمحاليل", type: "inquiry", cog: "higher", marks: 4, minutes: 5, text: "أعطتك المعلّمة مخلوطاً من الرمل وبرادة الحديد والملح. خطّطي خطوات فصله الثلاث بالترتيب مع تعليل كل خطوة.", answer: "مغناطيس للبرادة (تنجذب وحدها) ← إذابة بالماء ثم ترشيح للرمل (الملح يذوب) ← تبخير لاستعادة الملح" },
  { lesson: "خصائص المادة", type: "shortessay", cog: "higher", marks: 3, minutes: 4, text: "سفينة حديدية ضخمة تطفو بينما مسمار صغير يغوص — فسّري هذه الظاهرة بمفهوم الكثافة.", answer: "شكل السفينة المجوف يجعل كثافتها الكلية (مع الهواء) أقل من الماء فتطفو، بينما كثافة المسمار المصمت أكبر" },
  // ── الوحدة ٢ ──
  { lesson: "الجهاز الهضمي", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "يُمتص معظم الغذاء المهضوم في:", options: [{ key: "أ", text: "المعدة" }, { key: "ب", text: "المريء" }, { key: "ج", text: "الأمعاء الدقيقة" }, { key: "د", text: "الفم" }], answer: "ج" },
  { lesson: "الجهاز الهضمي", type: "order", cog: "remember", marks: 3, minutes: 2, text: "رتّبي مسار الطعام: (المعدة — الفم — الأمعاء الدقيقة — المريء — الأمعاء الغليظة)", answer: "الفم ← المريء ← المعدة ← الأمعاء الدقيقة ← الأمعاء الغليظة" },
  { lesson: "الجهاز التنفسي", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "يحدث تبادل الغازات في:", options: [{ key: "أ", text: "القصبة الهوائية" }, { key: "ب", text: "الحويصلات الهوائية" }, { key: "ج", text: "الأنف" }, { key: "د", text: "الحجاب الحاجز" }], answer: "ب" },
  { lesson: "الجهاز التنفسي", type: "readchart", cog: "apply", marks: 3, minutes: 4, text: "قاست منيرة أنفاسها: جالسة 20 نفساً بالدقيقة، وبعد القفز 45 نفساً، وبعد راحة 5 دقائق 24 نفساً. فسّري هذه الأرقام.", answer: "الحركة تزيد حاجة الجسم للأكسجين فيسرع التنفس، وبعد الراحة يعود قريباً من معدله الطبيعي" },
  { lesson: "الجهاز الدوري", type: "mcq", cog: "remember", marks: 1, minutes: 1, text: "الأوعية التي تنقل الدم من القلب إلى الجسم هي:", options: [{ key: "أ", text: "الأوردة" }, { key: "ب", text: "الشرايين" }, { key: "ج", text: "الشعيرات" }, { key: "د", text: "الحويصلات" }], answer: "ب" },
  { lesson: "الجهاز الدوري", type: "shortessay", cog: "higher", marks: 3, minutes: 4, text: "لماذا يُعد القلب «مضخة لا تتعب»؟ اربطي إجابتك بوظيفته وحاجة خلايا الجسم.", answer: "لأنه عضلة تنقبض وتنبسط باستمرار لضخ الدم حاملاً الأكسجين والغذاء لكل خلية — توقفه يعني انقطاع الإمداد" },
  { lesson: "الجهاز الهيكلي والعضلي", type: "mcq", cog: "understand", marks: 1, minutes: 1, text: "تعمل العضلات على تحريك العظام عن طريق:", options: [{ key: "أ", text: "الانقباض والانبساط" }, { key: "ب", text: "النمو المستمر" }, { key: "ج", text: "إفراز العصارات" }, { key: "د", text: "تبادل الغازات" }], answer: "أ" },
  { lesson: "الجهاز الهيكلي والعضلي", type: "inquiry", cog: "higher", marks: 4, minutes: 5, text: "صمّمي نموذجاً بسيطاً بأدوات من بيئتك يوضح كيف يحرّك زوجا العضلات المفصل، وسمّي ما يمثله كل جزء.", answer: "كرتون=عظمان، مشبك=مفصل، مطاطان متقابلان=زوج العضلات — شد أحدهما مع ارتخاء الآخر يثني ويفرد" },
  { lesson: "الغذاء الصحي والوقاية", type: "mcq", cog: "understand", marks: 1, minutes: 1, text: "المجموعة الغذائية التي تبني العضلات هي:", options: [{ key: "أ", text: "الحلويات" }, { key: "ب", text: "البروتينات" }, { key: "ج", text: "المشروبات الغازية" }, { key: "د", text: "الملح" }], answer: "ب" },
  { lesson: "الغذاء الصحي والوقاية", type: "readchart", cog: "apply", marks: 3, minutes: 4, text: "طبق نورة: نصفه أرز وربعه حلوى وربعه دجاج. قارنيه بالطبق الصحي واقترحي تعديلين.", answer: "الطبق الصحي نصفه خضار وفواكه — التعديل: إحلال خضار محل نصف الأرز، واستبدال الحلوى بفاكهة" },
  { lesson: "الجهاز الهضمي", type: "shortessay", cog: "apply", marks: 3, minutes: 4, text: "اشرحي بلغتك كيف مثّلت تجربة «معدة في كيس» عمل المعدة الحقيقية، وما الذي مثّله عصير الليمون؟", answer: "عصر الكيس مثّل حركة عضلات المعدة في خلط الطعام، والليمون مثّل العصارة الهاضمة الحمضية" },
];

/** بناء صفوف البنك من الحزم + الإضافات — تُربط بالوحدات والدروس عند البذر */
export function buildBankQuestions(
  unitIdByTitle: Map<string, number>,
  lessonByTitle: Map<string, { id: number; unitId: number }>
): Question[] {
  const now = Date.now();
  const rows: Question[] = [];

  for (const kit of ALL_KITS) {
    const lesson = lessonByTitle.get(kit.lessonTitle);
    if (!lesson) continue;
    for (const q of kit.worksheet) {
      rows.push({
        unitId: lesson.unitId,
        lessonId: lesson.id,
        text: q.text,
        type: KIND_TO_TYPE[q.kind],
        answerKey: q.answer,
        marks: KIND_MARKS[q.kind],
        difficulty: q.kind === "justify" || q.kind === "draw" ? "medium" : "easy",
        cognitiveLevel: KIND_TO_COG[q.kind],
        estimatedMinutes: q.kind === "draw" ? 4 : 2,
        usageCount: 0,
        isDemo: true,
        createdAt: now,
      });
    }
  }

  for (const ex of EXTRAS) {
    const lesson = lessonByTitle.get(ex.lesson);
    if (!lesson) continue;
    rows.push({
      unitId: lesson.unitId,
      lessonId: lesson.id,
      text: ex.text,
      type: ex.type,
      options: ex.options,
      answerKey: ex.answer,
      marks: ex.marks,
      difficulty: ex.cog === "higher" ? "hard" : ex.cog === "apply" ? "medium" : "easy",
      cognitiveLevel: ex.cog,
      estimatedMinutes: ex.minutes,
      usageCount: 0,
      isDemo: true,
      createdAt: now,
    });
  }

  void unitIdByTitle;
  return rows;
}
