/**
 * محلّل الأوامر العربي — قلب «الصندوق الواحد» (§ الأمر ٨-ب أولاً).
 *
 * قاعدة أمنية (§2-هـ): التحليل **محلي بالكامل**. لا يُرسل نصّ الأمر ولا اسم
 * أي طالبة لأي خدمة خارجية. مجرّد مطابقة كلمات عربية على الجهاز.
 *
 * يفهم العامية القطرية/الخليجية ويردّ بإجراء (لا بقائمة نتائج):
 *   «اطبعيلي ورقة عمل على البناء الضوئي» → إجراء ورقة عمل
 *   «جهّزي تقرير نورة لولية أمرها» → إجراء بطاقة ولي الأمر
 *   «كام طالبة ضعيفة في الوحدة التانية؟» → إجابة تحليلية
 *   «اعملي اختبار على الوحدة الأولى» → فتح معالج الاختبار
 */

export interface CmdContext {
  units: { id: number; title: string; order: number }[];
  lessons: { id: number; title: string; unitId: number }[];
  students: { id: number; name: string; classId: number }[];
  classes: { id: number; name: string }[];
}

export type CommandAction =
  | { kind: "worksheet"; unitId?: number; lessonId?: number; topic: string; label: string }
  | { kind: "quiz"; unitId?: number; lessonId?: number; topic: string; label: string }
  | { kind: "exam"; unitIds: number[]; examType: "final" | "mid"; variants: boolean; label: string }
  | { kind: "parentReport"; studentId: number; studentName: string; label: string }
  | { kind: "certificate"; classId?: number; studentId?: number; label: string }
  | { kind: "officialSheet"; classId?: number; label: string }
  | { kind: "lessonPlan"; lessonId?: number; topic: string; label: string }
  | { kind: "weakStudents"; unitId?: number; classId?: number; label: string }
  | { kind: "requests"; label: string }
  | { kind: "visitFile"; classId?: number; label: string }
  | { kind: "unknown"; text: string; suggestions: string[] };

