/**
 * تجميع بيانات «خطة التحضير اليومية» بنموذج الوزارة الحرفي —
 * من درس الكتاب + حزمة الحصة المعتمدة (إن وجدت) + الإثراء المقرَّر.
 * البنية «لا تُمَس»: الحقول والصياغة كما في نموذج أبلة عفاف المرجعي.
 */
import { db } from "@/db";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
import type { Lesson, LessonPackContent } from "@/db/schema";
import { bookLessonByCode } from "@/content/bookG05S1P1";
import { enrichmentByCode } from "@/content/enrichment";
import { MINISTRY_HOMEWORK_CHANNEL, MINISTRY_TIMING } from "@/content/ministryTemplates";

export interface MinistryPlanData {
  schoolName: string;
  teacherName: string;
  yearLabel: string;
  termLabel: string;
  unitLine: string;
  lessonTitle: string;
  classLine: string;
  dateLine: string;
  /** نتاجات التعلم: «B0502.2 أسمّي السلاسل…» */
  outcomes: string[];
  /** المصطلحات والمفاهيم الرئيسة */
  keyTerms: string[];
  bookPagesLine: string;
  warmup: string;
  warmupMinutes: number;
  objectives: string[];
  activities: string[];
  assessment: string;
  activitiesMinutes: number;
  closure: string;
  closureMinutes: number;
  homework: string;
}

const PLACEHOLDER = "تكملها المعلّمة حسب سير الحصة.";

/** بناء بيانات الخطة الوزارية — الحزمة المعتمدة تملأ التفاصيل إن وجدت */
export function buildMinistryPlan(opts: {
  lesson: Lesson;
  unitTitle: string;
  pack?: LessonPackContent | null;
  schoolName: string;
  teacherName: string;
  yearName: string;
  term: 1 | 2;
  classNames: string[];
  dateStr: string;
}): MinistryPlanData {
  const { lesson, unitTitle, pack, schoolName, teacherName, yearName, term, classNames, dateStr } = opts;
  const book = lesson.code ? bookLessonByCode(lesson.code) : undefined;
  const enrichment = lesson.code ? enrichmentByCode(lesson.code) : undefined;

  const outcomes = (lesson.learningOutcomes ?? []).map((o) => `${o.code} ${o.text}`);
  const keyTerms = book?.lesson.vocab.map((v) => `${v.term} (${v.en})`) ?? [];
  const pages = lesson.bookPageStart != null && lesson.bookPageEnd != null
    ? `الكتاب المدرسي ص${lesson.bookPageStart}–${lesson.bookPageEnd}`
    : "الكتاب المدرسي";

  // الأنشطة: من الحزمة المعتمدة، والإثراء المقرَّر يُذكر باسمه ووسيلته
  const activities: string[] = [];
  if (pack) {
    activities.push(`النشاط الافتتاحي: ${pack.opener.title} — ${pack.opener.text}`);
    if (pack.discussion.length > 0) activities.push(`أسئلة النقاش: ${pack.discussion.join(" · ")}`);
    activities.push(`نشاط فردي: ${pack.activityIndividual.title} — ${pack.activityIndividual.text}`);
    activities.push(`نشاط جماعي: ${pack.activityGroup.title} — ${pack.activityGroup.text}`);
  } else if (enrichment) {
    activities.push(`النشاط الجماعي (${enrichment.vehicle}): «${enrichment.title}» — ${enrichment.steps.join(" ← ")}`);
  } else {
    activities.push(PLACEHOLDER);
  }
  if (enrichment && pack) {
    activities.push(`إثراء الحصة (${enrichment.vehicle}): «${enrichment.title}» (${enrichment.minutes} دقيقة)`);
  }

  const assessment = pack
    ? `أسئلة الحزمة المعتمدة (${pack.questions.length} سؤالاً) — تُطرح انتقائياً أثناء الأنشطة، مع أسئلة «أتحقق مما تعلمت» في الكتاب.`
    : "أسئلة «أتحقق مما تعلمت» في نهاية الدرس بالكتاب المدرسي.";

  return {
    schoolName,
    teacherName,
    yearLabel: yearName,
    termLabel: term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني",
    unitLine: unitTitle,
    lessonTitle: lesson.title,
    classLine: classNames.length > 0 ? `الخامس (${classNames.join(" · ")})` : "الخامس",
    dateLine: dateStr,
    outcomes: outcomes.length > 0 ? outcomes : [PLACEHOLDER],
    keyTerms,
    bookPagesLine: pages,
    warmup: pack ? `${pack.opener.title}: ${pack.opener.text}` : (book ? `مراجعة الدرس السابق، ثم النشاط الافتتاحي في الكتاب ص${lesson.bookPageStart ?? ""}.` : PLACEHOLDER),
    warmupMinutes: MINISTRY_TIMING.warmup,
    objectives: pack?.plan.objectives?.length ? pack.plan.objectives : (lesson.objectives ?? [PLACEHOLDER]),
    activities,
    assessment,
    activitiesMinutes: MINISTRY_TIMING.activities,
    closure: pack?.exitTicket.questions.length
      ? `تذكير بأهداف الدرس، ثم كرت الخروج: ${pack.exitTicket.questions.join(" · ")}`
      : "تذكير بأهداف الدرس وحل سؤال ختامي من الكتاب.",
    closureMinutes: MINISTRY_TIMING.closure,
    homework: pack?.homework.tasks.length ? `${MINISTRY_HOMEWORK_CHANNEL} — ${pack.homework.tasks.join(" · ")}` : MINISTRY_HOMEWORK_CHANNEL,
  };
}

/** أيام الأسبوع بالعربية لسطر «اليوم والتاريخ» */
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/**
 * تنزيل التحضير الوزاري لدرس — يجمع كل شيء من قاعدة البيانات
 * (المعلّمة، العام، الفصول، الوحدة) ويستخدم الحزمة المعتمدة إن وجدت.
 */
export async function downloadMinistryPlanForLesson(lesson: Lesson, pack?: LessonPackContent | null): Promise<void> {
  const settings = await db.settings.get(1);
  const unit = await db.units.get(lesson.unitId);
  const year = settings?.currentAcademicYearId != null ? await db.academicYears.get(settings.currentAcademicYearId) : undefined;
  const classNames = (await db.classes.toArray())
    .filter((c) => !c.deletedAt && (year == null || c.academicYearId === year.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => c.name);

  const now = new Date();
  const jsDay = now.getDay(); // 0=الأحد
  const dateStr = `${WEEKDAYS[jsDay]} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const data = buildMinistryPlan({
    lesson,
    unitTitle: unit?.title ?? "",
    pack,
    schoolName: settings?.schoolName || DEFAULT_SCHOOL_NAME,
    teacherName: settings?.teacherName || "عفاف حسين",
    yearName: year?.name ?? "",
    term: settings?.currentTerm === 2 ? 2 : 1,
    classNames,
    dateStr,
  });
  const { downloadMinistryPlanWord } = await import("./planFiles");
  await downloadMinistryPlanWord(data);
}
