/**
 * مخطط قاعدة البيانات — كل واجهات الجداول الـ٢٧
 * ملف أنواع نقي — لا يستورد Dexie.
 *
 * مبادئ حاكمة (من CLAUDE.md):
 * - أرقام سياسة التقييم بيانات لا كود (§4)
 * - لا حذف نهائي: deletedAt + سلّة استرجاع ٣٠ يوماً (§2-د)
 * - الملفات الكبيرة: مسار فقط، لا بايتات (§7)
 * - أسماء الطالبات لا تغادر الجهاز أبداً (§2-هـ)
 */

// ── أنواع مشتركة ──────────────────────────────────────────────

/** الفصل الدراسي الأول أو الثاني */
export type Term = 1 | 2;

/** جنس الطالبات — female افتراضياً (مدرسة بنات) ويولّد كل الصياغة */
export type Gender = "female" | "male";

/** شكل الأرقام: غربية 0123 أو عربية شرقية ٠١٢٣ */
export type Numerals = "western" | "eastern";

export interface Timestamped {
  /** طابع الإنشاء (epoch ms) */
  createdAt: number;
  updatedAt?: number;
}

export interface SoftDeletable {
  /** تاريخ النقل لسلّة الاسترجاع — undefined = سجل حي */
  deletedAt?: number;
  /** يجمع عملية واحدة (رصد بالتصوير مثلاً) للتراجع عنها كوحدة */
  batchId?: number;
}

export interface DemoFlaggable {
  /** بيانات تجريبية — «مسح البيانات التجريبية» يحذف هذه فقط */
  isDemo?: boolean;
}

/** عقد سجل النسخ — الأصل لا يُمسّ أبداً؛ كل تعديل نسخة جديدة */
export interface DocVersion {
  version: number;
  createdAt: number;
  /** مسار الملف المولّد — لا بايتات */
  path: string;
  /** مسار نسخة الإجابات إن وُجدت */
  answersPath?: string;
  /** ملخص التعديل — سجل التعديلات */
  editSummary?: string;
  /** إن كانت هذه النسخة استرجاعاً لنسخة أقدم */
  basedOnVersion?: number;
}

// ── settings — صف واحد ثابت ───────────────────────────────────

/** مستوى تحفيزي — يُخزَّن كبيانات قابلة للتعديل */
export interface PointLevel {
  key: string;
  nameAr: string;
  min: number;
  /** null = بلا سقف (سفيرة العلوم 500+) */
  max: number | null;
}

export interface Settings extends Timestamped {
  /** مفتاح ثابت = 1 — صف واحد دائماً */
  id: 1;
  studentGender: Gender;
  fontScale: 18 | 20 | 22 | 24;
  /** أرقام الجداول والدرجات — غربية افتراضياً */
  numeralsTable: Numerals;
  /** أرقام الشهادات والمستندات الرسمية — شرقية افتراضياً */
  numeralsCert: Numerals;
  schoolName: string;
  currentAcademicYearId: number;
  /** الفصل الدراسي الحالي (١ أو ٢) — يظهر في الشريط العلوي */
  currentTerm?: Term;
  /** آخر فصل عملت فيه المعلّمة — تتذكّره كل الشاشات */
  lastUsedClassId?: number;
  /** ترتيب أعمدة التصدير الرسمي — يُضبط مرة واحدة */
  officialExportColumns?: string[];
  /** قفل التطبيق الاختياري — تجزئة، لا نص صريح */
  passwordHash?: string;
  pointLevels: PointLevel[];
  /** مفتاح «اقطعي الاتصال» — المنصّة تعمل كاملة بدونه */
  aiConnectionEnabled: boolean;
  lastBackupAt?: number;
  /** لتنبيه أغسطس: «هل تغيّرت سياسة التقييم؟» */
  lastPolicyReviewYear?: number;
  /** حارس الزرع الأول */
  seeded: boolean;
}

// ── academicYears ─────────────────────────────────────────────

export interface AcademicYear extends Timestamped, DemoFlaggable {
  id?: number;
  /** «2026/2027» */
  name: string;
  startDate?: number;
  endDate?: number;
  /** نسخة السياسة الفعّالة لهذا العام */
  assessmentPolicyId?: number;
  isCurrent: boolean;
  /** مؤرشف = قراءة فقط للمقارنة بين الأعوام */
  isArchived: boolean;
  holidays?: { date: number; nameAr: string }[];
}

