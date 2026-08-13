/**
 * الزرع — طبقتان منفصلتان:
 * ١) المنهج الحقيقي (المادة + وحدات كتاب الوزارة ودروسه + بنك أسئلته):
 *    isDemo:false — دائم، لا يمسّه «مسح البيانات التجريبية».
 * ٢) بيانات تجريبية للتجربة (٣ فصول × ٢٥ طالبة + عام وسياسة وطلبات):
 *    isDemo:true — يحذفها الزر فقط.
 */
import { db } from "./db";
import { ensureRealCurriculum } from "./realCurriculum";
import {
  DEFAULT_ABSENCE_ALERT,
  DEFAULT_BADGES,
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
import type { Student } from "./schema";

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

// ── الزرع ─────────────────────────────────────────────────────

/** يزرع البيانات التجريبية إن كانت القاعدة فارغة (حارس التشغيل الأول) */
export async function seedIfEmpty(): Promise<void> {
  const existing = await db.settings.get(1);
  if (existing?.seeded) {
    await seedQuestionBankIfEmpty();
    return;
  }
  await runSeed();
  await seedQuestionBankIfEmpty();
}

/**
 * بذر بنك أسئلة الكتاب إن كان غائباً — يُستدعى عند كل إقلاع، آمن التكرار.
 * الحارس: وجود أسئلة حية موسومة «من-الكتاب» (لا العدد الكلي، حتى لا تمنعه
 * أسئلة الذكاء المعتمدة أو بقايا محذوفة ناعماً).
 */
export async function seedQuestionBankIfEmpty(): Promise<void> {
  const existing = await db.questions
    .filter((q) => !q.deletedAt && (q.tags ?? []).includes("من-الكتاب"))
    .count();
  if (existing > 0) return;
  const { buildBankQuestions } = await import("@/content/questionBank");
  const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt && !l.isDemo && l.code);
  const lessonByCode = new Map(lessons.map((l) => [l.code as string, { id: l.id!, unitId: l.unitId }]));
  const rows = buildBankQuestions(lessonByCode);
  if (rows.length > 0) await db.questions.bulkAdd(rows);
}

/** الزرع الفعلي — معاملة واحدة شاملة */
async function runSeed(): Promise<void> {
  const now = Date.now();

  await db.transaction(
    "rw",
    [db.settings, db.academicYears, db.assessmentPolicy, db.subjects, db.classes, db.students, db.units, db.lessons, db.pointRules, db.rewards, db.badges, db.requests],
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

      // ٣) المادة — مرجع حقيقي لا تجريبي (تنجو من مسح البيانات التجريبية)
      const existingScience = (await db.subjects.toArray()).find(
        (s) => s.nameAr === "العلوم" && s.grade === 5
      );
      const subjectId =
        existingScience?.id ??
        ((await db.subjects.add({
          nameAr: "العلوم",
          nameEn: "Science",
          grade: 5,
          isDemo: false,
          createdAt: now,
        })) as number);

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
      if ((await db.badges.count()) === 0) {
        await db.badges.bulkAdd(DEFAULT_BADGES.map((b) => ({ ...b, isDemo: true, createdAt: now })));
      }

      // ٦) المنهج الحقيقي — وحدات كتاب الوزارة ودروسه (آمن التكرار)
      await ensureRealCurriculum({ units: db.units, lessons: db.lessons }, subjectId, now);

      // ٧) طلبان تجريبيان في «المطلوب منّي» (§ الأمر ٨-ب)
      if ((await db.requests.count()) === 0) {
        const firstClass = (await db.classes.toArray()).find((c) => c.isDemo);
        const day = 86400000;
        await db.requests.bulkAdd([
          {
            type: "struggling",
            title: "تقرير المتعثّرات",
            description: "طلب من المنسّقة: قائمة الطالبات المتعثّرات في العلوم مع خطة الدعم.",
            classId: firstClass?.id,
            dueDate: now + 2 * day,
            status: "new",
            isDemo: true,
            createdAt: now,
          },
          {
            type: "results_stats",
            title: "إحصائية نتائج منتصف الفصل",
            description: "إحصائية عامة لنتائج الفصل الأول لعرضها في اجتماع القسم.",
            classId: firstClass?.id,
            dueDate: now + 9 * day,
            status: "new",
            isDemo: true,
            createdAt: now,
          },
        ]);
      }
    }
  );
}

/** حذف البيانات التجريبية فقط — لا يقترب من أي بيانات حقيقية */
export async function clearDemo(): Promise<void> {
  // §7: نسخة صامتة قبل أي حذف جماعي (نقطة استرجاع)
  try {
    const { silentBackup } = await import("@/lib/backup");
    await silentBackup("before_bulk_delete");
  } catch {
    /* لا نمنع الحذف إن فشلت النسخة الصامتة */
  }
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
    db.questions,
    db.badges,
    db.requests,
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
