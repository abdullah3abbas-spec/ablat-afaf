/**
 * البيانات التجريبية — ٣ فصول × ٢٥ طالبة + وحدتان بدروسهما.
 *
 * كل صف مزروع يحمل isDemo:true، فزر «مسح البيانات التجريبية»
 * يحذف هذه الصفوف فقط ولا يقترب من أي بيانات حقيقية.
 */
import { db } from "./db";
import {
  DEFAULT_ABSENCE_ALERT,
  DEFAULT_COGNITIVE,
  DEFAULT_EXAM_TYPES,
  DEFAULT_GRADE_SCALE,
  DEFAULT_MAX_GRADE,
  DEFAULT_MONTHLY_POINTS_CAP,
  DEFAULT_PASS_GRADE,
  DEFAULT_POINT_LEVELS,
  DEFAULT_POINT_RULES,
  DEFAULT_POLICY_COMPONENTS,
  DEFAULT_REWARDS,
  DEFAULT_TERM_WEIGHTS,
} from "./constants";
import type { Lesson, Student, Unit } from "./schema";

// ── أسماء واقعية — بنات (§1: مدرسة بنات) ──────────────────────

const FIRST_NAMES = [
  "نورة", "مريم", "عائشة", "فاطمة", "حصّة", "موزة", "شيخة", "العنود",
  "لطيفة", "سارة", "هند", "دانة", "ريم", "الجازي", "مها", "شمّا",
  "روضة", "نوف", "أمل", "سلمى", "جواهر", "وضحى", "غالية", "بدرية",
  "منيرة", "هيا", "لولوة", "عبير", "ميثاء", "شهد", "عفراء", "أروى",
  "بشاير", "جوري", "حنين",
];

const FAMILY_NAMES = [
  "المهندي", "الكواري", "النعيمي", "المريخي", "الهاجري", "السليطي",
  "العطية", "الكبيسي", "البوعينين", "المناعي", "الدوسري", "المرّي",
  "الأنصاري", "الجابر", "الخليفي", "المسند", "السويدي", "الخاطر",
  "المحمود", "الرميحي", "الملا", "الغانم", "الإبراهيم", "الحمادي",
  "الكعبي",
];

/** توليد 75 اسماً فريداً بمزج الاسم الأول واسم العائلة */
function generateStudentNames(count: number): string[] {
  const names: string[] = [];
  const used = new Set<string>();
  let i = 0;
  while (names.length < count) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const family = FAMILY_NAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % FAMILY_NAMES.length];
    const full = `${first} ${family}`;
    if (!used.has(full)) {
      used.add(full);
      names.push(full);
    }
    i++;
  }
  return names;
}

// ── وحدتا علوم المستوى الخامس (المنهج القطري) ────────────────

interface SeedLesson {
  title: string;
  sessions: number;
  outcomes: { code: string; text: string }[];
}

const UNIT_1_LESSONS: SeedLesson[] = [
  { title: "خصائص المادة", sessions: 2, outcomes: [{ code: "ع.٥.١.١", text: "تصف خصائص المادة القابلة للقياس" }] },
  { title: "حالات المادة الثلاث", sessions: 2, outcomes: [{ code: "ع.٥.١.٢", text: "تقارن بين الحالة الصلبة والسائلة والغازية" }] },
  { title: "التغيّرات الفيزيائية", sessions: 2, outcomes: [{ code: "ع.٥.١.٣", text: "تميّز التغيّر الفيزيائي بأمثلة من بيئتها" }] },
  { title: "التغيّرات الكيميائية", sessions: 2, outcomes: [{ code: "ع.٥.١.٤", text: "تستدل على حدوث تغيّر كيميائي" }] },
  { title: "المخاليط والمحاليل", sessions: 3, outcomes: [{ code: "ع.٥.١.٥", text: "تفصل مكوّنات مخلوط بطرائق مناسبة" }] },
];

const UNIT_2_LESSONS: SeedLesson[] = [
  { title: "الجهاز الهضمي", sessions: 2, outcomes: [{ code: "ع.٥.٢.١", text: "تتبع مسار الغذاء في الجهاز الهضمي" }] },
  { title: "الجهاز التنفسي", sessions: 2, outcomes: [{ code: "ع.٥.٢.٢", text: "تشرح آلية التنفس وتبادل الغازات" }] },
  { title: "الجهاز الدوري", sessions: 2, outcomes: [{ code: "ع.٥.٢.٣", text: "تصف دور القلب والأوعية الدموية" }] },
  { title: "الجهاز الهيكلي والعضلي", sessions: 2, outcomes: [{ code: "ع.٥.٢.٤", text: "توضّح وظيفة العظام والعضلات في الحركة" }] },
  { title: "الغذاء الصحي والوقاية", sessions: 2, outcomes: [{ code: "ع.٥.٢.٥", text: "تصمّم وجبة متوازنة وتبرّر اختياراتها" }] },
];

// ── الزرع ─────────────────────────────────────────────────────

/** يزرع البيانات التجريبية إن كانت القاعدة فارغة (حارس التشغيل الأول) */
export async function seedIfEmpty(): Promise<void> {
  const existing = await db.settings.get(1);
  if (existing?.seeded) return;
  await runSeed();
}

