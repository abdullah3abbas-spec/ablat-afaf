/**
 * اختبارات «العرض المساعد» — القوس الوزاري، نسج الإثراء حسب وسيلته،
 * أسئلة التحقق بإجابات مكشوفة للمعلّمة فقط، وثبات البناء الحتمي.
 */
import { describe, expect, test } from "vitest";
import type { Question } from "@/db/schema";
import { BOOK_UNITS } from "@/content/bookG05S1P1";
import { enrichmentByCode } from "@/content/enrichment";
import { buildLessonShow, previousBookLesson } from "@/lib/lessonShow";

const rnd = () => 0.42; // حقن ثابت — بناء حتمي في الاختبار

function fakeBank(lessonId: number): Question[] {
  return [
    { unitId: 1, lessonId, text: "ما المصطلح للحيوان الذي يتغذى على النباتات فقط؟", type: "mcq",
      options: [{ key: "أ", text: "آكل العشب" }, { key: "ب", text: "آكل اللحوم" }, { key: "ج", text: "قارت" }],
      answerKey: "أ", marks: 1, difficulty: "easy", cognitiveLevel: "remember", usageCount: 0, tags: ["من-الكتاب", "ص14"], createdAt: 0 },
    { unitId: 1, lessonId, text: "تبدأ السلاسل الغذائية بالنبات.", type: "truefalse", answerKey: "صواب",
      marks: 1, difficulty: "easy", cognitiveLevel: "remember", usageCount: 0, tags: ["من-الكتاب", "ص27"], createdAt: 0 },
    { unitId: 1, lessonId, text: "رتّبي: (عصفور — أوراق النبات — خنفساء)", type: "order",
      answerKey: "أوراق النبات ← خنفساء ← عصفور", marks: 3, difficulty: "medium", cognitiveLevel: "apply", usageCount: 0, tags: ["ص19"], createdAt: 0 },
  ];
}

describe("العرض المساعد", () => {
  test("القوس الوزاري كامل بالترتيب لكل درس من الدروس الـ١٣", () => {
    for (const lesson of BOOK_UNITS.flatMap((u) => u.lessons)) {
      const built = buildLessonShow(lesson.code, fakeBank(9), { rnd })!;
      expect(built).toBeDefined();
      const titles = built.slides.map((s) => s.title);
      expect(built.slides[0].layout).toBe("cover");
      expect(titles[1]).toBe("قيمة اليوم وقوانيننا");
      expect(titles).toContain("نشاط افتتاحي");
      expect(titles).toContain("أهداف حصتنا");
      expect(titles).toContain("هل حققنا أهدافنا؟ 🎯");
      expect(titles[titles.length - 1]).toBe("قبل أن نفترق");
      // الواجب على نظام قطر للتعليم في شريحة الختام
      const last = built.slides[built.slides.length - 1];
      expect(last.bullets?.join(" ")).toContain("نظام قطر للتعليم");
      // كل شريحة لها ملاحظة معلّمة
      for (const sl of built.slides) expect(sl.note.say.length).toBeGreaterThan(5);
      // عدد معقول للحصة
      expect(built.slides.length).toBeGreaterThanOrEqual(10);
      expect(built.slides.length).toBeLessThanOrEqual(22);
    }
  });

  test("درس القصة (1.2): الحكاية تُنسج شرائح متسلسلة بسؤال فهم", () => {
    const built = buildLessonShow("1.2", fakeBank(2), { rnd })!;
    const titles = built.slides.map((s) => s.title);
    expect(titles).toContain("حان وقت الحكاية 📖");
    const storyCount = titles.filter((t) => t.startsWith("الحكاية (")).length;
    expect(storyCount).toBe(enrichmentByCode("1.2")!.story!.length);
    expect(titles).toContain("ماذا فهمنا من الحكاية؟");
  });

  test("درس اللعبة (1.1): شريحة خطوات بزر «افتحيها في وضع الفصل»", () => {
    const built = buildLessonShow("1.1", fakeBank(1), { rnd })!;
    const game = built.slides.find((s) => s.title.includes("سباق التصنيف"));
    expect(game).toBeDefined();
    expect(game!.layout).toBe("steps");
    expect(game!.action?.to).toBe("/class");
    // بطاقات اللعبة تظهر شريحة عرض
    expect(built.slides.some((s) => s.title.includes("بطاقات"))).toBe(true);
  });

  test("أسئلة التحقق من البنك: الخيارات في السؤال والإجابة نص كامل خلف الضغطة", () => {
    const built = buildLessonShow("1.1", fakeBank(1), { rnd })!;
    const checks = built.slides.filter((s) => s.title.startsWith("نتحقق مما تعلمنا"));
    expect(checks.length).toBe(3);
    const mcq = checks.find((s) => s.interaction!.prompt.includes("أ)"))!;
    expect(mcq.interaction!.answer).toBe("آكل العشب"); // نص الخيار لا رمزه
    const order = checks.find((s) => s.interaction!.prompt.includes("رتّبي"))!;
    expect(order.interaction!.answer).toContain("←"); // سلسلة البنك تُعرض كما هي
    // الاستشهاد بصفحة الكتاب من وسم السؤال
    expect(mcq.source).toBe("الكتاب ص14");
  });

  test("مراجعة الدرس السابق: 1.1 بلا مراجعة، و2.1 يراجع مشروع الوحدة الأولى", () => {
    expect(previousBookLesson("1.1")).toBeUndefined();
    expect(previousBookLesson("2.1")!.code).toBe("1.8");
    const first = buildLessonShow("1.1", fakeBank(1), { rnd })!;
    expect(first.slides.map((s) => s.title)).not.toContain("تعلمنا في الدرس السابق");
    const u2 = buildLessonShow("2.1", fakeBank(9), { rnd })!;
    expect(u2.slides.map((s) => s.title)).toContain("تعلمنا في الدرس السابق");
  });

  test("درس بلا رمز كتاب → لا عرض (بلا انهيار)", () => {
    expect(buildLessonShow("9.9", [], { rnd })).toBeUndefined();
  });
});
