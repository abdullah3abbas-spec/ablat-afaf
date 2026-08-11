/**
 * حسابات الدرجات — دوال نقية تقرأ كل الأرقام من السياسة الممرّرة.
 *
 * ⚠️ قاعدة §4: لا رقم من أرقام سياسة التقييم مكتوب هنا.
 * الأوزان والحدود تأتي دائماً من صف assessmentPolicy في قاعدة البيانات.
 */
import type { AssessmentPolicy } from "@/db/schema";

/**
 * الدرجة النهائية للعام = (فصل١ × وزن١ + فصل٢ × وزن٢) ÷ 100
 * الأوزان من السياسة (الافتراضي القطري 40/60 — لكنه بيانات لا كود).
 */
export function finalYearGrade(
  term1Total: number,
  term2Total: number,
  policy: Pick<AssessmentPolicy, "termWeights">
): number {
  const { term1, term2 } = policy.termWeights;
  return (term1Total * term1 + term2Total * term2) / (term1 + term2);
}

/** هل الدرجة ناجحة؟ حد النجاح من السياسة لا من الكود */
export function isPassing(
  grade: number,
  policy: Pick<AssessmentPolicy, "passGrade">
): boolean {
  return grade >= policy.passGrade;
}

/**
 * التحقق من سلامة السياسة: مجموع المكوّنات الرئيسية = الدرجة العظمى،
 * ومجموع مكوّنات «أعمال الفصل» الفرعية = درجة أبيها.
 * تُستخدم في شاشة «الإعدادات ← سياسة التقييم» لإظهار التحذير الأحمر.
 */
export function validatePolicy(
  policy: Pick<AssessmentPolicy, "components" | "maxGrade" | "termWeights">
): { ok: boolean; topSum: number; parentMismatches: { parentKey: string; expected: number; actual: number }[]; weightsSum: number } {
  const top = policy.components.filter((c) => !c.parentKey);
  const topSum = top.reduce((s, c) => s + c.max, 0);

  const parentMismatches: { parentKey: string; expected: number; actual: number }[] = [];
  for (const parent of top) {
    const children = policy.components.filter((c) => c.parentKey === parent.key);
    if (children.length > 0) {
      const actual = children.reduce((s, c) => s + c.max, 0);
      if (actual !== parent.max) {
        parentMismatches.push({ parentKey: parent.key, expected: parent.max, actual });
      }
    }
  }

  const weightsSum = policy.termWeights.term1 + policy.termWeights.term2;

  return {
    ok: topSum === policy.maxGrade && parentMismatches.length === 0 && weightsSum === 100,
    topSum,
    parentMismatches,
    weightsSum,
  };
}
