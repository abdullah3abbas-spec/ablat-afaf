import { describe, it, expect } from "vitest";
import { defaultSuggestions, parseCommand, normalizeAr, type CmdContext } from "@/lib/commandBox";
import { BOOK_UNITS } from "@/content/bookG05S1P1";

// السياق من المنهج الحقيقي المزروع (+ وحدة ثالثة كما قد تضيفها المعلّمة)
let lessonAutoId = 1;
const realLessons = BOOK_UNITS.flatMap((u, ui) =>
  u.lessons.map((l) => ({ id: lessonAutoId++, title: l.title, unitId: ui + 1, code: l.code }))
);
const lessonByCode = (code: string) => realLessons.find((l) => l.code === code)!;
const ctx: CmdContext = {
  units: [
    ...BOOK_UNITS.map((u, ui) => ({ id: ui + 1, title: u.title, order: ui + 1 })),
    { id: 3, title: "وحدة إضافية", order: 3 },
  ],
  lessons: realLessons,
  students: [
    { id: 1, name: "نورة المهندي", classId: 1 },
    { id: 2, name: "سارة الجابر", classId: 1 },
  ],
  classes: [
    { id: 1, name: "خامس ١" },
    { id: 2, name: "خامس ٢" },
  ],
};

describe("normalizeAr", () => {
  it("يوحّد الألف والتاء المربوطة والياء ويزيل التشكيل", () => {
    expect(normalizeAr("الوَحْدَة الثّانِيَة")).toBe("الوحده الثانيه");
    expect(normalizeAr("إختبار")).toBe("اختبار");
  });
});

describe("parseCommand — أمثلة الأمر ٨-ب الإلزامية", () => {
  it("«اعملي اختبار على الوحدة الأولى» → معالج اختبار للوحدة ١", () => {
    const a = parseCommand("اعملي اختبار على الوحدة الأولى", ctx);
    expect(a.kind).toBe("exam");
    if (a.kind === "exam") {
      expect(a.unitIds).toEqual([1]);
      expect(a.examType).toBe("final");
    }
  });

  it("«اعمل اختبار نهاية الفصل للوحدة ٢ و ٣» → اختبار نهائي يشمل الوحدتين ٢ و ٣", () => {
    const a = parseCommand("اعمل اختبار نهاية الفصل للوحدة ٢ و ٣", ctx);
    expect(a.kind).toBe("exam");
    if (a.kind === "exam") {
      expect(a.unitIds).toEqual([2, 3]);
      expect(a.examType).toBe("final");
    }
  });

  it("لا يبتلع رقم الفصل: «اختبار على الوحدة الثانية لخامس ٣» → الوحدة ٢ فقط", () => {
    const a = parseCommand("اعملي اختبار على الوحدة الثانية لخامس ٣", ctx);
    expect(a.kind).toBe("exam");
    if (a.kind === "exam") expect(a.unitIds).toEqual([2]);
  });

  it("«اختبار منتصف الفصل نسختين» → mid + نسختان", () => {
    const a = parseCommand("سوّي اختبار منتصف الفصل على الوحدة الأولى نسختين", ctx);
    expect(a.kind).toBe("exam");
    if (a.kind === "exam") {
      expect(a.examType).toBe("mid");
      expect(a.variants).toBe(true);
    }
  });

  it("«اطبعيلي ورقة عمل على السلاسل الغذائية» → درس الكتاب 1.2 بالكلمات المفتاحية", () => {
    const a = parseCommand("اطبعيلي ورقة عمل على السلاسل الغذائية", ctx);
    expect(a.kind).toBe("worksheet");
    if (a.kind === "worksheet") expect(a.lessonId).toBe(lessonByCode("1.2").id);
  });

  it("«جهّزي تقرير نورة لولية أمرها» → بطاقة متابعة نورة", () => {
    const a = parseCommand("جهّزي تقرير نورة لولية أمرها", ctx);
    expect(a.kind).toBe("parentReport");
    if (a.kind === "parentReport") expect(a.studentId).toBe(1);
  });

  it("«كام طالبة ضعيفة في الوحدة التانية؟» → سؤال تحليلي للوحدة ٢", () => {
    const a = parseCommand("كام طالبة ضعيفة في الوحدة التانية؟", ctx);
    expect(a.kind).toBe("weakStudents");
    if (a.kind === "weakStudents") expect(a.unitId).toBe(2);
  });

  it("«كم طالبة تحتاج دعماً؟» → سؤال تحليلي (صياغة الدليل)", () => {
    expect(parseCommand("كم طالبة تحتاج دعماً في الوحدة الثانية؟", ctx).kind).toBe("weakStudents");
  });

  it("«خطة الدعم والإثراء» ليست سؤالاً تحليلياً (لا كلمة استفهام)", () => {
    expect(parseCommand("جهّزي خطة الدعم والإثراء", ctx).kind).not.toBe("weakStudents");
  });

  it("«إيه المطلوب منّي الأسبوع ده؟» → شاشة الطلبات", () => {
    expect(parseCommand("إيه المطلوب منّي الأسبوع ده؟", ctx).kind).toBe("requests");
  });

  it("«جهّزي كشف الدرجات لخامس ١» → كشف رسمي للفصل", () => {
    const a = parseCommand("جهّزي كشف الدرجات لخامس ١", ctx);
    expect(a.kind).toBe("officialSheet");
    if (a.kind === "officialSheet") expect(a.classId).toBe(1);
  });

  it("«حضّريلي درس الدوائر الكهربائية» → تحضير درس الكتاب 2.1", () => {
    const a = parseCommand("حضّريلي درس الدوائر الكهربائية", ctx);
    expect(a.kind).toBe("lessonPlan");
    if (a.kind === "lessonPlan") expect(a.lessonId).toBe(lessonByCode("2.1").id);
  });

  it("«اطبعي شهادة تفوّق لنورة» → شهادة للطالبة", () => {
    const a = parseCommand("اطبعي شهادة تفوّق لنورة", ctx);
    expect(a.kind).toBe("certificate");
    if (a.kind === "certificate") expect(a.studentId).toBe(1);
  });

  it("«جهّزي ملف الزيارة الصفية» → ملف الزيارة", () => {
    expect(parseCommand("جهّزي ملف الزيارة الصفية لخامس ١", ctx).kind).toBe("visitFile");
  });

  it("أمر غير مفهوم → اقتراحات", () => {
    const a = parseCommand("مرحبا كيف حالك", ctx);
    expect(a.kind).toBe("unknown");
    if (a.kind === "unknown") expect(a.suggestions.length).toBeGreaterThan(0);
  });
});


