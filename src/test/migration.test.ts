/**
 * اختبار ترحيل v10 — قاعدة v9 حقيقية الشكل (منهج تجريبي مخترع + سؤال
 * ذكاء معتمد غير تجريبي) تُفتح بالكود الجديد، فنتحقق أن:
 * المنهج التجريبي أُرشف (soft-delete لا حذف §7) · مادة العلوم صارت حقيقية ·
 * منهج الكتاب زُرع · بنك الكتاب بُذر · وغير التجريبي لم يُمسّ.
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeAll, describe, expect, test } from "vitest";

const DB_NAME = "manassat-abla-afaf";

beforeAll(async () => {
  const old = new Dexie(DB_NAME);
  // مخطط v9 المادي للجداول التي يلمسها الترحيل (البقية يعيد Dexie بناءها)
  old.version(9).stores({
    settings: "id",
    academicYears: "++id",
    subjects: "++id",
    units: "++id, subjectId, [subjectId+order], deletedAt",
    lessons: "++id, unitId, subjectId, [unitId+order], deletedAt",
    questions: "++id, unitId, lessonId, deletedAt",
    lessonPacks: "++id, lessonId, status, deletedAt",
  });
  await old.open();
  const now = Date.now();
  const yearId = (await old.table("academicYears").add({ name: "2026/2027", isCurrent: true, isDemo: true, createdAt: now })) as number;
  const subjectId = (await old.table("subjects").add({ nameAr: "العلوم", nameEn: "Science", grade: 5, isDemo: true, createdAt: now })) as number;
  const unitId = (await old.table("units").add({ subjectId, title: "المادة وتغيّراتها", order: 1, isDemo: true, createdAt: now })) as number;
  const lessonId = (await old.table("lessons").add({ unitId, subjectId, title: "التغيّرات الكيميائية", order: 4, isDemo: true, createdAt: now })) as number;
  await old.table("questions").add({ unitId, lessonId, text: "سؤال تجريبي قديم", type: "mcq", marks: 1, difficulty: "easy", cognitiveLevel: "remember", usageCount: 0, isDemo: true, createdAt: now });
  await old.table("questions").add({ unitId, lessonId, text: "سؤال معتمد من حزمة ذكاء", type: "truefalse", marks: 1, difficulty: "easy", cognitiveLevel: "remember", usageCount: 0, tags: ["مولّد-بالذكاء"], createdAt: now });
  await old.table("lessonPacks").add({ lessonId, title: "التغيّرات الكيميائية", status: "approved", content: {}, createdAt: now, updatedAt: now });
  await old.table("settings").put({ id: 1, seeded: true, studentGender: "female", fontScale: 18, numeralsTable: "western", numeralsCert: "eastern", schoolName: "مدرسة الاختبار", currentAcademicYearId: yearId, pointLevels: [], createdAt: now });
  old.close();
});

describe("ترحيل v10 — المنهج الحقيقي يحل محل التجريبي بأمان", () => {
  test("أرشفة التجريبي، زرع الكتاب، بذر البنك، وسلامة غير التجريبي", async () => {
    const { db, seedIfEmpty } = await import("@/db");
    await seedIfEmpty(); // seeded=true → لا زرع تجريبي جديد؛ يبذر بنك الكتاب فقط

    // المادة صارت مرجعاً حقيقياً
    const science = (await db.subjects.toArray()).find((s) => s.nameAr === "العلوم");
    expect(science?.isDemo).toBe(false);

    // الوحدة التجريبية أُرشفت soft-delete (سلة الاسترجاع — لا حذف نهائي)
    const allUnits = await db.units.toArray();
    const demoUnit = allUnits.find((u) => u.title === "المادة وتغيّراتها");
    expect(demoUnit).toBeDefined();
    expect(demoUnit!.deletedAt).toBeGreaterThan(0);

    // منهج الكتاب الحقيقي زُرع كاملاً
    const active = allUnits.filter((u) => !u.deletedAt);
    expect(active.map((u) => u.title).sort()).toEqual(["الدوائر الكهربائية", "السلاسل الغذائية"]);
    const activeLessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
    expect(activeLessons.length).toBe(13);
    expect(activeLessons.every((l) => l.isDemo === false && l.code)).toBe(true);

    // السؤال التجريبي القديم أُرشف — وسؤال الذكاء المعتمد (غير التجريبي) سليم
    const questions = await db.questions.toArray();
    expect(questions.find((q) => q.text === "سؤال تجريبي قديم")!.deletedAt).toBeGreaterThan(0);
    expect(questions.find((q) => q.text === "سؤال معتمد من حزمة ذكاء")!.deletedAt).toBeUndefined();

    // بنك الكتاب بُذر على الدروس الحقيقية
    const { BOOK_BANK_COUNT } = await import("@/content/questionBank");
    const bank = questions.filter((q) => !q.deletedAt && (q.tags ?? []).includes("من-الكتاب"));
    expect(bank.length).toBe(BOOK_BANK_COUNT);

    // حزمة الدرس القديمة باقية في جدولها (يشير درسها المؤرشف — استرجاع ممكن)
    expect(await db.lessonPacks.count()).toBe(1);

    // الإعدادات لم تُمسّ
    expect((await db.settings.get(1))?.schoolName).toBe("مدرسة الاختبار");
  });
});
