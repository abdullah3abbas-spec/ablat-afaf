import { describe, it, expect } from "vitest";
import { parseCommand, normalizeAr, type CmdContext } from "@/lib/commandBox";

const ctx: CmdContext = {
  units: [
    { id: 1, title: "المادة وتغيّراتها", order: 1 },
    { id: 2, title: "أجهزة جسم الإنسان", order: 2 },
    { id: 3, title: "الطاقة والحركة", order: 3 },
  ],
  lessons: [
    { id: 1, title: "خصائص المادة", unitId: 1 },
    { id: 5, title: "الجهاز الهضمي", unitId: 2 },
    { id: 6, title: "الجهاز التنفسي", unitId: 2 },
  ],
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

  it("«اطبعيلي ورقة عمل على الجهاز الهضمي» → ورقة عمل للدرس", () => {
    const a = parseCommand("اطبعيلي ورقة عمل على الجهاز الهضمي", ctx);
    expect(a.kind).toBe("worksheet");
    if (a.kind === "worksheet") {
      expect(a.lessonId).toBe(5);
      expect(a.topic).toBe("الجهاز الهضمي");
    }
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

  it("«حضّريلي درس الجهاز التنفسي» → تحضير الدرس", () => {
    const a = parseCommand("حضّريلي درس الجهاز التنفسي", ctx);
    expect(a.kind).toBe("lessonPlan");
    if (a.kind === "lessonPlan") expect(a.lessonId).toBe(6);
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
