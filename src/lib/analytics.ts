/**
 * التحليلات والإنذار المبكر (§ الأمر ٧، §12):
 * تجميعات الرسوم، التنبيهات الأربعة التلقائية، المجموعات العلاجية
 * (بنقطة الضعف المشتركة لا خطة فردية — §2-ز)، والمقارنة السنوية.
 * الدوال نقية على البيانات قدر الإمكان، والحسّاسة منها قابلة للاختبار.
 */
import { db } from "@/db";
import type { Grade, GradeComponent, Student, Term } from "@/db/schema";
import { activePolicyOf } from "./policy";
import { percentOf, termTotal } from "./grades";
import { leafComponents } from "./gradeComponents";
import { monthKeyOf } from "./points";

// ── تنبيهات الإنذار المبكر ────────────────────────────────────

export type AlertKind = "grade_drop" | "absence" | "no_points" | "exam_due";

export interface Alert {
  kind: AlertKind;
  studentId?: number;
  studentName?: string;
  message: string;
  /** الأشد أولوية أعلى */
  severity: 1 | 2 | 3;
}

const DROP_STREAK = 3;
const NO_POINTS_DAYS = 14;
const EXAM_DUE_DAYS = 14;

/**
 * هل هبطت درجات الطالبة ٣ مرات متتالية؟ نقارن النسب المئوية لآخر
 * الدرجات المرصودة (بترتيب زمني) على أي مكوّن.
 */
export function hasGradeDropStreak(grades: Grade[], components: GradeComponent[], streak = DROP_STREAK): boolean {
  const maxOf = new Map(components.map((c) => [c.id!, c.maxMark]));
  const series = grades
    .filter((g) => !g.deletedAt && maxOf.has(g.gradeComponentId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((g) => (g.mark / maxOf.get(g.gradeComponentId)!) * 100);
  if (series.length <= streak) return false;
  let consec = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] < series[i - 1]) {
      consec++;
      if (consec >= streak) return true;
    } else {
      consec = 0;
    }
  }
  return false;
}

/** كل تنبيهات الإنذار المبكر لفصل (أو كل الفصول حين classId=0) */
export async function earlyWarnings(classId: number, nowMs: number): Promise<Alert[]> {
  const settings = await db.settings.get(1);
  const absenceThreshold = settings?.absenceAlertThreshold ?? 4;
  const yearId = settings?.currentAcademicYearId ?? 0;
  const term = (settings?.currentTerm ?? 1) as Term;
  const comps = leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([yearId, term]).toArray()
  );
  const students = (await db.students.toArray()).filter(
    (s) => !s.deletedAt && (classId === 0 || s.classId === classId)
  );
  const mk = monthKeyOf(nowMs);
  const alerts: Alert[] = [];

  for (const st of students) {
    const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter((g) => g.term === term);
    if (hasGradeDropStreak(grades, comps)) {
      alerts.push({ kind: "grade_drop", studentId: st.id, studentName: st.name, message: `${st.name}: نزلت درجاتها ${DROP_STREAK} مرات متتالية — تحتاج متابعة`, severity: 3 });
    }
    const absences = (await db.attendance.where("studentId").equals(st.id!).toArray()).filter(
      (a) => !a.deletedAt && a.status === "absent" && monthKeyOf(a.date) === mk
    ).length;
    if (absences >= absenceThreshold) {
      alerts.push({ kind: "absence", studentId: st.id, studentName: st.name, message: `${st.name}: غابت ${absences} مرات هذا الشهر`, severity: 2 });
    }
    const points = (await db.points.where("studentId").equals(st.id!).toArray()).filter((p) => !p.deletedAt);
    if (points.length > 0) {
      const last = Math.max(...points.map((p) => p.awardedAt));
      if (nowMs - last > NO_POINTS_DAYS * 86400000) {
        alerts.push({ kind: "no_points", studentId: st.id, studentName: st.name, message: `${st.name}: لم تكسب نقاطاً منذ أكثر من أسبوعين`, severity: 1 });
      }
    }
  }

  // اقتراب موعد اختبار مجدول ولم يجهز بعد
  const exams = (await db.exams.toArray()).filter((e) => !e.deletedAt && e.scheduledFor && e.status !== "ready" && e.status !== "administered");
  for (const e of exams) {
    const days = Math.ceil((e.scheduledFor! - nowMs) / 86400000);
    if (days >= 0 && days <= EXAM_DUE_DAYS) {
      alerts.push({ kind: "exam_due", message: `يقترب موعد «${e.title}» (${days} يوم) ولم يجهز بعد`, severity: 2 });
    }
  }

  return alerts.sort((a, b) => b.severity - a.severity);
}

// ── المجموعات العلاجية (§2-ز: مجموعة واحدة لنفس الضعف) ────────

export interface RemedialGroup {
  /** المكوّن/الدرس الذي تشترك فيه الطالبات كنقطة ضعف */
  weaknessKey: string;
  weaknessName: string;
  students: { id: number; name: string; pct: number }[];
  /** نشاط متابعة مقترح واحد للمجموعة */
  suggestedActivity: string;
}

