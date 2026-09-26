/**
 * اختبار تذكيرات «سابقة بخطوة» الموسمية (§2-د): الأحد والخميس
 * وآخر الشهر وأغسطس — دالة نقية على تواريخ معلومة.
 */
import { describe, expect, test } from "vitest";
import { seasonalReminders } from "@/lib/seasonal";

const keys = (t: number) => seasonalReminders(t).map((r) => r.key);

describe("التذكيرات الموسمية", () => {
  test("الأحد: حزمة الأسبوع وقائمة التجهيز", () => {
    // ٢٠ سبتمبر ٢٠٢٦ = أحد
    expect(keys(new Date(2026, 8, 20, 8).getTime())).toContain("sunday");
  });

  test("الخميس: لوحة الشرف", () => {
    // ٢٤ سبتمبر ٢٠٢٦ = خميس
    expect(keys(new Date(2026, 8, 24, 8).getTime())).toContain("thursday");
  });

  test("آخر الشهر: تقارير أولياء الأمور (آخر ثلاثة أيام فقط)", () => {
    expect(keys(new Date(2026, 8, 28, 8).getTime())).toContain("monthEnd");
    expect(keys(new Date(2026, 8, 30, 8).getTime())).toContain("monthEnd");
    expect(keys(new Date(2026, 8, 15, 8).getTime())).not.toContain("monthEnd");
  });

  test("أغسطس: مراجعة سياسة التقييم — وليس في سبتمبر", () => {
    expect(keys(new Date(2026, 7, 10, 8).getTime())).toContain("august");
    expect(keys(new Date(2026, 8, 10, 8).getTime())).not.toContain("august");
  });

  test("يوم عادي منتصف الشهر: لا تذكيرات", () => {
    // ٢٢ سبتمبر ٢٠٢٦ = ثلاثاء
    expect(keys(new Date(2026, 8, 22, 8).getTime())).toEqual([]);
  });

  test("كل التذكيرات بصيغة مؤنثة وبلا وجهات مكسورة", () => {
    const all = [
      ...seasonalReminders(new Date(2026, 7, 2, 8).getTime()), // أحد في أغسطس
      ...seasonalReminders(new Date(2026, 7, 30, 8).getTime()), // آخر أغسطس + أحد
      ...seasonalReminders(new Date(2026, 8, 24, 8).getTime()),
    ];
    for (const r of all) {
      expect(r.message).not.toMatch(/الطلاب|اطبعوا/);
      if (r.to) expect(r.to.startsWith("/")).toBe(true);
    }
  });
});