/** الزرع الفعلي — معاملة واحدة شاملة */
async function runSeed(): Promise<void> {
  const now = Date.now();

  await db.transaction(
    "rw",
    [db.settings, db.academicYears, db.assessmentPolicy, db.subjects, db.classes, db.students, db.units, db.lessons, db.pointRules, db.rewards],
    async () => {
      // ١) العام الأكاديمي
      const yearId = await db.academicYears.add({
        name: "2026/2027",
        isCurrent: true,
        isArchived: false,
        isDemo: true,
        createdAt: now,
      });

      // ٢) سياسة التقييم — الأرقام القطرية كبيانات (§4)
      const policyId = await db.assessmentPolicy.add({
        academicYearId: yearId,
        version: 1,
        isActive: true,
        components: DEFAULT_POLICY_COMPONENTS,
        termWeights: DEFAULT_TERM_WEIGHTS,
        maxGrade: DEFAULT_MAX_GRADE,
        passGrade: DEFAULT_PASS_GRADE,
        examTypes: DEFAULT_EXAM_TYPES,
        cognitiveDefault: DEFAULT_COGNITIVE,
        gradeScale: DEFAULT_GRADE_SCALE,
        isDemo: true,
        createdAt: now,
      });
      await db.academicYears.update(yearId, { assessmentPolicyId: policyId });

      // ٣) المادة
      const subjectId = await db.subjects.add({
        nameAr: "العلوم",
        nameEn: "Science",
        grade: 5,
        isDemo: true,
        createdAt: now,
      });

      // ٤) ٣ فصول × ٢٥ طالبة
      const names = generateStudentNames(75);
      const classNames = ["خامس ١", "خامس ٢", "خامس ٣"];
      for (let c = 0; c < classNames.length; c++) {
        const classId = await db.classes.add({
          name: classNames[c],
          academicYearId: yearId,
          subjectId,
          order: c + 1,
          isDemo: true,
          createdAt: now,
        });
        const students: Student[] = names
          .slice(c * 25, c * 25 + 25)
          .map((name, i) => ({
            name,
            rollNumber: i + 1,
            classId,
            isDemo: true,
            createdAt: now,
          }));
        await db.students.bulkAdd(students);
        // تذكّر آخر فصل: الأول افتراضياً — مع الحفاظ على تفضيلات
        // العرض الموجودة (حجم الخط وشكل الأرقام) عند إعادة الزرع
        if (c === 0) {
          const prev = await db.settings.get(1);
          await db.settings.put({
            id: 1,
            studentGender: prev?.studentGender ?? "female",
            fontScale: prev?.fontScale ?? 18,
            numeralsTable: prev?.numeralsTable ?? "western",
            numeralsCert: prev?.numeralsCert ?? "eastern",
            schoolName: prev?.schoolName ?? "مدرستي (غيّري الاسم من الإعدادات)",
            currentAcademicYearId: yearId,
            lastUsedClassId: classId,
            pointLevels: prev?.pointLevels ?? DEFAULT_POINT_LEVELS,
            monthlyPointsCap: prev?.monthlyPointsCap ?? DEFAULT_MONTHLY_POINTS_CAP,
            absenceAlertThreshold: prev?.absenceAlertThreshold ?? DEFAULT_ABSENCE_ALERT,
            aiConnectionEnabled: prev?.aiConnectionEnabled ?? false,
            seeded: true,
            createdAt: prev?.createdAt ?? now,
            updatedAt: now,
          });
        }
      }

      // ٥) قواعد النقاط والمتجر — إن لم تكن موجودة
      if ((await db.pointRules.count()) === 0) {
        await db.pointRules.bulkAdd(
          DEFAULT_POINT_RULES.map((r) => ({ ...r, active: true, isDemo: true, createdAt: now }))
        );
      }
      if ((await db.rewards.count()) === 0) {
        await db.rewards.bulkAdd(
          DEFAULT_REWARDS.map((r) => ({ ...r, active: true, isDemo: true, createdAt: now }))
        );
      }

      // ٦) وحدتان بدروسهما
      const unitsData: { title: string; lessons: SeedLesson[] }[] = [
        { title: "المادة وتغيّراتها", lessons: UNIT_1_LESSONS },
        { title: "أجهزة جسم الإنسان", lessons: UNIT_2_LESSONS },
      ];
      for (let u = 0; u < unitsData.length; u++) {
        const unit: Unit = {
          subjectId,
          title: unitsData[u].title,
          order: u + 1,
          sessionsCount: unitsData[u].lessons.reduce((s, l) => s + l.sessions, 0),
          isDemo: true,
          createdAt: now,
        };
        const unitId = await db.units.add(unit);
        const lessons: Lesson[] = unitsData[u].lessons.map((l, i) => ({
          unitId,
          subjectId,
          title: l.title,
          order: i + 1,
          sessionsCount: l.sessions,
          learningOutcomes: l.outcomes,
          isDemo: true,
          createdAt: now,
        }));
        await db.lessons.bulkAdd(lessons);
      }
    }
  );
}

/** حذف البيانات التجريبية فقط — لا يقترب من أي بيانات حقيقية */
export async function clearDemo(): Promise<void> {
  const tables = [
    db.academicYears,
    db.assessmentPolicy,
    db.subjects,
    db.classes,
    db.students,
    db.units,
    db.lessons,
    db.pointRules,
    db.rewards,
  ];
  await db.transaction("rw", [...tables, db.settings], async () => {
    for (const table of tables) {
      // فهرس isDemo غير موجود عمداً (قيمة منطقية) — التصفية في الذاكرة كافية محلياً
      const demoKeys = await table.filter((r) => (r as { isDemo?: boolean }).isDemo === true).primaryKeys();
      await table.bulkDelete(demoKeys as number[]);
    }
    // إسقاط حارس الزرع كي تعمل «إعادة البيانات التجريبية»
    await db.settings.update(1, { seeded: false });
  });
}

/** مسح ثم إعادة زرع — لزر «إعادة البيانات التجريبية» */
export async function reseedDemo(): Promise<void> {
  await clearDemo();
  await runSeed();
}