/**
 * تجميع الطالبات المتعثّرات (تحت العتبة) حسب نقطة الضعف المشتركة
 * (المكوّن الذي حصلن فيه على أقل نسبة) — مجموعة واحدة بخطة واحدة.
 */
export async function remedialGroups(classId: number, term: Term, threshold = 60): Promise<RemedialGroup[]> {
  const klass = await db.classes.get(classId);
  if (!klass) return [];
  const comps = leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([klass.academicYearId, term]).toArray()
  );
  const students = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt);

  const byWeakness = new Map<string, { name: string; students: { id: number; name: string; pct: number }[] }>();
  for (const st of students) {
    const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter(
      (g) => !g.deletedAt && g.term === term
    );
    let worst: { comp: GradeComponent; pct: number } | null = null;
    for (const comp of comps) {
      const live = grades.filter((g) => g.gradeComponentId === comp.id).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!live) continue;
      const pct = (live.mark / comp.maxMark) * 100;
      if (!worst || pct < worst.pct) worst = { comp, pct };
    }
    if (worst && worst.pct < threshold) {
      const key = worst.comp.key;
      if (!byWeakness.has(key)) byWeakness.set(key, { name: worst.comp.nameAr, students: [] });
      byWeakness.get(key)!.students.push({ id: st.id!, name: st.name, pct: Math.round(worst.pct) });
    }
  }

  const activityFor = (name: string) =>
    `نشاط متابعة موحّد للمجموعة: مراجعة مركّزة على «${name}» ثم ورقة عمل قصيرة، وإعادة قياس بعد أسبوع.`;

  return Array.from(byWeakness, ([weaknessKey, v]) => ({
    weaknessKey,
    weaknessName: v.name,
    students: v.students.sort((a, b) => a.pct - b.pct),
    suggestedActivity: activityFor(v.name),
  })).sort((a, b) => b.students.length - a.students.length);
}

// ── لوحة الرسوم ───────────────────────────────────────────────

export interface ClassChartData {
  className: string;
  average: number;
}

/** متوسط كل فصل (نسبة مئوية على المرصود) لرسم الأعمدة */
export async function classAverages(term: Term): Promise<ClassChartData[]> {
  const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: ClassChartData[] = [];
  for (const klass of classes) {
    const comps = leafComponents(
      await db.gradeComponents.where("[academicYearId+term]").equals([klass.academicYearId, term]).toArray()
    );
    const students = (await db.students.where("classId").equals(klass.id!).toArray()).filter((s) => !s.deletedAt);
    const pcts: number[] = [];
    for (const st of students) {
      const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter(
        (g) => !g.deletedAt && g.term === term
      );
      const t = termTotal(grades, comps);
      if (t.counted > 0) pcts.push(percentOf(t.total, t.countedOutOf));
    }
    out.push({ className: klass.name, average: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0 });
  }
  return out;
}

/** توزيع المستويات التحفيزية في فصل (لرسم أعمدة أحادي السلسلة) */
export async function levelDistribution(classId: number): Promise<{ level: string; count: number }[]> {
  const settings = await db.settings.get(1);
  const levels = settings?.pointLevels ?? [];
  const { cumulativePoints, levelOf } = await import("./points");
  const students = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt);
  const counts = new Map<string, number>(levels.map((l) => [l.nameAr, 0]));
  for (const st of students) {
    const cum = await cumulativePoints(st.id!);
    const lv = levelOf(cum, levels);
    if (lv) counts.set(lv.nameAr, (counts.get(lv.nameAr) ?? 0) + 1);
  }
  return Array.from(counts, ([level, count]) => ({ level, count }));
}

// ── الأرشيف السنوي والمقارنة ─────────────────────────────────

export interface YearComparison {
  years: { yearName: string; average: number; passRate: number; studentsCount: number }[];
}

/** مقارنة متوسطات الأعوام ونسب النجاح (أرشيف سنوي) */
export async function yearComparison(): Promise<YearComparison> {
  const years = (await db.academicYears.toArray()).sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
  const out: YearComparison["years"] = [];
  for (const y of years) {
    const policy = await activePolicyOf(y.id!);
    const passGrade = policy?.passGrade ?? 50;
    const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt && c.academicYearId === y.id);
    const pcts: number[] = [];
    let studentsCount = 0;
    for (const klass of classes) {
      const comps = leafComponents(
        await db.gradeComponents.where("[academicYearId+term]").equals([y.id!, 1]).toArray()
      );
      const students = (await db.students.where("classId").equals(klass.id!).toArray()).filter((s) => !s.deletedAt);
      studentsCount += students.length;
      for (const st of students) {
        const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter((g) => !g.deletedAt && g.term === 1);
        const t = termTotal(grades, comps);
        if (t.counted > 0) pcts.push(percentOf(t.total, t.countedOutOf));
      }
    }
    out.push({
      yearName: y.name,
      average: pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0,
      passRate: pcts.length ? Math.round((pcts.filter((p) => p >= passGrade).length / pcts.length) * 100) : 0,
      studentsCount,
    });
  }
  return { years: out };
}

export type { Student };
