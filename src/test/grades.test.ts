/**
 * اختبارات معادلات الدرجات — الأخطاء هنا تصل إلى شهادة طالبة (§8.6).
 * كل الأرقام تُمرَّر كسياسة (بيانات)، لا شيء مثبّت في الدوال.
 */
import { describe, expect, test } from "vitest";
import { finalYearGrade, isPassing, validatePolicy } from "@/lib/grades";
import {
  DEFAULT_MAX_GRADE,
  DEFAULT_POLICY_COMPONENTS,
  DEFAULT_TERM_WEIGHTS,
} from "@/db/constants";

describe("معادلة الدرجة النهائية للعام", () => {
  const policy = { termWeights: DEFAULT_TERM_WEIGHTS };

  test("الوزن الافتراضي 40/60", () => {
    // (80×40 + 90×60) ÷ 100 = 86
    expect(finalYearGrade(80, 90, policy)).toBe(86);
  });

  test("درجتان متساويتان تعطيان النتيجة نفسها", () => {
    expect(finalYearGrade(75, 75, policy)).toBe(75);
  });

  test("الدرجة الكاملة والصفر", () => {
    expect(finalYearGrade(100, 100, policy)).toBe(100);
    expect(finalYearGrade(0, 0, policy)).toBe(0);
  });

  test("تعمل مع أوزان مختلفة — الأرقام بيانات لا كود", () => {
    // لو غيّرت الوزارة الأوزان إلى 50/50
    expect(finalYearGrade(80, 90, { termWeights: { term1: 50, term2: 50 } })).toBe(85);
    // أو 30/70
    expect(finalYearGrade(60, 90, { termWeights: { term1: 30, term2: 70 } })).toBe(81);
  });
});

describe("حد النجاح", () => {
  test("النجاح من حد السياسة لا من الكود", () => {
    expect(isPassing(50, { passGrade: 50 })).toBe(true);
    expect(isPassing(49.5, { passGrade: 50 })).toBe(false);
    // لو رفعت الوزارة حد النجاح إلى 60
    expect(isPassing(55, { passGrade: 60 })).toBe(false);
  });
});

describe("التحقق من سلامة السياسة", () => {
  test("السياسة القطرية الافتراضية سليمة (المجموع = 100)", () => {
    const check = validatePolicy({
      components: DEFAULT_POLICY_COMPONENTS,
      maxGrade: DEFAULT_MAX_GRADE,
      termWeights: DEFAULT_TERM_WEIGHTS,
    });
    expect(check.ok).toBe(true);
    expect(check.topSum).toBe(100);
    expect(check.parentMismatches).toEqual([]);
  });

  test("يكتشف مجموعاً رئيسياً مختلاً", () => {
    const broken = DEFAULT_POLICY_COMPONENTS.map((c) =>
      c.key === "final" ? { ...c, max: 30 } : c
    );
    const check = validatePolicy({
      components: broken,
      maxGrade: DEFAULT_MAX_GRADE,
      termWeights: DEFAULT_TERM_WEIGHTS,
    });
    expect(check.ok).toBe(false);
    expect(check.topSum).toBe(95);
  });

  test("يكتشف اختلال مكوّنات أعمال الفصل الفرعية", () => {
    const broken = DEFAULT_POLICY_COMPONENTS.map((c) =>
      c.key === "homework" ? { ...c, max: 5 } : c
    );
    const check = validatePolicy({
      components: broken,
      maxGrade: DEFAULT_MAX_GRADE,
      termWeights: DEFAULT_TERM_WEIGHTS,
    });
    expect(check.ok).toBe(false);
    expect(check.parentMismatches).toEqual([
      { parentKey: "coursework", expected: 40, actual: 35 },
    ]);
  });

  test("يكتشف أوزان فصلين لا مجموعها 100", () => {
    const check = validatePolicy({
      components: DEFAULT_POLICY_COMPONENTS,
      maxGrade: DEFAULT_MAX_GRADE,
      termWeights: { term1: 40, term2: 50 },
    });
    expect(check.ok).toBe(false);
    expect(check.weightsSum).toBe(90);
  });
});

describe("تحويل الأرقام", () => {
  test("غربية ↔ شرقية", async () => {
    const { toEastern, toWestern, fmtNum } = await import("@/lib/numerals");
    expect(toEastern(123)).toBe("١٢٣");
    expect(toEastern("درجة 95 من 100")).toBe("درجة ٩٥ من ١٠٠");
    expect(toWestern("٧٥")).toBe("75");
    expect(fmtNum(3, "eastern")).toBe("٣");
    expect(fmtNum("٣", "western")).toBe("3");
  });
});
