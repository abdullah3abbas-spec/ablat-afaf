/**
 * تجميعات التقارير — دوال قابلة للاختبار تغذي بطاقة ولية الأمر
 * وتقرير الإدارة وكشف الدرجات الرسمي.
 */
import { db } from "@/db";
import type { GradeComponent, Student, Term } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { activePolicyOf } from "./policy";
import { gradeLabel, percentOf, termTotal } from "./grades";
import { leafComponents } from "./gradeComponents";
import { cumulativePoints, levelOf, monthKeyOf, monthlyPoints } from "./points";

export interface ComponentScore {
  name: string;
  mark: number | null;
  max: number;
  pct: number | null;
}

export interface StudentReport {
  student: Student;
  className: string;
  components: ComponentScore[];
  total: number;
  outOf: number;
  pct: number;
  label: string;
  attendance: { present: number; absent: number; late: number; excused: number };
  points: { monthly: number; cumulative: number; levelName: string };
  notes: string[];
  recommendations: string[];
}

/** توصيات آلية بصيغة مؤنثة — مشتقة من الأرقام لا عامة (§2-ز روح) */
export function buildRecommendations(input: {
  pct: number | null;
  absent: number;
  late: number;
  weakest?: { name: string; pct: number };
  monthlyPoints: number;
}): string[] {
  const recs: string[] = [];
  if (input.pct !== null) {
    if (input.pct >= 90) recs.push("أداء ممتاز — نقترح إثراءها بمهام قيادية في التجارب والأنشطة");
    else if (input.pct >= 70) recs.push("مستوى جيد — المواظبة على المراجعة المنزلية القصيرة تصعد بها للامتياز");
    else if (input.pct >= 50) recs.push("تحتاج دعماً منتظماً — نوصي بمراجعة يومية قصيرة ومتابعة الواجبات");
    else recs.push("تحتاج خطة دعم عاجلة — نرجو التواصل مع المعلّمة لوضع خطة مشتركة");
  }
  if (input.weakest && input.weakest.pct < 60) {
    recs.push(`أكثر ما يحتاج التركيز: ${input.weakest.name} — نقترح تدريبات إضافية فيه`);
  }
  if (input.absent >= 3) recs.push(`تكرر الغياب (${input.absent} مرات هذا الشهر) — انتظامها يحسّن تحصيلها مباشرة`);
  else if (input.absent === 0 && input.late === 0) recs.push("انتظام كامل في الحضور هذا الشهر — نشكر تعاونكم");
  if (input.monthlyPoints >= 30) recs.push("مشاركة صفية مميزة تستحق الثناء في البيت");
  return recs;
}

