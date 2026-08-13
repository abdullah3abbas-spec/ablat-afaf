/**
 * منطق حزمة الحصة (١٥/١٠) — تحويل أسئلة الحزمة المولّدة إلى أسئلة بنك:
 * الاعتماد يُدخلها البنك فتعمل كل الألعاب وأوراق العمل والكويزات للدرس فوراً.
 */
import type { LessonPackContent, PackQuestion, Question } from "@/db/schema";

/** درجات كل نوع — متوافقة مع أعراف البنك القائمة */
const TYPE_MARKS: Record<PackQuestion["type"], number> = {
  mcq: 1,
  truefalse: 1,
  define: 2,
  fillblank: 2,
  order: 3,
};

/** وسم ثابت يميّز أسئلة الذكاء الاصطناعي في البنك — للفرز والمراجعة */
export const AI_TAG = "مولّد-بالذكاء";

export function packToQuestions(
  pack: LessonPackContent,
  ids: { unitId: number; lessonId: number },
  nowMs: number
): Omit<Question, "id">[] {
  return pack.questions.map((q) => ({
    unitId: ids.unitId,
    lessonId: ids.lessonId,
    text: q.text,
    type: q.type,
    options: q.options,
    answerKey: q.answer,
    marks: TYPE_MARKS[q.type],
    difficulty: q.difficulty,
    cognitiveLevel: q.cognitiveLevel,
    estimatedMinutes: q.type === "order" ? 3 : 1,
    usageCount: 0,
    tags: [AI_TAG],
    createdAt: nowMs,
  }));
}

/** مجموع دقائق الخطة — للتحقق البصري في المراجعة */
export function planMinutes(pack: LessonPackContent): number {
  return pack.plan.stages.reduce((sum, st) => sum + st.minutes, 0);
}