// ── assessmentPolicy — الأرقام القطرية كبيانات، بنسخة لكل عام ──

export interface PolicyComponent {
  key: string;
  nameAr: string;
  max: number;
  /** مكوّنات «أعمال الفصل» الفرعية تحمل parentKey='coursework' */
  parentKey?: string;
  order: number;
}

/** نوع اختبار معرّف في السياسة — الاختبارات تقرأ الأنواع من هنا لا من الكود */
export interface ExamTypeDef {
  key: string;
  nameAr: string;
  /** مكوّن الدرجات الذي تُرحَّل إليه درجة الاختبار تلقائياً */
  carryToComponentKey?: string;
}

/** المستوى المعرفي (تصنيف بلوم المبسّط) */
export type CognitiveLevel = "remember" | "understand" | "apply" | "higher";

export interface AssessmentPolicy extends Timestamped, DemoFlaggable {
  id?: number;
  /** السياسة مملوكة لعام — تعديل عام قادم لا يمسّ أعواماً سابقة */
  academicYearId: number;
  /** نسخة جديدة بدل التعديل — سجل تدقيق كامل */
  version: number;
  isActive: boolean;
  components: PolicyComponent[];
  /** وزنا الفصلين — 40/60 افتراضياً */
  termWeights: { term1: number; term2: number };
  maxGrade: number;
  passGrade: number;
  examTypes: ExamTypeDef[];
  /** النسب الافتراضية للمستويات المعرفية في بناء الاختبار */
  cognitiveDefault: Record<CognitiveLevel, number>;
  note?: string;
}

// ── gradeComponents — نسخ مجسّدة لكل عام+فصل ──────────────────
// الدرجات ترتبط بهذه لا بأرقام السياسة، فلا يفسد الماضي عند تعديلها

export interface GradeComponent extends Timestamped, DemoFlaggable {
  id?: number;
  academicYearId: number;
  policyId: number;
  term: Term;
  /** المفتاح الثابت من السياسة (mid/short/participation/homework/final) */
  key: string;
  nameAr: string;
  maxMark: number;
  parentKey?: string;
  order: number;
}

// ── subjects ──────────────────────────────────────────────────

export interface Subject extends Timestamped, DemoFlaggable {
  id?: number;
  /** «العلوم» */
  nameAr: string;
  /** المقابل الإنجليزي — للذكر الأول بين قوسين فقط */
  nameEn?: string;
  /** 5 = المستوى الخامس */
  grade: number;
}

// ── classes — تسمّيها المعلّمة بنفسها ─────────────────────────

export interface Klass extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  /** «خامس ١» — لا تثبيت للعدد ولا الأسماء في الكود */
  name: string;
  academicYearId: number;
  subjectId: number;
  order?: number;
  // عدد الطالبات والمتوسط قيم محسوبة — لا تُخزَّن
}

// ── students — الأسماء لا تغادر الجهاز أبداً ──────────────────

/** سجل نقل بين فصلين — البيانات تتبع studentId تلقائياً */
export interface ClassTransfer {
  fromClassId: number;
  toClassId: number;
  date: number;
  note?: string;
}

export interface EarnedBadge {
  badgeId: number;
  awardedAt: number;
  reason?: string;
  /** 'YYYY-MM' */
  monthKey?: string;
}

export interface Student extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  /** على الجهاز فقط — لا يُرسل لأي خدمة خارجية إطلاقاً */
  name: string;
  /** الرقم في الكشف (داخل الفصل) */
  rollNumber: number;
  /** الفصل الحالي — يتغيّر عند النقل */
  classId: number;
  /** ولية/ولي الأمر */
  guardianName?: string;
  guardianRelation?: string;
  contactNumber?: string;
  /** ملاحظات صحية أو خاصة */
  healthNotes?: string;
  /** صورة صغيرة كـ Blob — الاستثناء الوحيد لقاعدة «مسار فقط» */
  photo?: Blob;
  earnedBadges?: EarnedBadge[];
  /** سجل النقل بين الفصول مع تواريخه */
  classHistory?: ClassTransfer[];
  /** خبيئة مشتقة من سجل النقاط — لسرعة لوحة الصدارة، قابلة لإعادة البناء */
  cachedCumulativePoints?: number;
  cachedMonthlyPoints?: number;
  cachedMonthKey?: string;
}