/** تطبيع النص العربي: إزالة التشكيل، توحيد الألف والياء والتاء المربوطة، وحذف التطويل */
export function normalizeAr(input: string): string {
  return input
    .replace(/[ً-ْٰ]/g, "") // تشكيل
    .replace(/ـ/g, "") // تطويل
    .replace(/[?؟!.,،؛:()«»"'\-_]/g, " ") // ترقيم → مسافة
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئء]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** خريطة الأعداد الترتيبية والرقمية العربية → رقم */
const ORDINALS: Record<string, number> = {
  اولي: 1, الاولي: 1, "1": 1, "١": 1, واحد: 1,
  ثانيه: 2, تانيه: 2, الثانيه: 2, التانيه: 2, "2": 2, "٢": 2, اثنين: 2, اتنين: 2,
  ثالثه: 3, تالته: 3, الثالثه: 3, "3": 3, "٣": 3, ثلاثه: 3,
  رابعه: 4, الرابعه: 4, "4": 4, "٤": 4,
  خامسه: 5, الخامسه: 5, "5": 5, "٥": 5,
  سادسه: 6, "6": 6, "٦": 6,
};

/** يستخرج رقم الوحدة المذكور بعد كلمة «الوحدة» */
function unitNumberFrom(norm: string): number | null {
  const m = norm.match(/الوحده\s+(\S+)/);
  if (m && ORDINALS[m[1]] != null) return ORDINALS[m[1]];
  // «الوحده ٢ و ٣» أو «وحده 2»
  const m2 = norm.match(/وحده\s+(\S+)/);
  if (m2 && ORDINALS[m2[1]] != null) return ORDINALS[m2[1]];
  return null;
}

/** كل أرقام الوحدات المذكورة (لـ«الوحدة ٢ و ٣») */
function allUnitNumbers(norm: string): number[] {
  const nums = new Set<number>();
  // من موضع أول ذكر لـ«الوحدة/الوحدات» نمسح كل الأعداد الترتيبية والرقمية التالية
  const idx = norm.search(/الوحدات|الوحده|وحده/);
  if (idx >= 0) {
    for (const tok of norm.slice(idx).split(/\s+/)) {
      if (ORDINALS[tok] != null) nums.add(ORDINALS[tok]);
    }
  }
  return [...nums];
}

/** أطول تطابق عنوان من قائمة (وحدة/درس/فصل) داخل النص المطبّع */
function matchByTitle<T extends { title?: string; name?: string }>(norm: string, list: T[]): T | undefined {
  let best: T | undefined;
  let bestLen = 0;
  for (const item of list) {
    const t = normalizeAr(item.title ?? item.name ?? "");
    if (t.length >= 3 && norm.includes(t) && t.length > bestLen) {
      best = item;
      bestLen = t.length;
    }
  }
  return best;
}

/** يطابق طالبة بالاسم الكامل أو الاسم الأول */
function matchStudent(norm: string, students: CmdContext["students"]): CmdContext["students"][number] | undefined {
  let best: CmdContext["students"][number] | undefined;
  let bestLen = 0;
  for (const st of students) {
    const full = normalizeAr(st.name);
    const first = full.split(" ")[0];
    // نسمح بسوابق عربية ملتصقة قبل الاسم: لـ/و/بـ/كـ («لنورة»، «ونورة»)
    const boundary = (name: string) => new RegExp(`(^|\\s|[لوبك])${name}(\\s|$)`);
    const hit = boundary(full).test(norm) ? full : first.length >= 3 && boundary(first).test(norm) ? first : "";
    if (hit && hit.length > bestLen) {
      best = st;
      bestLen = hit.length;
    }
  }
  return best;
}

const has = (norm: string, ...words: string[]) => words.some((w) => norm.includes(w));

/**
 * يحلّل أمر المعلّمة إلى إجراء. محلي بالكامل.
 */
export function parseCommand(text: string, ctx: CmdContext): CommandAction {
  const norm = normalizeAr(text);
  if (!norm) return { kind: "unknown", text, suggestions: defaultSuggestions() };

  const unit = (() => {
    const n = unitNumberFrom(norm);
    if (n != null) return ctx.units.find((u) => u.order === n);
    return matchByTitle(norm, ctx.units);
  })();
  const lesson = matchByTitle(norm, ctx.lessons);
  const klass = matchByTitle(norm, ctx.classes);
  const student = matchStudent(norm, ctx.students);
  const topic = lesson?.title ?? unit?.title ?? "";

  // ١) سؤال تحليلي: كم طالبة ضعيفة / المتعثّرات
  if (has(norm, "ضعيف", "متعثر", "محتاج") && has(norm, "كام", "كم", "عدد", "مين", "من هن", "من هم")) {
    return {
      kind: "weakStudents",
      unitId: unit?.id,
      classId: klass?.id,
      label: `الطالبات المتعثّرات${unit ? ` في «${unit.title}»` : ""}`,
    };
  }

  // ٢) المطلوب مني / الطلبات
  if (has(norm, "المطلوب مني", "مطلوب مني", "الطلبات", "طلبات علي", "المطلوب هذا الاسبوع", "المطلوب هالاسبوع")) {
    return { kind: "requests", label: "المطلوب منّي" };
  }

  // ٣) ملف الزيارة الصفية
  if (has(norm, "ملف الزياره", "الزياره الصفيه", "زياره صفيه", "ملف زياره")) {
    return { kind: "visitFile", classId: klass?.id, label: "ملف الزيارة الصفية" };
  }

  // ٤) بطاقة ولي الأمر: تقرير + طالبة
  if ((has(norm, "تقرير", "بطاقه", "متابعه") && student) || (student && has(norm, "ولي الامر", "وليه الامر", "لولي", "لوليه", "ولي امر"))) {
    if (student) return { kind: "parentReport", studentId: student.id, studentName: student.name, label: `بطاقة متابعة ${student.name}` };
  }

  // ٥) شهادات
  if (has(norm, "شهاده", "شهادات")) {
    return { kind: "certificate", classId: klass?.id, studentId: student?.id, label: student ? `شهادة ${student.name}` : "شهادات" };
  }

  // ٦) كشف الدرجات الرسمي
  if (has(norm, "كشف", "للنظام", "درجات للنظام", "اكسل")) {
    return { kind: "officialSheet", classId: klass?.id, label: `كشف الدرجات${klass ? ` — ${klass.name}` : ""}` };
  }

  // ٧) خطة تحضير درس
  if (has(norm, "تحضير", "حضري", "حضريلي", "خطه درس", "حضر لي")) {
    return { kind: "lessonPlan", lessonId: lesson?.id, topic, label: `تحضير${topic ? ` «${topic}»` : ""}` };
  }

  // ٨) كويز / تقييم قصير
  if (has(norm, "كويز", "تقييم قصير", "اسئله سريعه", "اسئله سريعه")) {
    return { kind: "quiz", unitId: unit?.id, lessonId: lesson?.id, topic, label: `كويز${topic ? ` «${topic}»` : ""}` };
  }

  // ٩) ورقة عمل / نشاط
  if (has(norm, "ورقه عمل", "ورقه نشاط", "ورقة عمل", "نشاط")) {
    return { kind: "worksheet", unitId: unit?.id, lessonId: lesson?.id, topic, label: `ورقة عمل${topic ? ` «${topic}»` : ""}` };
  }

  // ١٠) اختبار
  if (has(norm, "اختبار", "امتحان")) {
    const units = allUnitNumbers(norm)
      .map((n) => ctx.units.find((u) => u.order === n)?.id)
      .filter((x): x is number => x != null);
    const unitIds = units.length ? units : unit ? [unit.id] : [];
    const examType: "final" | "mid" = has(norm, "منتصف", "نصف") ? "mid" : "final";
    const variants = has(norm, "نسختين", "نسختان", "نسخه ا و ب", "نسخه ب");
    return { kind: "exam", unitIds, examType, variants, label: `اختبار ${examType === "mid" ? "منتصف الفصل" : "نهاية الفصل"}${unitIds.length ? "" : ""}` };
  }

  return { kind: "unknown", text, suggestions: defaultSuggestions() };
}

function defaultSuggestions(): string[] {
  return [
    "اعملي اختبار نهاية الفصل على الوحدة الأولى والثانية",
    "اطبعيلي ورقة عمل على الجهاز الهضمي",
    "جهّزي تقرير نورة لولية أمرها",
    "كم طالبة ضعيفة في الوحدة الثانية؟",
    "جهّزي كشف الدرجات لخامس ١",
    "حضّريلي درس الجهاز التنفسي",
  ];
}
