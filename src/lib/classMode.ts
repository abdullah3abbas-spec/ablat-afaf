/**
 * منطق «وضع الفصل» النقي (زكريت م٤) — قابل للاختبار بلا واجهة:
 * اختيار أسئلة لعبة الفرق من البنك، وتنسيق الإجابة للعرض على البروجكتور.
 */
import type { AnswerKey, Question } from "@/db/schema";

/** أسماء الفرق — لآلئ الخليج، تكفي حتى أربعة فرق */
export const TEAM_NAMES = ["فريق اللؤلؤ", "فريق المرجان", "فريق الياقوت", "فريق الزمرد"] as const;

/**
 * اختيار أسئلة اللعبة: أسئلة الدرس أولاً، وإن قلّت كمّلنا من وحدته،
 * بلا مكرر، وبخلطة عشوائية قابلة للحقن (للاختبار).
 */
export function pickGameQuestions(
  all: Question[],
  opts: { lessonId?: number; unitId?: number; count: number; rnd?: () => number }
): Question[] {
  const rnd = opts.rnd ?? Math.random;
  const alive = all.filter((q) => !q.deletedAt);
  const ofLesson = opts.lessonId != null ? alive.filter((q) => q.lessonId === opts.lessonId) : [];
  const ofUnit =
    opts.unitId != null ? alive.filter((q) => q.unitId === opts.unitId && q.lessonId !== opts.lessonId) : [];

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  return [...shuffle(ofLesson), ...shuffle(ofUnit)].slice(0, opts.count);
}

/** تنسيق الإجابة نصاً واحداً واضحاً للعرض الكبير */
export function formatAnswer(answerKey: AnswerKey | undefined, options?: Question["options"]): string {
  if (answerKey == null) return "—";
  if (typeof answerKey === "string") {
    // في الاختيار من متعدد المفتاح رمز الخيار — نعرض نصه كاملاً
    const opt = options?.find((o) => o.key === answerKey);
    return opt ? opt.text : answerKey;
  }
  if (Array.isArray(answerKey)) {
    if (answerKey.length === 0) return "—";
    if (typeof answerKey[0] === "string") return (answerKey as string[]).join(" · ");
    return (answerKey as { left: string; right: string }[]).map((p) => `${p.left} ← ${p.right}`).join("\n");
  }
  if ("order" in answerKey) return answerKey.order.map((s, i) => `${i + 1}) ${s}`).join("\n");
  return "—";
}