/** تقرير طالبة واحدة للفترة الحالية */
export async function studentReport(studentId: number, term: Term): Promise<StudentReport | null> {
  const student = await db.students.get(studentId);
  if (!student) return null;
  const klass = await db.classes.get(student.classId);
  const yearId = klass?.academicYearId ?? 0;
  const policy = await activePolicyOf(yearId);
  const comps = leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([yearId, term]).toArray()
  );
  const grades = (await db.grades.where("studentId").equals(studentId).toArray()).filter(
    (g) => !g.deletedAt && g.term === term
  );

  const components: ComponentScore[] = comps.map((c: GradeComponent) => {
    const live = grades
      .filter((g) => g.gradeComponentId === c.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    const mark = live[0]?.mark ?? null;
    return { name: c.nameAr, mark, max: c.maxMark, pct: mark === null ? null : Math.round((mark / c.maxMark) * 100) };
  });

  const t = termTotal(grades, comps);
  // النسبة على المرصود فقط — عادلة أثناء الفصل قبل اكتمال المكوّنات
  const pct = percentOf(t.total, t.countedOutOf);

  const mk = monthKeyOf(Date.now());
  const att = (await db.attendance.where("studentId").equals(studentId).toArray()).filter(
    (a) => !a.deletedAt && monthKeyOf(a.date) === mk
  );
  const count = (x: string) => att.filter((a) => a.status === x).length;

  const settings = await db.settings.get(1);
  const monthly = await monthlyPoints(studentId, mk);
  const cumulative = await cumulativePoints(studentId);
  const level = levelOf(cumulative, settings?.pointLevels ?? []);

  const notes = (await db.behaviorNotes.where("studentId").equals(studentId).toArray())
    .filter((n) => !n.deletedAt)
    .sort((a, b) => b.date - a.date)
    .slice(0, 3)
    .map((n) => n.text);

  const scored = components.filter((c): c is ComponentScore & { pct: number } => c.pct !== null);
  const weakest = scored.length > 0 ? scored.reduce((min, c) => (c.pct < min.pct ? c : min)) : undefined;

  return {
    student,
    className: klass?.name ?? "",
    components,
    total: t.total,
    outOf: t.outOf,
    pct,
    label: gradeLabel(pct, policy?.gradeScale ?? DEFAULT_GRADE_SCALE),
    attendance: { present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused") },
    points: { monthly, cumulative, levelName: level?.nameAr ?? "" },
    notes,
    recommendations: buildRecommendations({
      pct: t.counted > 0 ? pct : null,
      absent: count("absent"),
      late: count("late"),
      weakest: weakest ? { name: weakest.name, pct: weakest.pct } : undefined,
      monthlyPoints: monthly,
    }),
  };
}

export interface ClassAdminReport {
  className: string;
  studentsCount: number;
  gradedCount: number;
  average: number;
  passRate: number;
  /** توزيع التقديرات بترتيب شرائح السياسة تنازلياً */
  distribution: { label: string; count: number }[];
}

/** تقرير الإدارة لفصل: متوسط، نسبة نجاح، توزيع تقديرات */
export async function classAdminReport(classId: number, term: Term): Promise<ClassAdminReport | null> {
  const klass = await db.classes.get(classId);
  if (!klass) return null;
  const policy = await activePolicyOf(klass.academicYearId);
  const scale = policy?.gradeScale ?? DEFAULT_GRADE_SCALE;
  const passGrade = policy?.passGrade ?? 0;
  const comps = leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([klass.academicYearId, term]).toArray()
  );
  const students = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt);

  const dist = new Map<string, number>([...scale].sort((a, b) => b.min - a.min).map((b) => [b.label, 0]));
  const pcts: number[] = [];
  for (const st of students) {
    const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter(
      (g) => !g.deletedAt && g.term === term
    );
    const t = termTotal(grades, comps);
    if (t.counted === 0) continue;
    const pct = percentOf(t.total, t.countedOutOf);
    pcts.push(pct);
    const label = gradeLabel(pct, scale);
    dist.set(label, (dist.get(label) ?? 0) + 1);
  }

  const average = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
  const passRate = pcts.length ? Math.round((pcts.filter((p) => p >= passGrade).length / pcts.length) * 100) : 0;

  return {
    className: klass.name,
    studentsCount: students.length,
    gradedCount: pcts.length,
    average,
    passRate,
    distribution: Array.from(dist, ([label, count]) => ({ label, count })),
  };
}

/** أعمدة كشف الدرجات الرسمي المتاحة (المفتاح ← الاسم) */
export const OFFICIAL_COLUMNS: { key: string; nameAr: string }[] = [
  { key: "roll", nameAr: "الرقم في الكشف" },
  { key: "name", nameAr: "اسم الطالبة" },
  ...[], // المكوّنات تُدرج ديناميكياً وقت التصدير
  { key: "total", nameAr: "المجموع" },
  { key: "label", nameAr: "التقدير" },
];

/** ترتيب الأعمدة الفعلي: من الإعدادات إن حُدد، وإلا الافتراضي */
export function orderColumns(available: string[], savedOrder?: string[]): string[] {
  if (!savedOrder || savedOrder.length === 0) return available;
  const ordered = savedOrder.filter((k) => available.includes(k));
  const missing = available.filter((k) => !ordered.includes(k));
  return [...ordered, ...missing];
}
