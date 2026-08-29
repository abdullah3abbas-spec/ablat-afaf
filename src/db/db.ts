/**
 * قاعدة بيانات المنصّة — Dexie فوق IndexedDB، محلية بالكامل.
 *
 * قاعدة الترقيات (§8.8): الإصدارات إضافية دائماً.
 * - حقل جديد غير مفهرس → أضِفه للواجهة فقط، بلا رفع إصدار.
 * - جدول أو فهرس جديد → version(n).stores({...}) بالمتغيّر فقط + upgrade() للتعبئة.
 * - لا تُسنِد null لأي جدول (يحذفه!) ولا تضيّق المخطط أبداً.
 */
import Dexie, { type Table } from "dexie";
import {
  DEFAULT_ABSENCE_ALERT,
  DEFAULT_BADGES,
  DEFAULT_GRADE_SCALE,
  DEFAULT_MONTHLY_POINTS_CAP,
  DEFAULT_POINT_RULES,
  DEFAULT_REWARDS,
} from "./constants";
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
  TeacherRequest,
  Presentation,
  LessonPackRecord,
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
  requests!: Table<TeacherRequest, number>;
  presentations!: Table<Presentation, number>;
  lessonPacks!: Table<LessonPackRecord, number>;

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

    // v4 — الأمر ٢: تعبئة شرائح التقدير في السياسات القائمة (بيانات لا كود §4)
    // ⚠️ لا await import هنا — معاملة IndexedDB تُغلق فور خلو طابور المهام
    this.version(4).upgrade((tx) =>
      tx
        .table("assessmentPolicy")
        .toCollection()
        .modify((p: { gradeScale?: unknown }) => {
          p.gradeScale ??= DEFAULT_GRADE_SCALE;
        })
    );

    // v5 — الأمر ٣: تعبئة قواعد النقاط والمتجر والسقف في القواعد القائمة
    this.version(5).upgrade(async (tx) => {
      const now = Date.now();
      await tx
        .table("settings")
        .toCollection()
        .modify((s: { monthlyPointsCap?: number; absenceAlertThreshold?: number }) => {
          s.monthlyPointsCap ??= DEFAULT_MONTHLY_POINTS_CAP;
          s.absenceAlertThreshold ??= DEFAULT_ABSENCE_ALERT;
        });
      const rulesCount = await tx.table("pointRules").count();
      if (rulesCount === 0) {
        await tx.table("pointRules").bulkAdd(
          DEFAULT_POINT_RULES.map((r) => ({ ...r, active: true, isDemo: true, createdAt: now }))
        );
      }
      const rewardsCount = await tx.table("rewards").count();
      if (rewardsCount === 0) {
        await tx.table("rewards").bulkAdd(
          DEFAULT_REWARDS.map((r) => ({ ...r, active: true, isDemo: true, createdAt: now }))
        );
      }
    });

    // v6 — الأمر ٧: بذر الأوسمة في القواعد القائمة
    this.version(6).upgrade(async (tx) => {
      const now = Date.now();
      if ((await tx.table("badges").count()) === 0) {
        await tx.table("badges").bulkAdd(DEFAULT_BADGES.map((b) => ({ ...b, isDemo: true, createdAt: now })));
      }
    });

    // v7 — الأمر ٨-ب: جدول «المطلوب منّي» (صندوق الطلبات). إضافي بحت.
    // [status+dueDate]: طلبات مفتوحة قرب موعدها للتنبيه · dueDate للفرز
    this.version(7).stores({
      requests: "++id, type, status, [status+dueDate], dueDate, classId, studentId, deletedAt",
    });

    // v8 — زكريت م٣: العروض البصرية المولّدة (مسودة ← معتمدة). إضافي بحت.
    this.version(8).stores({
      presentations: "++id, lessonId, status, deletedAt",
    });

    // v9 — ١٥/١٠: حزمة الحصة المولّدة لأي درس. إضافي بحت.
    this.version(9).stores({
      lessonPacks: "++id, lessonId, status, deletedAt",
    });

    // v10 — المنهج الحقيقي: كتاب الوزارة (ف١ ج١) يحل محل الوحدتين المخترعتين.
    // القديم التجريبي → سلة الاسترجاع (soft-delete، لا حذف نهائي §7)،
    // والحقيقي يُزرع isDemo:false فينجو من «مسح البيانات التجريبية».
    // بنك أسئلة الكتاب يُبذر عند الإقلاع (seedQuestionBankIfEmpty) لا هنا.
    this.version(10).upgrade(async (tx) => {
      const now = Date.now();
      const subjects = tx.table("subjects");
      const units = tx.table("units");
      const lessons = tx.table("lessons");
      const questions = tx.table("questions");

      // مادة العلوم تتحول مرجعاً حقيقياً — تبقى بعد مسح البيانات التجريبية
      await subjects.toCollection().modify((s: { nameAr?: string; grade?: number; isDemo?: boolean }) => {
        if (s.nameAr === "العلوم" && s.grade === 5) s.isDemo = false;
      });
      const science = (await subjects.toArray()).find(
        (s: { nameAr?: string; grade?: number; deletedAt?: number }) =>
          s.nameAr === "العلوم" && s.grade === 5 && !s.deletedAt
      );
      if (!science?.id) return; // قاعدة لم تُزرع بعد — الزرع الأول يتكفل بالكل

      // أرشفة المنهج التجريبي المخترع وأسئلته
      const archive = (r: { isDemo?: boolean; deletedAt?: number }) => {
        if (r.isDemo && !r.deletedAt) r.deletedAt = now;
      };
      await units.toCollection().modify(archive);
      await lessons.toCollection().modify(archive);
      await questions.toCollection().modify(archive);

      // زرع وحدات الكتاب ودروسه (آمن التكرار — يضيف الناقص فقط)
      const { ensureRealCurriculum } = await import("./realCurriculum");
      await ensureRealCurriculum({ units, lessons }, science.id as number, now);
    });

    // v11 — هوية زكريت: الاسم الرسمي للمدرسة يحل محل العنصر النائب القديم،
    // واسم المعلّمة الافتراضي — دون المساس بأي اسم كتبته المستخدمة بنفسها.
    this.version(11).upgrade(async (tx) => {
      const { DEFAULT_SCHOOL_NAME, LEGACY_SCHOOL_PLACEHOLDER } = await import("./constants");
      await tx.table("settings").toCollection().modify((st: { schoolName?: string; teacherName?: string }) => {
        if (!st.schoolName?.trim() || st.schoolName === LEGACY_SCHOOL_PLACEHOLDER) {
          st.schoolName = DEFAULT_SCHOOL_NAME;
        }
        if (!st.teacherName?.trim()) st.teacherName = "عفاف حسين";
      });
    });

    // v12 — بوابة الذكاء عبر دومين الموقع (بروكسي): الأجهزة التي خزّنت
    // الرابط المباشر القديم تُرحَّل للافتراضي الجديد؛ أي رابط خاص كتبته
    // المستخدمة بنفسها لا يُمَس.
    this.version(12).upgrade(async (tx) => {
      const { DEFAULT_GATEWAY_URL, LEGACY_GATEWAY_URL } = await import("@/lib/aiClient");
      await tx.table("settings").toCollection().modify((st: { aiGatewayUrl?: string }) => {
        const cur = st.aiGatewayUrl?.trim().replace(/\/+$/, "");
        if (!cur || cur === LEGACY_GATEWAY_URL) st.aiGatewayUrl = DEFAULT_GATEWAY_URL;
      });
    });
  }
}

/** النسخة الوحيدة المشتركة في التطبيق كله */
export const db = new ManassatDB();