// ── units / lessons — شجرة المنهج ─────────────────────────────

export interface Unit extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  subjectId: number;
  title: string;
  order: number;
  /** رموز المعايير */
  standards?: string[];
  objectives?: string[];
  sessionsCount?: number;
}

/** ناتج تعلّم — الأسئلة ترتبط به بالرمز */
export interface LearningOutcome {
  code: string;
  text: string;
}

export interface Lesson extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  unitId: number;
  /** منسوخ من الوحدة لاستعلامات مباشرة بالمادة */
  subjectId: number;
  title: string;
  order: number;
  objectives?: string[];
  standards?: string[];
  learningOutcomes?: LearningOutcome[];
  /** عدد الحصص */
  sessionsCount?: number;
}

// ── grades — درجات رقمية فقط؛ المجاميع والتقدير تُحسب في الكود ──

export type GradeSource = "photo" | "manual" | "exam" | "import";

export interface Grade extends Timestamped, SoftDeletable {
  id?: number;
  /** ثابت — يتبع الطالبة أينما انتقلت */
  studentId: number;
  /** فصل لحظة الرصد — لا يُعاد كتابته عند النقل */
  classId: number;
  academicYearId: number;
  term: Term;
  /** يرتبط بالنسخة المجسّدة، فيصمد أمام تعديلات السياسة */
  gradeComponentId: number;
  /** 0..maxMark للمكوّن */
  mark: number;
  source: GradeSource;
  /** عند الترحيل التلقائي من اختبار */
  sourceExamId?: number;
  /** مسار صورة ورقة الرصد الأصلية — للرجوع عند أي خلاف */
  sourceImageRef?: string;
  // batchId (من SoftDeletable) = عملية الرصد كاملة → تراجع ٣٠ يوماً
}

// ── attendance — صف واحد لكل طالبة لكل يوم ────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface Attendance extends Timestamped, SoftDeletable {
  id?: number;
  studentId: number;
  classId: number;
  /** اليوم عند منتصف الليل (epoch ms) */
  date: number;
  status: AttendanceStatus;
  note?: string;
}

// ── behaviorNotes — على الجهاز، لا تُرسل للذكاء الاصطناعي ─────

export interface BehaviorNote extends Timestamped, SoftDeletable {
  id?: number;
  studentId: number;
  date: number;
  text: string;
  tone?: "positive" | "concern" | "neutral";
}

// ── points — دفتر قيود، لا عدّاد ──────────────────────────────
// الشهري = مجموع صفوف الشهر الحالي · التراكمي = مجموع الكل
// «تصفير الشهر» استعلام، لا مسح مدمّر

export interface PointEntry extends Timestamped, SoftDeletable {
  id?: number;
  studentId: number;
  classId: number;
  /** + منح / − تصحيح */
  delta: number;
  ruleId?: number;
  reason?: string;
  /** auto = من الحضور والدرجات · manual = زر الحصة */
  source: "auto" | "manual";
  awardedAt: number;
  /** 'YYYY-MM' — التجميع الشهري والتصفير الضمني */
  monthKey: string;
}

// ── pointRules — سلوك ← نقاط، تعدّلها المعلّمة ───────────────

export interface PointRule extends Timestamped, DemoFlaggable {
  id?: number;
  key: string;
  nameAr: string;
  points: number;
  /** خطّاف الاحتساب التلقائي — undefined = يدوي فقط */
  autoTrigger?: string;
  monthlyCap?: number;
  active: boolean;
}

// ── badges — كتالوج الأوسمة (المنح على الطالبة نفسها) ─────────

export interface Badge extends Timestamped, DemoFlaggable {
  id?: number;
  key: string;
  /** «عالِمة الشهر» — صيغة مؤنثة */
  nameAr: string;
  icon?: string;
  description?: string;
  autoRule?: string;
}

// ── rewards / rewardRedemptions — المتجر وسجل الصرف ───────────

export interface Reward extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  nameAr: string;
  costPoints: number;
  /** undefined = بلا حد */
  stock?: number;
  icon?: string;
  active: boolean;
}

export interface RewardRedemption extends Timestamped, SoftDeletable {
  id?: number;
  studentId: number;
  rewardId: number;
  /** السعر لحظة الصرف */
  costPoints: number;
  redeemedAt: number;
  monthKey: string;
  status: "redeemed" | "cancelled";
}

