/**
 * اختبار دخان للزرع: ٣ فصول × ٢٥ طالبة، سياسة سليمة المجموع،
 * ومسح البيانات التجريبية لا يترك أثراً.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { clearDemo, db, reseedDemo, seedIfEmpty } from "@/db";
import { validatePolicy } from "@/lib/grades";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("البيانات التجريبية", () => {
  test("٣ فصول و٧٥ طالبة (٢٥ في كل فصل)", async () => {
    expect(await db.classes.count()).toBe(3);
    expect(await db.students.count()).toBe(75);

    for (const klass of await db.classes.toArray()) {
      const count = await db.students.where("classId").equals(klass.id!).count();
      expect(count).toBe(25);
    }
  });

  test("أرقام الكشف 1..25 داخل كل فصل بلا تكرار", async () => {
    for (const klass of await db.classes.toArray()) {
      const rolls = (await db.students.where("classId").equals(klass.id!).toArray())
        .map((s) => s.rollNumber)
        .sort((a, b) => a - b);
      expect(rolls).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    }
  });

  test("كل الأسماء فريدة", async () => {
    const names = (await db.students.toArray()).map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("وحدتان وعشرة دروس ونواتج تعلّم مربوطة", async () => {
    expect(await db.units.count()).toBe(2);
    expect(await db.lessons.count()).toBe(10);
    const lessons = await db.lessons.toArray();
    for (const lesson of lessons) {
      expect(lesson.learningOutcomes?.length).toBeGreaterThan(0);
    }
  });

  test("سياسة التقييم مزروعة كبيانات ومجموعها سليم", async () => {
    const year = await db.academicYears.filter((y) => y.isCurrent).first();
    expect(year).toBeDefined();

    const policy = await db.assessmentPolicy
      .where("academicYearId")
      .equals(year!.id!)
      .first();
    expect(policy).toBeDefined();

    const check = validatePolicy(policy!);
    expect(check.ok).toBe(true);
    expect(check.topSum).toBe(policy!.maxGrade);
    expect(check.weightsSum).toBe(100);
  });

  test("المسح يحذف التجريبي فقط والإعادة تعيده", async () => {
    await clearDemo();
    expect(await db.students.count()).toBe(0);
    expect(await db.classes.count()).toBe(0);
    // صف الإعدادات يبقى (ليس بيانات تجريبية)
    expect(await db.settings.get(1)).toBeDefined();

    await reseedDemo();
    expect(await db.students.count()).toBe(75);
    expect(await db.classes.count()).toBe(3);
  });
});
