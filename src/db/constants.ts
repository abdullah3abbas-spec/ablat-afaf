/**
 * القيم الافتراضية للزرع — بيانات تُكتب في قاعدة البيانات مرة واحدة.
 *
 * ⚠️ هذه ليست «سياسة حيّة»: الكود الذي يحسب الدرجات يقرأ من جدول
 * assessmentPolicy فقط، ولا يستورد هذا الملف أبداً (§4).
 */
import type { CognitiveLevel, ExamTypeDef, PointLevel, PolicyComponent } from "./schema";

/** مكوّنات سياسة التقييم القطرية الشائعة (لكل فصل من 100) */
export const DEFAULT_POLICY_COMPONENTS: PolicyComponent[] = [
  { key: "mid", nameAr: "اختبار منتصف الفصل", max: 25, order: 1 },
  { key: "coursework", nameAr: "أعمال الفصل", max: 40, order: 2 },
  { key: "short", nameAr: "التقييمات القصيرة", max: 15, parentKey: "coursework", order: 3 },
  { key: "participation", nameAr: "المشاركة الصفية", max: 15, parentKey: "coursework", order: 4 },
  { key: "homework", nameAr: "الواجبات", max: 10, parentKey: "coursework", order: 5 },
  { key: "final", nameAr: "اختبار نهاية الفصل", max: 35, order: 6 },
];

/** وزنا الفصلين الدراسيين */
export const DEFAULT_TERM_WEIGHTS = { term1: 40, term2: 60 };

export const DEFAULT_MAX_GRADE = 100;
export const DEFAULT_PASS_GRADE = 50;

/** أنواع الاختبارات — الاختبارات تقرأ من السياسة لا من الكود */
export const DEFAULT_EXAM_TYPES: ExamTypeDef[] = [
  { key: "quiz", nameAr: "تقييم قصير", carryToComponentKey: "short" },
  { key: "mid", nameAr: "اختبار منتصف الفصل", carryToComponentKey: "mid" },
  { key: "final", nameAr: "اختبار نهاية الفصل", carryToComponentKey: "final" },
  { key: "practical", nameAr: "تقييم عملي أو شفهي", carryToComponentKey: "participation" },
];

/** النسب الافتراضية للمستويات المعرفية (الحلقة الأولى) */
export const DEFAULT_COGNITIVE: Record<CognitiveLevel, number> = {
  remember: 40,
  understand: 35,
  apply: 20,
  higher: 5,
};

/** شرائح التقدير الافتراضية (نسب مئوية) — بيانات قابلة للتعديل */
export const DEFAULT_GRADE_SCALE = [
  { min: 90, label: "امتياز" },
  { min: 80, label: "جيد جداً" },
  { min: 70, label: "جيد" },
  { min: 60, label: "مقبول" },
  { min: 50, label: "ضعيف" },
  { min: 0, label: "دون الحد" },
];

/** المستويات التحفيزية — بصيغة المؤنث، قابلة للتعديل من الإعدادات */
export const DEFAULT_POINT_LEVELS: PointLevel[] = [
  { key: "explorer", nameAr: "مستكشفة مبتدئة", min: 0, max: 49 },
  { key: "researcher", nameAr: "باحثة", min: 50, max: 149 },
  { key: "young_scientist", nameAr: "عالِمة صغيرة", min: 150, max: 299 },
  { key: "distinguished", nameAr: "عالِمة متميّزة", min: 300, max: 499 },
  { key: "ambassador", nameAr: "سفيرة العلوم", min: 500, max: null },
];
