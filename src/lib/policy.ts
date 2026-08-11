/**
 * إدارة نسخ سياسة التقييم (§4 — القاعدة الحرجة):
 * - لكل عام سياسته المستقلة.
 * - تعديل سياسة عامٍ رُصدت فيه درجات = نسخة جديدة (لا تعديل بمكانه)،
 *   والدرجات القديمة تبقى مرتبطة بمكوّناتها المجسّدة القديمة فلا تفسد.
 * - بعد الحفظ يُعاد تجسيد مكوّنات الفصول المفتوحة من النسخة الجديدة.
 */
import { db } from "@/db";
import type { AssessmentPolicy, Term } from "@/db/schema";

/** السياسة الفعّالة لعام — بالفلترة لا بفهرس منطقي (§ ملاحظة IndexedDB) */
export async function activePolicyOf(academicYearId: number): Promise<AssessmentPolicy | undefined> {
  const all = await db.assessmentPolicy.where("academicYearId").equals(academicYearId).toArray();
  return all.find((p) => p.isActive) ?? all.sort((a, b) => b.version - a.version)[0];
}

export interface PolicyEdit {
  components: AssessmentPolicy["components"];
  termWeights: AssessmentPolicy["termWeights"];
  maxGrade: number;
  passGrade: number;
  gradeScale: NonNullable<AssessmentPolicy["gradeScale"]>;
}

export interface SavePolicyResult {
  /** true = أُنشئت نسخة جديدة (كانت هناك درجات مرصودة) */
  newVersion: boolean;
  policyId: number;
  version: number;
}

/**
 * حفظ تعديل السياسة لعامٍ ما.
 * إن وُجدت درجات حيّة مرتبطة بمكوّنات هذا العام → نسخة جديدة + تعطيل القديمة،
 * وإلا → تعديل بمكانه (لا داعي لتضخيم السجل قبل أي رصد).
 * ثم إعادة تجسيد مكوّنات الفصل المفتوح من النسخة المحفوظة.
 */
export async function savePolicy(
  academicYearId: number,
  edit: PolicyEdit,
  openTerm: Term
): Promise<SavePolicyResult> {
  const current = await activePolicyOf(academicYearId);
  if (!current) throw new Error("لا سياسة لهذا العام");

  const componentIds = (
    await db.gradeComponents.where("academicYearId").equals(academicYearId).toArray()
  ).map((c) => c.id!);
  const hasGrades =
    componentIds.length > 0 &&
    (await db.grades.where("gradeComponentId").anyOf(componentIds).toArray()).some((g) => !g.deletedAt);

  const now = Date.now();
  let policyId: number;
  let version: number;

  if (hasGrades) {
    // نسخة جديدة — القديمة تبقى كما هي بسجلها ومكوّناتها
    version = current.version + 1;
    await db.assessmentPolicy.update(current.id!, { isActive: false, updatedAt: now });
    policyId = await db.assessmentPolicy.add({
      academicYearId,
      version,
      isActive: true,
      components: edit.components,
      termWeights: edit.termWeights,
      maxGrade: edit.maxGrade,
      passGrade: edit.passGrade,
      examTypes: current.examTypes,
      cognitiveDefault: current.cognitiveDefault,
      gradeScale: edit.gradeScale,
      createdAt: now,
    });
  } else {
    version = current.version;
    policyId = current.id!;
    await db.assessmentPolicy.update(policyId, {
      components: edit.components,
      termWeights: edit.termWeights,
      maxGrade: edit.maxGrade,
      passGrade: edit.passGrade,
      gradeScale: edit.gradeScale,
      updatedAt: now,
    });
  }

  await rematerializeTerm(academicYearId, policyId, openTerm);
  await db.academicYears.update(academicYearId, { assessmentPolicyId: policyId, updatedAt: now });
  return { newVersion: hasGrades, policyId, version };
}

/**
 * إعادة تجسيد مكوّنات فصلٍ من سياسة معيّنة:
 * - مكوّن قائم بنفس المفتاح: تُحدَّث بياناته ليتبع النسخة الجديدة
 *   (درجاته المرصودة تبقى معه).
 * - مكوّن جديد: يُنشأ. مكوّن أُلغي: يُحذف إن كان بلا درجات،
 *   ويُترك كما هو إن كانت له درجات (تاريخ لا يُمس).
 */
export async function rematerializeTerm(academicYearId: number, policyId: number, term: Term): Promise<void> {
  const policy = await db.assessmentPolicy.get(policyId);
  if (!policy) return;
  const now = Date.now();

  const existing = await db.gradeComponents
    .where("[academicYearId+term]")
    .equals([academicYearId, term])
    .toArray();
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const wantedKeys = new Set(policy.components.map((c) => c.key));

  for (const pc of policy.components) {
    const found = byKey.get(pc.key);
    if (found) {
      await db.gradeComponents.update(found.id!, {
        nameAr: pc.nameAr,
        maxMark: pc.max,
        parentKey: pc.parentKey,
        order: pc.order,
        policyId,
        updatedAt: now,
      });
    } else {
      await db.gradeComponents.add({
        academicYearId,
        policyId,
        term,
        key: pc.key,
        nameAr: pc.nameAr,
        maxMark: pc.max,
        parentKey: pc.parentKey,
        order: pc.order,
        createdAt: now,
      });
    }
  }

  for (const old of existing) {
    if (!wantedKeys.has(old.key)) {
      const gradeCount = (await db.grades.where("gradeComponentId").equals(old.id!).toArray()).filter(
        (g) => !g.deletedAt
      ).length;
      if (gradeCount === 0) {
        await db.gradeComponents.delete(old.id!);
      }
      // وإلا نتركه — درجاته تاريخ محفوظ
    }
  }
}