// ── questions — بنك الأسئلة، كل سؤال مربوط بناتج تعلّم ────────

export type QuestionType =
  | "mcq"
  | "truefalse"
  | "matching"
  | "fillblank"
  | "define"
  | "order"
  | "readchart"
  | "drawlabel"
  | "justify"
  | "shortessay"
  | "inquiry";

export type Difficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  key: string;
  text: string;
}

/** شكل الإجابة يعتمد على نوع السؤال */
export type AnswerKey =
  | string
  | string[]
  | { left: string; right: string }[]
  | { order: string[] };

export interface Question extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  unitId: number;
  lessonId?: number;
  /** ربط بناتج تعلّم من الدرس */
  learningOutcomeCode?: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  answerKey?: AnswerKey;
  marks: number;
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  estimatedMinutes?: number;
  /** مسار الصورة المرفقة */
  imageRef?: string;
  tags?: string[];
  /** خبيئة — الحقيقة في examQuestions */
  usageCount: number;
  /** لاستبعاد المستخدم في آخر سنتين */
  lastUsedDate?: number;
}

// ── exams / examQuestions / examResults ───────────────────────

export interface ExamExport {
  kind:
    | "wordExam"
    | "pdfExam"
    | "answerKey"
    | "specTable"
    | "variantA"
    | "variantB";
  /** مسار الملف المولّد فقط */
  path: string;
  createdAt: number;
}

export interface Exam extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  title: string;
  /** من assessmentPolicy.examTypes — لا أنواع مثبّتة في الكود */
  typeKey: string;
  academicYearId: number;
  term: Term;
  classId?: number;
  unitIds: number[];
  totalMarks: number;
  durationMinutes: number;
  /** توزيع المستويات المعرفية (خطوة ٢ من المعالج) */
  cognitiveDistribution: Record<CognitiveLevel, number>;
  status: "draft" | "ready" | "administered";
  /** موعده — لتنبيه «جاهز قبل أسبوعين» */
  scheduledFor?: number;
  /** مكوّن الدرجات الذي تُرحَّل إليه النتيجة */
  carryToComponentId?: number;
  exports?: ExamExport[];
  variants?: ("A" | "B")[];
}

/** جدول ربط: سؤال داخل اختبار */
export interface ExamQuestion {
  id?: number;
  examId: number;
  questionId: number;
  order: number;
  /** درجة السؤال في هذا الاختبار تحديداً */
  marks: number;
  variant?: "A" | "B";
  sectionKey?: string;
  /** معامل السهولة بعد التصحيح (0..1) */
  facilityIndex?: number;
}

export interface ExamResult extends Timestamped, SoftDeletable {
  id?: number;
  examId: number;
  studentId: number;
  totalScore: number;
  /** تفصيل سؤالاً بسؤال — اختياري */
  perQuestion?: { questionId: number; score: number; correct?: boolean }[];
  /** صف الدرجة الذي أنشأه الترحيل التلقائي */
  carriedToGradeId?: number;
  gradedAt: number;
}

// ── worksheets / lessonPlans — بنسخ محفوظة، الأصل لا يُمسّ ────

export interface Worksheet extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  title: string;
  lessonId?: number;
  unitId?: number;
  /** دعم / أساسي / إثراء */
  differentiation?: "support" | "core" | "enrichment";
  currentVersion: number;
  versions: DocVersion[];
}

export interface LessonPlan extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  title: string;
  lessonId?: number;
  unitId?: number;
  /** لإعادة الاستخدام العام القادم */
  academicYearId?: number;
  currentVersion: number;
  versions: DocVersion[];
  /** حقول نموذج المدرسة (أهداف/تمهيد/أنشطة/تقويم/واجب/فروق فردية) */
  fields?: Record<string, string>;
}

// ── resources — مركز المصادر: مرجع للملف لا بايتاته ───────────

/** أنواع مصادر أول العام الثمانية (§2-و) + أخرى */
export type ResourceCategory =
  | "textbook"        // كتاب العلوم للمستوى الخامس
  | "workbook"        // ملازم الأسئلة
  | "term_plan"       // الخطط الفصلية
  | "presentation"    // عروضها الحالية
  | "worksheet"       // أوراق عملها
  | "student_list"    // قوائم الطالبات
  | "grade_template"  // قالب كشف الدرجات المعتمد
  | "schedule"        // الجدول الدراسي
  | "other";

