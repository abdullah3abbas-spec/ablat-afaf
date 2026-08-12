/**
 * التوزيع الزمني (§ الأمر ٦ البند ٣): يربط دروس المنهج بالتقويم
 * الأكاديمي والإجازات، ويُظهر: هل المعلّمة متقدّمة أم متأخّرة؟ وكم
 * حصة بقيت للوحدة؟ — دوال نقية قابلة للاختبار.
 */
import type { AcademicYear, Lesson, Unit } from "@/db/schema";

/** يوم عند منتصف الليل محلياً */
export function midnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** هل اليوم يوم دراسة؟ (ضمن أيام الأسبوع الدراسية وليس إجازة) */
export function isTeachingDay(dayMs: number, year: Pick<AcademicYear, "teachingDays" | "holidays">): boolean {
  const days = year.teachingDays ?? [0, 1, 2, 3, 4]; // أحد–خميس
  const dow = new Date(dayMs).getDay();
  if (!days.includes(dow)) return false;
  const day = midnight(dayMs);
  return !(year.holidays ?? []).some((h) => midnight(h.date) === day);
}

/** عدّ حصص المادة بين تاريخين (شامل الطرفين) */
export function sessionsBetween(
  fromMs: number,
  toMs: number,
  year: Pick<AcademicYear, "teachingDays" | "holidays" | "weeklySessions">
): number {
  if (toMs < fromMs) return 0;
  const weekly = year.weeklySessions ?? 3;
  const teachDays = (year.teachingDays ?? [0, 1, 2, 3, 4]).length || 5;
  // حصص/يوم دراسي = الأسبوعية ÷ أيام الأسبوع الدراسية (تقريب لأعلى للجزء)
  let teachingDaysCount = 0;
  for (let d = midnight(fromMs); d <= midnight(toMs); d += 86400000) {
    if (isTeachingDay(d, year)) teachingDaysCount++;
  }
  return Math.round((teachingDaysCount * weekly) / teachDays);
}

export interface PacingStatus {
  /** إجمالي حصص المنهج المخطط */
  totalSessions: number;
  /** حصص الدروس المنجزة */
  taughtSessions: number;
  /** الحصص التي كان يُفترض إنجازها حتى اليوم بحسب التقويم */
  expectedByNow: number;
  /** موجب = متقدّمة · سالب = متأخّرة (بالحصص) */
  aheadBy: number;
  state: "ahead" | "onTrack" | "behind";
}

/**
 * حالة التقدّم: يقارن الحصص المنجزة فعلاً بالحصص المتوقّعة حتى اليوم
 * (بحسب التقويم من بداية العام). التساوي ±1 = على المسار.
 */
export function pacingStatus(
  lessons: Lesson[],
  year: Pick<AcademicYear, "startDate" | "teachingDays" | "holidays" | "weeklySessions">,
  nowMs: number
): PacingStatus {
  const totalSessions = lessons.reduce((s, l) => s + (l.sessionsCount ?? 1), 0);
  const taughtSessions = lessons.filter((l) => l.taughtAt).reduce((s, l) => s + (l.sessionsCount ?? 1), 0);
  const start = year.startDate ?? nowMs;
  const expectedByNow = Math.min(totalSessions, sessionsBetween(start, nowMs, year));
  const aheadBy = taughtSessions - expectedByNow;
  return {
    totalSessions,
    taughtSessions,
    expectedByNow,
    aheadBy,
    state: aheadBy >= 2 ? "ahead" : aheadBy <= -2 ? "behind" : "onTrack",
  };
}

/** حصص الوحدة المتبقية (غير المنجزة) */
export function remainingInUnit(unitLessons: Lesson[]): { remaining: number; total: number } {
  const total = unitLessons.reduce((s, l) => s + (l.sessionsCount ?? 1), 0);
  const done = unitLessons.filter((l) => l.taughtAt).reduce((s, l) => s + (l.sessionsCount ?? 1), 0);
  return { remaining: total - done, total };
}

/** الدرس التالي المقترح: أول درس غير منجز بترتيب المنهج */
export function nextLesson(units: Unit[], lessons: Lesson[]): Lesson | undefined {
  const orderedUnits = [...units].sort((a, b) => a.order - b.order);
  for (const u of orderedUnits) {
    const ls = lessons.filter((l) => l.unitId === u.id).sort((a, b) => a.order - b.order);
    const next = ls.find((l) => !l.taughtAt);
    if (next) return next;
  }
  return undefined;
}
