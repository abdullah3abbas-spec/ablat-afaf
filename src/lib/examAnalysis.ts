/**
 * ما بعد الاختبار (§ الأمر ٤ خامساً): معامل صعوبة كل سؤال، نسبة
 * الخطأ الجماعي، تقرير «الدروس التي تحتاج إعادة شرح» (>50% خطأ)،
 * والترحيل التلقائي لدرجة الاختبار إلى مكوّنها في سجل الدرجات.
 */
import { db } from "@/db";
import type { Exam, ExamResult, Question } from "@/db/schema";

export interface QuestionStat {
  question: Question;
  /** معامل السهولة: متوسط الدرجة ÷ درجة السؤال (0..1) — الأدنى أصعب */
  facility: number;
  /** نسبة من أخطأن (حصلن على أقل من نصف درجة السؤال) */
  massErrorPct: number;
  answered: number;
}

export interface ReteachLesson {
  lessonId: number;
  lessonTitle: string;
  /** الأسئلة عالية الخطأ في هذا الدرس */
  hardQuestions: number;
  avgErrorPct: number;
}

export interface ExamAnalysis {
  stats: QuestionStat[];
  /** الدروس التي أخطأ فيها أكثر من 50% */
  reteach: ReteachLesson[];
  average: number;
  resultsCount: number;
}

/** تحليل نتائج اختبار من تفاصيل سؤالاً بسؤال */
export async function analyzeExam(examId: number): Promise<ExamAnalysis> {
  const results = (await db.examResults.where("examId").equals(examId).toArray()).filter((r) => !r.deletedAt);
  const examQs = await db.examQuestions.where("[examId+order]").between([examId, 0], [examId, Infinity]).toArray();
  const questions = (await Promise.all(examQs.map((eq) => db.questions.get(eq.questionId)))).filter(
    (q): q is Question => Boolean(q)
  );

  const stats: QuestionStat[] = [];
  for (const q of questions) {
    let sum = 0;
    let wrong = 0;
    let answered = 0;
    for (const r of results) {
      const pq = r.perQuestion?.find((x) => x.questionId === q.id);
      if (pq) {
        answered++;
        sum += pq.score;
        if (pq.score < q.marks / 2) wrong++;
      }
    }
    stats.push({
      question: q,
      facility: answered > 0 ? Math.round((sum / (answered * q.marks)) * 100) / 100 : 0,
      massErrorPct: answered > 0 ? Math.round((wrong / answered) * 100) : 0,
      answered,
    });
  }

  // تقرير إعادة الشرح: دروس أسئلتها العالية الخطأ (>50%)
  const byLesson = new Map<number, { title: string; errs: number[]; hard: number }>();
  for (const st of stats) {
    const lessonId = st.question.lessonId;
    if (!lessonId || st.answered === 0) continue;
    if (!byLesson.has(lessonId)) {
      const lesson = await db.lessons.get(lessonId);
      byLesson.set(lessonId, { title: lesson?.title ?? "", errs: [], hard: 0 });
    }
    const entry = byLesson.get(lessonId)!;
    entry.errs.push(st.massErrorPct);
    if (st.massErrorPct > 50) entry.hard++;
  }
  const reteach: ReteachLesson[] = [];
  for (const [lessonId, e] of byLesson) {
    const avg = Math.round(e.errs.reduce((a, b) => a + b, 0) / e.errs.length);
    if (e.hard > 0) reteach.push({ lessonId, lessonTitle: e.title, hardQuestions: e.hard, avgErrorPct: avg });
  }
  reteach.sort((a, b) => b.avgErrorPct - a.avgErrorPct);

  const average =
    results.length > 0 ? Math.round((results.reduce((s, r) => s + r.totalScore, 0) / results.length) * 10) / 10 : 0;

  return { stats, reteach, average, resultsCount: results.length };
}

/**
 * الترحيل التلقائي: درجات الاختبار → سجل الدرجات في مكوّنه الصحيح،
 * كدفعة واحدة قابلة للتراجع. آمن التكرار (يحذف ترحيلاً سابقاً لنفس
 * الاختبار قبل الإعادة).
 */
export async function carryResultsToGrades(exam: Exam): Promise<{ carried: number } | { error: "no_component" }> {
  const componentId = exam.carryToComponentId;
  if (!componentId) return { error: "no_component" };

  const results = (await db.examResults.where("examId").equals(exam.id!).toArray()).filter((r) => !r.deletedAt);
  const now = Date.now();

  // إلغاء ترحيل سابق لنفس الاختبار (تصحيح نتائج ثم إعادة ترحيل)
  const prior = (await db.grades.where("sourceExamId").equals(exam.id!).toArray()).filter((g) => !g.deletedAt);
  for (const g of prior) await db.grades.update(g.id!, { deletedAt: now });

  const batchId = await db.gradeBatches.add({
    classId: exam.classId ?? 0,
    gradeComponentId: componentId,
    academicYearId: exam.academicYearId,
    term: exam.term,
    source: "manual",
    sheetCode: `EXAM-${exam.id}`,
    savedCount: results.length,
    createdAt: now,
  });

  let carried = 0;
  for (const r of results) {
    const student = await db.students.get(r.studentId);
    if (!student) continue;
    await db.grades.add({
      studentId: r.studentId,
      classId: student.classId,
      academicYearId: exam.academicYearId,
      term: exam.term,
      gradeComponentId: componentId,
      mark: r.totalScore,
      source: "exam",
      sourceExamId: exam.id,
      batchId,
      createdAt: now,
    });
    carried++;
    if (!r.carriedToGradeId) await db.examResults.update(r.id!, { carriedToGradeId: batchId });
  }
  return { carried };
}

/** حفظ نتيجة طالبة (سؤالاً بسؤال أو إجمالاً) — upsert */
export async function saveResult(
  examId: number,
  studentId: number,
  data: { total: number; perQuestion?: ExamResult["perQuestion"] }
): Promise<void> {
  const existing = (await db.examResults.where("[examId+studentId]").equals([examId, studentId]).toArray()).find(
    (r) => !r.deletedAt
  );
  const now = Date.now();
  if (existing) {
    await db.examResults.update(existing.id!, {
      totalScore: data.total,
      perQuestion: data.perQuestion,
      gradedAt: now,
      updatedAt: now,
    });
  } else {
    await db.examResults.add({
      examId,
      studentId,
      totalScore: data.total,
      perQuestion: data.perQuestion,
      gradedAt: now,
      createdAt: now,
    });
  }
}
