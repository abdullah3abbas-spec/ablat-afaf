/**
 * اختبارات الأمر ٦: التوزيع الزمني (متقدّم/متأخّر، حصص متبقية،
 * الدرس التالي) والبحث الشامل (بلا أسماء طالبات).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import type { AcademicYear, Lesson, Unit } from "@/db/schema";
import { isTeachingDay, nextLesson, pacingStatus, remainingInUnit, sessionsBetween } from "@/lib/pacing";
import { universalSearch } from "@/lib/search";

beforeAll(async () => {
  await seedIfEmpty();
});

const year = (over?: Partial<AcademicYear>): AcademicYear =>
  ({
    name: "2026/2027",
    isCurrent: true,
    isArchived: false,
    teachingDays: [0, 1, 2, 3, 4], // أحد–خميس
    weeklySessions: 5,
    createdAt: 0,
    ...over,
  }) as AcademicYear;

describe("أيام الدراسة والحصص بين تاريخين", () => {
  test("الجمعة والسبت ليسا يومي دراسة، والإجازة تُستثنى", () => {
    const sunday = new Date(2026, 8, 13).getTime();
    const friday = new Date(2026, 8, 18).getTime();
    const saturday = new Date(2026, 8, 19).getTime();
    expect(isTeachingDay(sunday, year())).toBe(true);
    expect(isTeachingDay(friday, year())).toBe(false);
    expect(isTeachingDay(saturday, year())).toBe(false);
    // إجازة يوم الأحد
    expect(isTeachingDay(sunday, year({ holidays: [{ date: sunday, nameAr: "إجازة" }] }))).toBe(false);
  });

  test("عدّ حصص أسبوع كامل (٥ أيام × ٥ حصص أسبوعية ÷ ٥ أيام = ٥)", () => {
    const sun = new Date(2026, 8, 13).getTime();
    const thu = new Date(2026, 8, 17).getTime();
    expect(sessionsBetween(sun, thu, year())).toBe(5);
    // مع إجازة يوم = ٤ أيام دراسة → ٤ حصص
    expect(sessionsBetween(sun, thu, year({ holidays: [{ date: new Date(2026, 8, 15).getTime(), nameAr: "ح" }] }))).toBe(4);
  });
});

describe("حالة التقدّم", () => {
  const mkLesson = (order: number, sessions: number, taught: boolean): Lesson =>
    ({ unitId: 1, subjectId: 1, title: `درس ${order}`, order, sessionsCount: sessions, taughtAt: taught ? 1 : undefined, createdAt: 0 }) as Lesson;

  test("منجز أكثر من المتوقّع = متقدّمة، وأقل = متأخّرة", () => {
    const start = new Date(2026, 8, 13).getTime();
    const twoWeeksLater = new Date(2026, 8, 24).getTime(); // ~أسبوعان دراسيان = ~10 حصص متوقعة
    const lessons = [mkLesson(1, 4, true), mkLesson(2, 4, true), mkLesson(3, 4, true), mkLesson(4, 4, false)];
    // منجز 12 حصة، متوقّع ~10 → متقدّمة
    const ahead = pacingStatus(lessons, year({ startDate: start }), twoWeeksLater);
    expect(ahead.taughtSessions).toBe(12);
    expect(ahead.state).toBe("ahead");

    // منجز صفر → متأخّرة
    const behind = pacingStatus(lessons.map((l) => ({ ...l, taughtAt: undefined })), year({ startDate: start }), twoWeeksLater);
    expect(behind.taughtSessions).toBe(0);
    expect(behind.state).toBe("behind");
  });
});

describe("الوحدة والدرس التالي", () => {
  test("الحصص المتبقية في الوحدة", () => {
    const ls = [
      { sessionsCount: 2, taughtAt: 1 },
      { sessionsCount: 3, taughtAt: undefined },
      { sessionsCount: 2, taughtAt: undefined },
    ] as Lesson[];
    expect(remainingInUnit(ls)).toEqual({ remaining: 5, total: 7 });
  });

  test("الدرس التالي = أول غير منجز بترتيب المنهج", () => {
    const units = [{ id: 1, order: 1 }, { id: 2, order: 2 }] as Unit[];
    const lessons = [
      { id: 10, unitId: 1, order: 1, taughtAt: 1 },
      { id: 11, unitId: 1, order: 2, taughtAt: 1 },
      { id: 12, unitId: 2, order: 1, taughtAt: undefined },
    ] as Lesson[];
    expect(nextLesson(units, lessons)?.id).toBe(12);
  });
});

describe("البحث الشامل", () => {
  test("يجد الدروس والأسئلة، وبتوحيد الهمزات، وبلا أسماء طالبات", async () => {
    const byMix = await universalSearch("الغذائية");
    expect(byMix.some((h) => h.kind === "lesson" && h.title.includes("الغذائية"))).toBe(true);
    expect(byMix.some((h) => h.kind === "question")).toBe(true);

    // توحيد الهمزة والتاء المربوطة: «اكلات الرمم» تطابق «آكلات الرمم»
    const norm = await universalSearch("اكلات الرمم");
    expect(norm.some((h) => h.kind === "lesson" && h.title.includes("آكلات"))).toBe(true);

    // لا يبحث في الطالبات إطلاقاً: اسم طالبة مزروعة لا يظهر كنتيجة
    const student = (await db.students.toCollection().first())!;
    const byName = await universalSearch(student.name);
    expect(byName.every((h) => h.title !== student.name)).toBe(true);

    // استعلام قصير = لا نتائج
    expect(await universalSearch("ا")).toEqual([]);
  });
});
