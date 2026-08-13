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

  test("المنهج الحقيقي: وحدتا الكتاب و١٣ درساً برموزها وصفحاتها ونواتجها الرسمية", async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt);
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
    expect(units.map((u) => u.title).sort()).toEqual(["الدوائر الكهربائية", "السلاسل الغذائية"]);
    expect(lessons.length).toBe(13);
    for (const lesson of lessons) {
      expect(lesson.isDemo).toBe(false);
      expect(lesson.code).toMatch(/^[12]\.\d$/);
      expect(lesson.bookPageStart).toBeGreaterThan(0);
      expect(lesson.bookPageEnd).toBeGreaterThanOrEqual(lesson.bookPageStart!);
      expect(lesson.learningOutcomes?.length).toBeGreaterThan(0);
      for (const o of lesson.learningOutcomes!) {
        expect(o.code).toMatch(/^[BP]05\d\d\.\d$/);
      }
    }
  });

  test("بنك أسئلة الكتاب مبذور ومربوط بالدروس والنواتج", async () => {
    const { BOOK_BANK_COUNT } = await import("@/content/questionBank");
    const bank = await db.questions.filter((q) => !q.deletedAt && (q.tags ?? []).includes("من-الكتاب")).toArray();
    expect(bank.length).toBe(BOOK_BANK_COUNT);
    const lessonIds = new Set((await db.lessons.toArray()).map((l) => l.id));
    for (const q of bank) {
      expect(q.isDemo).toBe(false);
      expect(lessonIds.has(q.lessonId!)).toBe(true);
      expect(q.learningOutcomeCode).toMatch(/^[BP]05\d\d\.\d$/);
      expect((q.tags ?? []).some((t) => t.startsWith("ص"))).toBe(true);
      if (q.type === "mcq") {
        expect(q.options!.length).toBeGreaterThanOrEqual(3);
        expect(q.options!.some((o) => o.key === q.answerKey)).toBe(true);
      }
      if (q.type === "order") {
        expect(String(q.answerKey).split("←").length).toBeGreaterThanOrEqual(3);
      }
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

  test("المسح يحذف التجريبي فقط — والمنهج الحقيقي وبنك الكتاب يبقيان", async () => {
    await clearDemo();
    expect(await db.students.count()).toBe(0);
    expect(await db.classes.count()).toBe(0);
    // صف الإعدادات يبقى (ليس بيانات تجريبية)
    expect(await db.settings.get(1)).toBeDefined();
    // المنهج الحقيقي (كتاب الوزارة) لا يمسّه مسح التجريبي
    expect((await db.units.toArray()).filter((u) => !u.deletedAt).length).toBe(2);
    expect((await db.lessons.toArray()).filter((l) => !l.deletedAt).length).toBe(13);
    expect(await db.questions.filter((q) => !q.deletedAt && (q.tags ?? []).includes("من-الكتاب")).count()).toBeGreaterThan(0);

    await reseedDemo();
    expect(await db.students.count()).toBe(75);
    expect(await db.classes.count()).toBe(3);
    // الإعادة لا تكرّر المنهج الحقيقي (ensureRealCurriculum آمن التكرار)
    expect((await db.units.toArray()).filter((u) => !u.deletedAt).length).toBe(2);
    expect((await db.lessons.toArray()).filter((l) => !l.deletedAt).length).toBe(13);
  });
});
