/**
 * منطق الفصول والطالبات: لصق القوائم، الترقيم التلقائي، الحذف الناعم
 * مع التراجع، النقل بين الفصول، الفرز، وإحصاءات الفصل.
 *
 * كل الحذف هنا ناعم (deletedAt) — لا حذف نهائي إطلاقاً (§2-د).
 */
import { db } from "@/db";
import type { Grade, PointEntry, Student } from "@/db/schema";

// ── لصق قائمة الأسماء ─────────────────────────────────────────

export interface ParsedNameList {
  /** أسماء جديدة ستُنشأ (بترتيب الأسطر، بلا تكرار) */
  names: string[];
  /** عدد الأسطر المكررة داخل اللصق أو الموجودة مسبقاً في الفصل */
  duplicates: number;
}

/**
 * يحلّل نص لصق: كل سطر اسم. ينظّف الفراغات وعلامات الترقيم الزائدة
 * والترقيم اليدوي في أول السطر («1- نورة» → «نورة»)، ويتجاهل
 * الأسطر الفارغة والمكرر (داخل اللصق أو ضد أسماء الفصل الحالية).
 */
export function parseNameList(raw: string, existingNames: string[] = []): ParsedNameList {
  const existing = new Set(existingNames.map((n) => normalizeName(n)));
  const seen = new Set<string>();
  const names: string[] = [];
  let duplicates = 0;

  for (const line of raw.split(/\r?\n/)) {
    // إزالة ترقيم يدوي شائع في أول السطر: «12- » «٣ . » «5) »
    const cleaned = line
      .replace(/^[\s‏‎]*[0-9٠-٩]+[\s]*[-.)،:]*[\s]*/u, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const key = normalizeName(cleaned);
    if (seen.has(key) || existing.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    names.push(cleaned);
  }
  return { names, duplicates };
}

/** توحيد الاسم للمقارنة: إزالة الفراغات الزائدة والتشكيل */
function normalizeName(name: string): string {
  return name
    .replace(/[ً-ٰٟ]/g, "") // التشكيل
    .replace(/\s+/g, " ")
    .trim();
}

// ── الاستعلامات الحيّة (تتجاهل المحذوف ناعماً) ────────────────

export async function activeStudentsOf(classId: number): Promise<Student[]> {
  const all = await db.students.where("classId").equals(classId).toArray();
  return all.filter((s) => !s.deletedAt);
}

/** الرقم التالي في الكشف = أعلى رقم موجود + 1 (يشمل المحذوفات ناعماً كي لا يتكرر رقم) */
export async function nextRollNumber(classId: number): Promise<number> {
  const all = await db.students.where("classId").equals(classId).toArray();
  return all.reduce((m, s) => Math.max(m, s.rollNumber), 0) + 1;
}

// ── الإضافة ───────────────────────────────────────────────────

/** إضافة طالبة واحدة مع ترقيم تلقائي */
export async function addStudent(classId: number, name: string): Promise<number> {
  const roll = await nextRollNumber(classId);
  return db.students.add({
    name: name.trim(),
    rollNumber: roll,
    classId,
    createdAt: Date.now(),
  });
}

/** إنشاء دفعة من الأسماء (لصق قائمة / استيراد Excel) بترقيم متسلسل */
export async function addStudentsBulk(classId: number, names: string[]): Promise<number[]> {
  const start = await nextRollNumber(classId);
  const now = Date.now();
  const rows: Student[] = names.map((name, i) => ({
    name: name.trim(),
    rollNumber: start + i,
    classId,
    createdAt: now,
  }));
  return (await db.students.bulkAdd(rows, { allKeys: true })) as number[];
}

// ── الحذف الناعم والتراجع ─────────────────────────────────────

let batchCounter = Date.now();

/** حذف طالبة واحدة ناعماً — يعيد دالة تراجع */
export async function softDeleteStudent(studentId: number): Promise<() => Promise<void>> {
  await db.students.update(studentId, { deletedAt: Date.now() });
  return async () => {
    await db.students.update(studentId, { deletedAt: undefined });
  };
}

/** حذف فصل ناعماً مع كل طالباته كوحدة واحدة — يعيد دالة تراجع للجميع */
export async function softDeleteClass(classId: number): Promise<() => Promise<void>> {
  const batchId = ++batchCounter;
  const now = Date.now();
  await db.transaction("rw", [db.classes, db.students], async () => {
    await db.classes.update(classId, { deletedAt: now, batchId });
    const ids = (await activeStudentsOf(classId)).map((s) => s.id!);
    for (const id of ids) {
      await db.students.update(id, { deletedAt: now, batchId });
    }
  });
  return async () => {
    await db.transaction("rw", [db.classes, db.students], async () => {
      await db.classes.update(classId, { deletedAt: undefined, batchId: undefined });
      const ids = (await db.students.where("classId").equals(classId).toArray())
        .filter((s) => s.batchId === batchId)
        .map((s) => s.id!);
      for (const id of ids) {
        await db.students.update(id, { deletedAt: undefined, batchId: undefined });
      }
    });
  };
}

// ── النقل بين الفصول ──────────────────────────────────────────

/**
 * نقل طالبة لفصل آخر: البيانات كلها تتبعها (مفتاحها studentId ثابت)،
 * ويُسجَّل النقل في classHistory بتاريخه، ويُمنح رقم كشف جديد في الفصل الهدف.
 */
export async function transferStudent(studentId: number, toClassId: number): Promise<void> {
  const student = await db.students.get(studentId);
  if (!student || student.classId === toClassId) return;
  const newRoll = await nextRollNumber(toClassId);
  const history = [...(student.classHistory ?? [])];
  history.push({ fromClassId: student.classId, toClassId, date: Date.now() });
  await db.students.update(studentId, {
    classId: toClassId,
    rollNumber: newRoll,
    classHistory: history,
    updatedAt: Date.now(),
  });
}

// ── الفرز ─────────────────────────────────────────────────────

export type StudentSortKey = "name" | "roll" | "total" | "points";

export interface StudentWithStats extends Student {
  total: number;
  points: number;
}

/** مقارن الفرز — عربي سليم للأسماء، وتنازلي للمجموع والنقاط */
export function compareStudents(a: StudentWithStats, b: StudentWithStats, key: StudentSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "ar");
    case "roll":
      return a.rollNumber - b.rollNumber;
    case "total":
      return b.total - a.total || a.rollNumber - b.rollNumber;
    case "points":
      return b.points - a.points || a.rollNumber - b.rollNumber;
  }
}

// ── الإحصاءات ─────────────────────────────────────────────────

/** مجموع درجات الطالبة (كل المكوّنات) — يعمل تلقائياً حين تُرصد درجات لاحقاً */
export function sumMarks(grades: Grade[]): number {
  return grades.filter((g) => !g.deletedAt).reduce((s, g) => s + g.mark, 0);
}

/** رصيد نقاط الطالبة التراكمي */
export function sumPoints(points: PointEntry[]): number {
  return points.filter((p) => !p.deletedAt).reduce((s, p) => s + p.delta, 0);
}

/** إحصاءات فصل: عدد الطالبات + المتوسط (undefined إن لا درجات بعد) */
export async function classStats(classId: number): Promise<{ count: number; average?: number }> {
  const students = await activeStudentsOf(classId);
  if (students.length === 0) return { count: 0 };

  const totals: number[] = [];
  for (const st of students) {
    const grades = await db.grades.where("studentId").equals(st.id!).toArray();
    const t = sumMarks(grades);
    if (grades.some((g) => !g.deletedAt)) totals.push(t);
  }
  if (totals.length === 0) return { count: students.length };
  const average = totals.reduce((a, b) => a + b, 0) / totals.length;
  return { count: students.length, average: Math.round(average * 10) / 10 };
}
