/**
 * اختبارات منطق بوابة الذكاء الاصطناعي النقي (زكريت م٢):
 * اختيار المزوّد، تقدير التكلفة، عتبات التنبيه، مفتاح اليوم، وفحص الطلب.
 * أخطاء الميزانية هنا تعني مالاً حقيقياً — لا تساهل.
 */
import { describe, expect, it } from "vitest";
import {
  alertLevel,
  dohaDayKey,
  estimateCostUsd,
  pickProviders,
  systemPrompt,
  userPrompt,
  validateAsk,
} from "../../gateway/src/logic";

describe("pickProviders — الترتيب والاستبعاد", () => {
  it("Gemini أولاً ثم OpenAI عند جاهزية الاثنين", () => {
    expect(
      pickProviders({ geminiReady: true, openaiReady: true, geminiExhausted: false, openaiExhausted: false })
    ).toEqual(["gemini", "openai"]);
  });

  it("يستبعد مزوّداً بلا مفتاح", () => {
    expect(
      pickProviders({ geminiReady: false, openaiReady: true, geminiExhausted: false, openaiExhausted: false })
    ).toEqual(["openai"]);
  });

  it("يستبعد مزوّداً استُنفدت ميزانيته", () => {
    expect(
      pickProviders({ geminiReady: true, openaiReady: true, geminiExhausted: true, openaiExhausted: false })
    ).toEqual(["openai"]);
  });

  it("قائمة فارغة إن لم يبق مزوّد", () => {
    expect(
      pickProviders({ geminiReady: false, openaiReady: true, geminiExhausted: false, openaiExhausted: true })
    ).toEqual([]);
  });
});

describe("estimateCostUsd — تقدير التكلفة", () => {
  it("يحسب الإدخال والإخراج بأسعار المليون", () => {
    // مليون إدخال بـ0.30 + نصف مليون إخراج بـ2.50 = 0.30 + 1.25
    expect(estimateCostUsd(1_000_000, 500_000, { inPerM: 0.3, outPerM: 2.5 })).toBeCloseTo(1.55, 6);
  });

  it("صفر Tokens = صفر تكلفة", () => {
    expect(estimateCostUsd(0, 0, { inPerM: 0.3, outPerM: 2.5 })).toBe(0);
  });
});

describe("alertLevel — عتبات 60/80/95/100", () => {
  it("يعيد المستويات عند الحدود بالضبط", () => {
    expect(alertLevel(0, 50)).toBe(0);
    expect(alertLevel(29.9, 50)).toBe(0); // 59.8%
    expect(alertLevel(30, 50)).toBe(60); // 60%
    expect(alertLevel(40, 50)).toBe(80);
    expect(alertLevel(47.5, 50)).toBe(95);
    expect(alertLevel(50, 50)).toBe(100);
    expect(alertLevel(60, 50)).toBe(100);
  });

  it("ميزانية صفرية = نفاد دائم", () => {
    expect(alertLevel(0, 0)).toBe(100);
  });
});

describe("dohaDayKey — يوم الدوحة (UTC+3)", () => {
  it("ما قبل منتصف ليل الدوحة بعقيدة UTC يبقى في يوم الدوحة الجديد", () => {
    // 2026-08-13T22:30Z = 2026-08-14 01:30 بتوقيت الدوحة
    expect(dohaDayKey(Date.UTC(2026, 7, 13, 22, 30))).toBe("2026-08-14");
    // 2026-08-13T20:00Z = 2026-08-13 23:00 بتوقيت الدوحة
    expect(dohaDayKey(Date.UTC(2026, 7, 13, 20, 0))).toBe("2026-08-13");
  });
});

describe("validateAsk — فحص الطلب", () => {
  const src = [{ name: "درس", text: "نص المصدر" }];

  it("يقبل طلباً سليماً", () => {
    expect(validateAsk("ما دورة الماء؟", src)).toBeNull();
  });

  it("يرفض سؤالاً فارغاً ومصادر غائبة", () => {
    expect(validateAsk("", src)).toBeTruthy();
    expect(validateAsk("سؤال", [])).toBeTruthy();
    expect(validateAsk("سؤال", undefined)).toBeTruthy();
  });

  it("يرفض تجاوز حدود الحجم", () => {
    expect(validateAsk("س".repeat(5000), src)).toBeTruthy();
    expect(validateAsk("سؤال", [{ name: "كبير", text: "ن".repeat(200_000) }])).toBeTruthy();
  });
});

describe("الموجّهات — الالتزام بالمصادر والتأنيث", () => {
  it("تعليمات النظام تلزم بالمصادر وتذكر عبارة عدم الوجود الحرفية", () => {
    const sys = systemPrompt("brief");
    expect(sys).toContain("المصادر");
    expect(sys).toContain("هذه المعلومة غير موجودة في المصادر المرفوعة");
    expect(sys).toContain("بصيغة المؤنث");
  });

  it("نص المستخدم يرقّم المصادر ويحمل المواضع", () => {
    const usr = userPrompt("سؤال؟", [{ name: "كتاب العلوم", text: "التبخر تحول الماء لبخار", locator: "الصفحة ١٢" }]);
    expect(usr).toContain("مصدر 1: كتاب العلوم — الصفحة ١٢");
    expect(usr).toContain("التبخر");
  });
});
