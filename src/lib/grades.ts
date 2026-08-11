/**
 * حسابات الدرجات — دوال نقية تقرأ كل الأرقام من السياسة الممرّرة.
 *
 * ⚠️ قاعدة §4: لا رقم من أرقام سياسة التقييم مكتوب هنا.
 * الأوزان والحدود تأتي دائماً من صف assessmentPolicy في قاعدة البيانات.
 */
import type { AssessmentPolicy, Grade, GradeComponent, GradeScaleBand } from "@/db/schema";

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
 * مجموع درجات فصلٍ لطالبة: آخر درجة حيّة لكل مكوّن ورقي.
 * المكوّن بلا درجة مرصودة لا يدخل المجموع (لا يُعد صفراً).
 */
export function termTotal(grades: Grade[], leafComponents: GradeComponent[]): {
  total: number;
  /** كم مكوّناً رُصد من أصل الورقية */
  counted: number;
  outOf: number;
} {
  let total = 0;
  let counted = 0;
  let outOf = 0;
  for (const comp of leafComponents) {
    outOf += comp.maxMark;
    const live = grades
      .filter((g) => !g.deletedAt && g.gradeComponentId === comp.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (live.length > 0) {
      total += live[0].mark;
      counted++;
    }
  }
  return { total, counted, outOf };
}

/** النسبة المئوية من درجة عظمى معطاة — تُقرَّب لمنزلة واحدة */
export function percentOf(total: number, outOf: number): number {
  if (outOf <= 0) return 0;
  return Math.round((total / outOf) * 1000) / 10;
}

/**
 * التقدير من شرائح السياسة (بيانات §4): أعلى شريحة يبلغ الحد الأدنى لها.
 * الشرائح قد تصل بأي ترتيب — نرتبها تنازلياً هنا.
 */
export function gradeLabel(percent: number, scale: GradeScaleBand[]): string {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const band of sorted) {
    if (percent >= band.min) return band.label;
  }
  return sorted[sorted.length - 1]?.label ?? "";
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
