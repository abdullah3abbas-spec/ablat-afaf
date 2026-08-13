/**
 * المنهج الحقيقي — تحويل بنية كتاب الوزارة (bookG05S1P1) إلى صفوف
 * وحدات ودروس جاهزة للزرع. دوال نقية تعمل من الزرع الأول ومن ترحيل v10
 * ومن أي جزء كتاب قادم (الجزء الثاني…) بلا تكرار.
 *
 * المنهج الحقيقي ليس بيانات تجريبية (isDemo: false) — ينجو من
 * «مسح البيانات التجريبية»، بعكس الفصول والطالبات.
 */
import { BOOK_UNITS, type BookUnitMeta } from "@/content/bookG05S1P1";
import type { Lesson, Unit } from "./schema";

/** صف وحدة حقيقية من بنية الكتاب */
export function realUnitRow(u: BookUnitMeta, subjectId: number, now: number): Unit {
  return {
    subjectId,
    title: u.title,
    order: u.order,
    standards: [...u.standards],
    objectives: u.outcomes.map((o) => `${o.code} ${o.text}`),
    sessionsCount: u.lessons.reduce((s, l) => s + l.sessions, 0),
    isDemo: false,
    createdAt: now,
  };
}

/** صفوف دروس وحدة حقيقية */
export function realLessonRows(u: BookUnitMeta, unitId: number, subjectId: number, now: number): Lesson[] {
  return u.lessons.map((l, i) => ({
    unitId,
    subjectId,
    title: l.title,
    order: i + 1,
    code: l.code,
    bookPageStart: l.pageStart,
    bookPageEnd: l.pageEnd,
    objectives: [...l.objectives],
    standards: [...l.outcomeCodes],
    learningOutcomes: u.outcomes
      .filter((o) => l.outcomeCodes.includes(o.code))
      .map((o) => ({ code: o.code, text: o.text })),
    sessionsCount: l.sessions,
    isDemo: false,
    createdAt: now,
  }));
}

/** واجهة جداول دنيا — تعمل مع db.units ومع tx.table() في الترحيل */
interface TableLike<T> {
  toArray(): Promise<T[]>;
  add(row: T): Promise<unknown>;
  bulkAdd(rows: T[]): Promise<unknown>;
}

/**
 * ضمان وجود المنهج الحقيقي — آمن التكرار:
 * يضيف الوحدات الناقصة بعنوانها، والدروس الناقصة برمزها داخل وحدتها.
 * حين يصل جزء الكتاب التالي تُضاف وحداته تلقائياً عند أول تشغيل بعد التحديث.
 */
export async function ensureRealCurriculum(
  tables: { units: TableLike<Unit>; lessons: TableLike<Lesson> },
  subjectId: number,
  now: number
): Promise<{ addedUnits: number; addedLessons: number }> {
  const existingUnits = (await tables.units.toArray()).filter(
    (u) => !u.deletedAt && !u.isDemo && u.subjectId === subjectId
  );
  const existingLessons = (await tables.lessons.toArray()).filter((l) => !l.deletedAt && !l.isDemo);
  const unitIdByTitle = new Map(existingUnits.map((u) => [u.title, u.id as number]));
  const lessonCodes = new Set(existingLessons.map((l) => l.code).filter(Boolean));

  let addedUnits = 0;
  let addedLessons = 0;
  for (const bu of BOOK_UNITS) {
    let unitId = unitIdByTitle.get(bu.title);
    if (unitId == null) {
      unitId = (await tables.units.add(realUnitRow(bu, subjectId, now))) as number;
      unitIdByTitle.set(bu.title, unitId);
      addedUnits++;
    }
    const missing = realLessonRows(bu, unitId, subjectId, now).filter((l) => !lessonCodes.has(l.code));
    if (missing.length > 0) {
      await tables.lessons.bulkAdd(missing);
      addedLessons += missing.length;
    }
  }
  return { addedUnits, addedLessons };
}