export interface Resource extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  title: string;
  kind: "pptx" | "pdf" | "image" | "video" | "link" | "doc" | "xlsx" | "other";
  /** تصنيف المصدر — أساس فلترة المركز ومرجعية الذكاء الاصطناعي */
  category: ResourceCategory;
  /**
   * مرجع الملف في مكانه (§7 — «المسار لا الملف»):
   * مقبض نظام الملفات (كروم/إيدج) يُخزَّن كما هو في IndexedDB.
   */
  handle?: FileSystemFileHandle;
  /** بديل للمتصفحات بلا مقابض: الملفات الصغيرة فقط تُخزَّن Blob */
  blob?: Blob;
  /** اسم الملف الأصلي وقت الرفع */
  fileName?: string;
  /** مسار نصي (يُستخدم في Tauri لاحقاً) */
  path?: string;
  url?: string;
  subjectId?: number;
  academicYearId?: number;
  grade?: number;
  term?: Term;
  unitId?: number;
  lessonId?: number;
  sizeBytes?: number;
  thumbnailPath?: string;
  /** نص مستخرج للبحث داخل المحتوى */
  searchText?: string;
  /** نصوص الشرائح/الصفحات واحدة واحدة — للمعاينة والاستوديو */
  extractedSlides?: string[];
  /** نسخ الاستوديو — الأصل لا يُمسّ أبداً (§2-و) */
  versions?: DocVersion[];
  currentVersion?: number;
  tags?: string[];
}

// ── parentContacts — سجل التواصل مع أولياء الأمور ─────────────

export interface ParentContact extends Timestamped, SoftDeletable {
  id?: number;
  studentId: number;
  date: number;
  channel: "phone" | "whatsapp" | "inperson" | "note" | "other";
  /** لماذا تواصلنا */
  reason: string;
  summary?: string;
  outcome?: string;
  followUpDate?: number;
}

// ── certificates — ٥ قوالب ────────────────────────────────────

export type CertificateTemplate =
  | "excellence"
  | "star_of_month"
  | "most_improved"
  | "best_experiment"
  | "guardian_thanks";

export interface Certificate extends Timestamped, SoftDeletable, DemoFlaggable {
  id?: number;
  templateKey: CertificateTemplate;
  scope: "student" | "class";
  studentId?: number;
  classId?: number;
  reason: string;
  date: number;
  /** رقم تسلسلي للتحقق عبر QR */
  serial?: string;
  /** نص تحقق محلي فقط — لا روابط خارجية */
  qrPayload?: string;
  /** مسار PDF/PNG المولّد */
  path?: string;
}

// ── aiSendLog — سجل الإرسال الكامل (§2-هـ ضمانة ٢) ────────────

export interface AiSendLogEntry extends Timestamped {
  id?: number;
  /** نوع الإرسال */
  kind: "studio-edit" | "generation" | "ocr" | "other";
  title: string;
  /** المحتوى الفعلي الذي سيُرسل — يُعرض في شاشة «ما سيُرسل» ويبقى للمراجعة */
  contentPreview: string;
  sizeBytes: number;
  /** pending = مسجَّل والاتصال مقطوع · sent = أُرسل · cancelled = ألغته المعلّمة */
  status: "pending" | "sent" | "cancelled";
  note?: string;
}

// ── studioRequests — طلبات تعديل الاستوديو (تُعالَج لاحقاً) ────

export interface StudioRequest extends Timestamped {
  id?: number;
  resourceId: number;
  /** طلب المعلّمة بالعامية كما كتبته */
  instruction: string;
  status: "pending" | "done" | "cancelled";
  /** رقم النسخة الناتجة حين يُنفَّذ */
  resultVersion?: number;
  /** ربط بسجل الإرسال */
  sendLogId?: number;
}

// ── backups — بيانات وصفية فقط، الملف نفسه يُنزَّل ────────────

export interface BackupMeta extends Timestamped {
  id?: number;
  /** backup-YYYY-MM-DD.json */
  fileName: string;
  sizeBytes: number;
  trigger: "manual" | "auto_7day" | "before_bulk_delete" | "before_import";
  /** عدد السجلات لكل جدول لحظة النسخ */
  recordCounts?: Record<string, number>;
  path?: string;
}
