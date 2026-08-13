/**
 * اختبارات منطق «وضع الفصل» (زكريت م٤):
 * اختيار أسئلة اللعبة (أولوية الدرس، الإكمال من الوحدة، الحدود)
 * وتنسيق الإجابة بكل أشكالها للعرض على البروجكتور.
 */
import { describe, expect, it } from "vitest";
import type { Question } from "@/db/schema";
import { formatAnswer, pickGameQuestions } from "@/lib/classMode";

/** سؤال مختصر للاختبار */
function q(id: number, unitId: number, lessonId?: number, deletedAt?: number): Question {
  return {
    id,
    unitId,
    lessonId,
    deletedAt,
    text: `سؤال ${id}`,
    type: "define",
    marks: 1,
    difficulty: "medium",
    cognitiveLevel: "understand",
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
  } as Question;
}

/** عشوائية ثابتة للاختبار الحتمي */
const fixedRnd = () => 0.4;

describe("pickGameQuestions — اختيار أسئلة اللعبة", () => {
  it("أسئلة الدرس تتقدّم على أسئلة الوحدة", () => {
    const all = [q(1, 10), q(2, 10, 5), q(3, 10), q(4, 10, 5)];
    const picked = pickGameQuestions(all, { lessonId: 5, unitId: 10, count: 3, rnd: fixedRnd });
    expect(picked).toHaveLength(3);
    // الأولان من الدرس (2 و4) قبل أي سؤال وحدة
    expect(picked.slice(0, 2).every((x) => x.lessonId === 5)).toBe(true);
  });

  it("يكمل من الوحدة عند قلة أسئلة الدرس ويحترم العدد", () => {
    const all = [q(1, 10, 5), q(2, 10), q(3, 10), q(4, 99)];
    const picked = pickGameQuestions(all, { lessonId: 5, unitId: 10, count: 10, rnd: fixedRnd });
    // لا يشمل سؤال الوحدة الأخرى 99
    expect(picked.map((x) => x.id).sort()).toEqual([1, 2, 3]);
  });

  it("يستبعد المحذوف ناعماً ولا يكرر سؤالاً", () => {
    const all = [q(1, 10, 5, 123), q(2, 10, 5), q(3, 10)];
    const picked = pickGameQuestions(all, { lessonId: 5, unitId: 10, count: 10, rnd: fixedRnd });
    expect(picked.map((x) => x.id)).not.toContain(1);
    expect(new Set(picked.map((x) => x.id)).size).toBe(picked.length);
  });
});

describe("formatAnswer — تنسيق الإجابة للعرض", () => {
  it("مفتاح اختيار من متعدد → نص الخيار كاملاً", () => {
    expect(formatAnswer("b", [{ key: "a", text: "التبخر" }, { key: "b", text: "التكاثف" }])).toBe("التكاثف");
  });

  it("نص مباشر يُعرض كما هو", () => {
    expect(formatAnswer("الجاذبية")).toBe("الجاذبية");
  });

  it("قائمة نصوص تُفصل بنقطة وسطى", () => {
    expect(formatAnswer(["صلبة", "سائلة", "غازية"])).toBe("صلبة · سائلة · غازية");
  });

  it("أزواج المطابقة سطراً سطراً بسهم", () => {
    expect(formatAnswer([{ left: "القلب", right: "ضخ الدم" }])).toBe("القلب ← ضخ الدم");
  });

  it("الترتيب مرقّماً", () => {
    expect(formatAnswer({ order: ["تبخر", "تكاثف"] })).toBe("1) تبخر\n2) تكاثف");
  });

  it("غياب الإجابة → شرطة", () => {
    expect(formatAnswer(undefined)).toBe("—");
  });
});
