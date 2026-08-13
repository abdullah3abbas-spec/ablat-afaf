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

/** قواعد النقاط الافتراضية التسع (سلوك ← نقاط) — تعدّلها المعلّمة */
export const DEFAULT_POINT_RULES = [
  { key: "full_week", nameAr: "حضور أسبوع كامل", points: 5, autoTrigger: "attendance_week" },
  { key: "participation", nameAr: "مشاركة مميزة", points: 2 },
  { key: "homework", nameAr: "تسليم واجب", points: 3 },
  { key: "experiment", nameAr: "إنجاز تجربة", points: 8 },
  { key: "smart_question", nameAr: "سؤال علمي ذكي", points: 5 },
  { key: "help_classmate", nameAr: "مساعدة زميلة", points: 4 },
  { key: "grade_90", nameAr: "درجة 90% فأعلى", points: 10, autoTrigger: "grade_90" },
  { key: "improvement", nameAr: "تحسّن شخصي عن آخر تقييم", points: 15, autoTrigger: "grade_improved" },
  { key: "extra_project", nameAr: "مشروع إضافي", points: 20 },
];

/** السقف الشهري الافتراضي للنقاط — يمنع احتكار الصدارة، قابل للتعديل */
export const DEFAULT_MONTHLY_POINTS_CAP = 100;

/** عتبة تنبيه تكرار الغياب في الشهر */
export const DEFAULT_ABSENCE_ALERT = 4;

/** متجر المكافآت الافتراضي — أسعار بالنقاط، قابل للتعديل */
export const DEFAULT_REWARDS = [
  { nameAr: "ملصقات علوم مميزة", costPoints: 20 },
  { nameAr: "قلم المعلّمة الخاص ليوم", costPoints: 30 },
  { nameAr: "شهادة تميّز فورية", costPoints: 40 },
  { nameAr: "اختيار مقعدك لأسبوع", costPoints: 50 },
  { nameAr: "مساعِدة المعلّمة ليوم كامل", costPoints: 60 },
  { nameAr: "قائدة التجربة القادمة", costPoints: 80 },
];

/** الأوسمة الافتراضية — بصيغة المؤنث، تظهر في ملف الطالبة وعلى شهادتها */
export const DEFAULT_BADGES = [
  { key: "scientist_of_month", nameAr: "عالِمة الشهر", icon: "🔬", description: "الأعلى نقاطاً هذا الشهر" },
  { key: "best_experiment", nameAr: "أفضل تجربة", icon: "⚗️", description: "تميّزت في تنفيذ تجربة عملية" },
  { key: "curious_researcher", nameAr: "الباحثة الفضولية", icon: "🔍", description: "كثيرة الأسئلة العلمية الذكية" },
  { key: "team_star", nameAr: "نجمة التعاون", icon: "🤝", description: "مساعِدة مميزة لزميلاتها" },
];

/** المستويات التحفيزية — بصيغة المؤنث، قابلة للتعديل من الإعدادات */
export const DEFAULT_POINT_LEVELS: PointLevel[] = [
  { key: "explorer", nameAr: "مستكشفة مبتدئة", min: 0, max: 49 },
  { key: "researcher", nameAr: "باحثة", min: 50, max: 149 },
  { key: "young_scientist", nameAr: "عالِمة صغيرة", min: 150, max: 299 },
  { key: "distinguished", nameAr: "عالِمة متميّزة", min: 300, max: 499 },
  { key: "ambassador", nameAr: "سفيرة العلوم", min: 500, max: null },
];

/** الاسم الرسمي للمدرسة — وصل من المالك (أغسطس ٢٠٢٦) */
export const DEFAULT_SCHOOL_NAME = "مدرسة زكريت الابتدائية للبنات";

/** العنصر النائب القديم لاسم المدرسة — يُستبدل بالاسم الرسمي في ترحيل v11 */
export const LEGACY_SCHOOL_PLACEHOLDER = "مدرستي (غيّري الاسم من الإعدادات)";
