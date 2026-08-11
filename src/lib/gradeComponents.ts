/**
 * تجسيد مكوّنات الدرجات من سياسة التقييم الفعّالة (§4).
 * الدرجات ترتبط بالنسخ المجسّدة لا بأرقام السياسة — فتعديل
 * السياسة لاحقاً لا يفسد درجات مرصودة.
 */
import { db } from "@/db";
import type { GradeComponent, Term } from "@/db/schema";

/**
 * يضمن وجود مكوّنات مجسّدة لعام+فصل، وينشئها من السياسة الفعّالة
 * إن غابت. يعيد المكوّنات الورقية (بلا الأب «أعمال الفصل» المركّب).
 */
export async function ensureGradeComponents(academicYearId: number, term: Term): Promise<GradeComponent[]> {
  const existing = await db.gradeComponents
    .where("[academicYearId+term]")
    .equals([academicYearId, term])
    .toArray();
  if (existing.length > 0) return leafComponents(existing);

  const policy = await db.assessmentPolicy
    .where("[academicYearId+isActive]")
    .equals([academicYearId, 1])
    .first()
    // بعض المتصفحات لا تفهرس القيم المنطقية — احتياط بالفلترة
    .catch(() => undefined);
  const activePolicy =
    policy ??
    (await db.assessmentPolicy.where("academicYearId").equals(academicYearId).toArray()).find(
      (p) => p.isActive
    );
  if (!activePolicy) return [];

  const now = Date.now();
  const rows: GradeComponent[] = activePolicy.components.map((c) => ({
    academicYearId,
    policyId: activePolicy.id!,
    term,
    key: c.key,
    nameAr: c.nameAr,
    maxMark: c.max,
    parentKey: c.parentKey,
    order: c.order,
    createdAt: now,
  }));
  await db.gradeComponents.bulkAdd(rows);
  return leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([academicYearId, term]).toArray()
  );
}

/** المكوّنات التي تُرصد فيها درجات مباشرة: كل مكوّن ليس أباً لغيره */
export function leafComponents(all: GradeComponent[]): GradeComponent[] {
  const parents = new Set(all.map((c) => c.parentKey).filter(Boolean));
  return all.filter((c) => !parents.has(c.key)).sort((a, b) => a.order - b.order);
}
