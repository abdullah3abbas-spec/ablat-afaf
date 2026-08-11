/**
 * قاعدة بيانات المنصّة — Dexie فوق IndexedDB، محلية بالكامل.
 *
 * قاعدة الترقيات (§8.8): الإصدارات إضافية دائماً.
 * - حقل جديد غير مفهرس → أضِفه للواجهة فقط، بلا رفع إصدار.
 * - جدول أو فهرس جديد → version(n).stores({...}) بالمتغيّر فقط + upgrade() للتعبئة.
 * - لا تُسنِد null لأي جدول (يحذفه!) ولا تضيّق المخطط أبداً.
 */
import Dexie, { type Table } from "dexie";
import type {
  AcademicYear,
  AiSendLogEntry,
  AssessmentPolicy,
  Attendance,
  BackupMeta,
  Badge,
  BehaviorNote,
  Certificate,
  Exam,
  ExamQuestion,
  ExamResult,
  Grade,
  GradeBatch,
  GradeComponent,
  Klass,
  Lesson,
  LessonPlan,
  ParentContact,
  PointEntry,
  PointRule,
  Question,
  Resource,
  Reward,
  RewardRedemption,
  Settings,
  Student,
  StudioRequest,
  Subject,
  Unit,
  Worksheet,
} from "./schema";

export class ManassatDB extends Dexie {
  settings!: Table<Settings, number>;
  academicYears!: Table<AcademicYear, number>;
  assessmentPolicy!: Table<AssessmentPolicy, number>;
  subjects!: Table<Subject, number>;
  classes!: Table<Klass, number>;
  students!: Table<Student, number>;
  units!: Table<Unit, number>;
  lessons!: Table<Lesson, number>;
  gradeComponents!: Table<GradeComponent, number>;
  grades!: Table<Grade, number>;
  attendance!: Table<Attendance, number>;
  behaviorNotes!: Table<BehaviorNote, number>;
  points!: Table<PointEntry, number>;
  pointRules!: Table<PointRule, number>;
  badges!: Table<Badge, number>;
  rewards!: Table<Reward, number>;
  rewardRedemptions!: Table<RewardRedemption, number>;
  questions!: Table<Question, number>;
  exams!: Table<Exam, number>;
  examQuestions!: Table<ExamQuestion, number>;
  examResults!: Table<ExamResult, number>;
  worksheets!: Table<Worksheet, number>;
  lessonPlans!: Table<LessonPlan, number>;
  resources!: Table<Resource, number>;
  parentContacts!: Table<ParentContact, number>;
  certificates!: Table<Certificate, number>;
  backups!: Table<BackupMeta, number>;
  aiSendLog!: Table<AiSendLogEntry, number>;
  studioRequests!: Table<StudioRequest, number>;
  gradeBatches!: Table<GradeBatch, number>;

  constructor() {
    super("manassat-abla-afaf");

    this.version(1).stores({
      // صف واحد بمفتاح ثابت id=1
      settings: "id",
      academicYears: "++id, isCurrent, isArchived, assessmentPolicyId",
      // [academicYearId+isActive]: «سياسة هذا العام الفعّالة» باستعلام واحد
      assessmentPolicy: "++id, academicYearId, [academicYearId+isActive], version",
      subjects: "++id, grade",
      // [academicYearId+subjectId]: قائمة الفصول دائماً ضمن عام+مادة
      classes: "++id, academicYearId, subjectId, [academicYearId+subjectId], deletedAt",
      // [classId+rollNumber]: الكشف مرتّباً — غير فريد كي لا يحجب رقمَ محذوفةٍ إعادةُ استخدامه
      // [classId+deletedAt]: سلّة استرجاع الفصل
      students: "++id, classId, [classId+rollNumber], [classId+deletedAt], name, deletedAt",
      units: "++id, subjectId, [subjectId+order], deletedAt",
      lessons: "++id, unitId, subjectId, [unitId+order], deletedAt",
      gradeComponents: "++id, academicYearId, policyId, [academicYearId+term], key",
      // [studentId+gradeComponentId]: خلية الدرجة الواحدة (لكل طالبة/مكوّن)
      // [studentId+term]: مجموع فصل الطالبة بمسح واحد
      // [gradeComponentId+deletedAt]: درجات فصل كامل لمكوّن + سلّته
      // batchId: التراجع عن عملية رصد كاملة كوحدة
      grades:
        "++id, studentId, gradeComponentId, [studentId+term], [studentId+gradeComponentId], [gradeComponentId+deletedAt], sourceExamId, batchId, deletedAt",
      // [classId+date]: «الفصل كله في شاشة واحدة» ليومٍ ما (§6)
      // [studentId+date]: تاريخ الطالبة + upsert يومي
      attendance: "++id, studentId, [classId+date], [studentId+date], deletedAt",
      behaviorNotes: "++id, studentId, [studentId+date], deletedAt",
      // [studentId+monthKey]: عدّاد الشهر — والتراكمي مجموع studentId كله
      points: "++id, studentId, ruleId, [studentId+monthKey], awardedAt, deletedAt",
      pointRules: "++id, key, active",
      badges: "++id, key",
      rewards: "++id, active, deletedAt",
      rewardRedemptions: "++id, rewardId, [studentId+monthKey], redeemedAt, deletedAt",
      // [unitId+cognitiveLevel]: قلب الاختيار التلقائي لبناء الاختبار
      // lastUsedDate: استبعاد المستخدم في آخر سنتين
      // *tags: فهرس متعدد القيم للوسوم
      questions:
        "++id, unitId, lessonId, type, difficulty, cognitiveLevel, learningOutcomeCode, [unitId+cognitiveLevel], lastUsedDate, *tags, deletedAt",
      exams: "++id, typeKey, academicYearId, term, classId, status, scheduledFor, deletedAt",
      // [examId+order]: عرض أسئلة الاختبار بترتيبها · [examId+variant]: فصل نسختي أ/ب
      examQuestions: "++id, questionId, [examId+order], [examId+variant]",
      // [examId+studentId]: نتيجة واحدة لكل طالبة لكل اختبار
      examResults: "++id, examId, [examId+studentId], studentId, deletedAt",
      worksheets: "++id, lessonId, unitId, differentiation, deletedAt",
      lessonPlans: "++id, lessonId, unitId, academicYearId, deletedAt",
      // [grade+term] و [unitId+lessonId]: محورا تصفّح مركز المصادر
      resources: "++id, subjectId, kind, [grade+term], [unitId+lessonId], *tags, deletedAt",
      parentContacts: "++id, studentId, [studentId+date], followUpDate, deletedAt",
      certificates: "++id, templateKey, studentId, classId, date, scope, deletedAt",
      backups: "++id, createdAt, trigger",
    });

    // v2 — الأمر ١-أ: سجل الإرسال وطلبات الاستوديو (جديدان)
    // + فهرس category على المصادر. ترقية إضافية بحتة — لا يمسّ شيئاً قائماً.
    this.version(2).stores({
      aiSendLog: "++id, createdAt, kind, status",
      studioRequests: "++id, resourceId, status, createdAt",
      resources: "++id, subjectId, kind, category, [grade+term], [unitId+lessonId], *tags, deletedAt",
    });

    // v3 — الأمر ١-ب: دفعات الرصد (عملية التصوير/الاعتماد كوحدة واحدة)
    this.version(3).stores({
      gradeBatches: "++id, classId, gradeComponentId, [classId+gradeComponentId], createdAt, deletedAt",
    });
  }
}

/** النسخة الوحيدة المشتركة في التطبيق كله */
export const db = new ManassatDB();
