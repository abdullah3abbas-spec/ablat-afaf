/**
 * أدوات الصف والمتعة (§ الأمر ٧، §2-ز):
 * عجلة اختيار عادلة (تستبعد الغائبات · لا تكرار حتى تُستوفى القائمة ·
 * سجل مرئي)، تقسيم عشوائي للمجموعات، ومنح الأوسمة.
 * الدوال نقية وتقبل مولّد عشوائية للاختبار الحتمي.
 */
import { db } from "@/db";
import type { Student } from "@/db/schema";
import { seededRandom } from "./examBuilder";
import { monthKeyOf } from "./points";

export interface Pickable {
  id: number;
  name: string;
}

/**
 * الاختيار العادل: يختار اسماً من المرشحات غير الغائبات ولم يُخترن في
 * الجولة الحالية. حين تُستوفى القائمة (اختير الجميع) تبدأ جولة جديدة.
 * يعيد المختارة والقائمة المحدّثة للمختارات — أو null إن لا مرشحات.
 */
export function fairPick(
  candidates: Pickable[],
  absentIds: Set<number>,
  alreadyPicked: number[],
  rnd: () => number = Math.random
): { picked: Pickable; pickedAfter: number[] } | null {
  const eligible = candidates.filter((c) => !absentIds.has(c.id));
  if (eligible.length === 0) return null;

  let picked = alreadyPicked;
  let pool = eligible.filter((c) => !picked.includes(c.id));
  // اكتملت الجولة → ابدئي جولة جديدة
  if (pool.length === 0) {
    picked = [];
    pool = eligible;
  }
  const chosen = pool[Math.floor(rnd() * pool.length)];
  return { picked: chosen, pickedAfter: [...picked, chosen.id] };
}

/**
 * تقسيم عشوائي لمجموعات: إما بعدد المجموعات أو بحجم كل مجموعة.
 * يوزّع الباقي بالتساوي فلا تبقى مجموعة ناقصة أكثر من واحد.
 */
export function makeGroups(
  students: Pickable[],
  spec: { by: "count"; count: number } | { by: "size"; size: number },
  rnd: () => number = Math.random
): Pickable[][] {
  const shuffled = [...students];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const n = shuffled.length;
  const groupCount =
    spec.by === "count" ? Math.max(1, Math.min(spec.count, n)) : Math.max(1, Math.ceil(n / spec.size));
  const groups: Pickable[][] = Array.from({ length: groupCount }, () => []);
  // توزيع دائري يوازن الأحجام
  shuffled.forEach((s, i) => groups[i % groupCount].push(s));
  return groups;
}

/** منح وسام لطالبة (يُضاف إلى earnedBadges — يظهر في ملفها وعلى شهادتها) */
export async function awardBadge(studentId: number, badgeId: number, reason?: string): Promise<void> {
  const student = await db.students.get(studentId);
  if (!student) return;
  const now = Date.now();
  const earned = [...(student.earnedBadges ?? [])];
  // لا نكرر نفس الوسام في نفس الشهر
  const mk = monthKeyOf(now);
  if (earned.some((b) => b.badgeId === badgeId && b.monthKey === mk)) return;
  earned.push({ badgeId, awardedAt: now, reason, monthKey: mk });
  await db.students.update(studentId, { earnedBadges: earned, updatedAt: now });
}

/** سحب وسام (تراجع) */
export async function removeBadge(studentId: number, awardedAt: number): Promise<void> {
  const student = await db.students.get(studentId);
  if (!student) return;
  await db.students.update(studentId, {
    earnedBadges: (student.earnedBadges ?? []).filter((b) => b.awardedAt !== awardedAt),
    updatedAt: Date.now(),
  });
}

/** مولّد عشوائية مبذور — يُعاد تصديره لراحة المستدعي */
export { seededRandom };

/** أسماء طالبات فصلٍ كـPickable (نشطات فقط) */
export async function classPickables(classId: number): Promise<Pickable[]> {
  const list = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt);
  return list.sort((a, b) => a.rollNumber - b.rollNumber).map((s: Student) => ({ id: s.id!, name: s.name }));
}

/** الغائبات اليوم في فصل (لاستبعادهنّ من العجلة) */
export async function absentTodayIds(classId: number, dayMs: number): Promise<Set<number>> {
  const day = new Date(dayMs);
  const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const recs = (await db.attendance.where("[classId+date]").equals([classId, midnight]).toArray()).filter(
    (a) => !a.deletedAt
  );
  return new Set(recs.filter((a) => a.status === "absent" || a.status === "excused").map((a) => a.studentId));
}
