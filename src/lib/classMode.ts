/**
 * منطق «وضع الفصل» النقي (زكريت م٤) — قابل للاختبار بلا واجهة:
 * اختيار أسئلة لعبة الفرق من البنك، وتنسيق الإجابة للعرض على البروجكتور.
 */
import type { AnswerKey, Question } from "@/db/schema";

/** هوية الفرق — لآلئ الخليج: اسم ورمز ولون لكل فريق (صقل زكريت) */
export const TEAM_INFO = [
  { name: "فريق اللؤلؤ", emoji: "🤍", btn: "bg-white text-ink hover:bg-cream", chip: "bg-white/15 border-white/40" },
  { name: "فريق المرجان", emoji: "🪸", btn: "bg-danger text-white hover:bg-[#8f1e18]", chip: "bg-danger/25 border-danger" },
  { name: "فريق الياقوت", emoji: "💎", btn: "bg-teal text-white hover:bg-teal-dark", chip: "bg-teal/25 border-teal" },
  { name: "فريق الزمرد", emoji: "💚", btn: "bg-ok text-white hover:bg-teal-dark", chip: "bg-ok/25 border-ok" },
] as const;

export const TEAM_NAMES = TEAM_INFO.map((t) => t.name);

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