describe("المطابقة على المنهج الحقيقي — إصلاح أغسطس ٢٠٢٦", () => {
  it("«اعملي كويز على درس السلاسل الغذائية» → كويز بدرس 1.2 (العنوان استفهامي طويل)", () => {
    const a = parseCommand("اعملي كويز على درس السلاسل الغذائية", ctx);
    expect(a.kind).toBe("quiz");
    if (a.kind === "quiz") expect(a.lessonId).toBe(lessonByCode("1.2").id);
  });

  it("«ورقة عمل على المحلّلات» → درس 1.7 عبر مفردات الكتاب", () => {
    const a = parseCommand("اطبعيلي ورقة عمل على المحلّلات", ctx);
    expect(a.kind).toBe("worksheet");
    if (a.kind === "worksheet") expect(a.lessonId).toBe(lessonByCode("1.7").id);
  });

  it("بلا أل التعريف: «ورقة عمل على سلاسل غذائية» تطابق", () => {
    const a = parseCommand("اطبعيلي ورقة عمل على سلاسل غذائية", ctx);
    expect(a.kind).toBe("worksheet");
    if (a.kind === "worksheet") expect(a.lessonId ?? a.unitId).toBeTruthy();
  });

  it("قائمة التوقّف: «مرحبا كيف حالك» تبقى unknown رغم أن «كيف» في عناوين الكتاب", () => {
    expect(parseCommand("مرحبا كيف حالك", ctx).kind).toBe("unknown");
  });

  it("عقد الاقتراحات: كل اقتراح تعيده defaultSuggestions قابل للتنفيذ", () => {
    const sugs = defaultSuggestions(ctx);
    expect(sugs.length).toBeGreaterThanOrEqual(4);
    for (const sug of sugs) {
      const a = parseCommand(sug, ctx);
      expect(a.kind, `اقتراح غير مفهوم: ${sug}`).not.toBe("unknown");
      if (a.kind === "worksheet" || a.kind === "lessonPlan") {
        expect(a.lessonId ?? ("unitId" in a ? a.unitId : undefined), `اقتراح بلا هدف: ${sug}`).toBeTruthy();
      }
      if (a.kind === "exam") expect(a.unitIds.length, `اختبار بلا وحدات: ${sug}`).toBeGreaterThan(0);
      if (a.kind === "parentReport") expect(a.studentId).toBeTruthy();
    }
  });
});
