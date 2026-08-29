/**
 * منطق قوالب الألعاب النقي (زكريت م٤-ب) — كل لعبة تُبنى من بنك الأسئلة
 * للدرس المختار، لا من أسئلة عامة عشوائية (قاعدة الماستر برومبت).
 * قابل للاختبار بلا واجهة: عشوائية قابلة للحقن في كل دالة.
 */
import type { Question } from "@/db/schema";
import { BOOK_GLOSSARY, bookLessonByCode } from "@/content/bookG05S1P1";

/** خلط قابل للحقن */
function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * استخراج المصطلح من نص سؤال تعريف:
 * «عرّفي المخلوط.» → «المخلوط» · «ما وظيفة الجهاز الهضمي؟» → «وظيفة الجهاز الهضمي»
 * يعيد null إن لم يجد نمطاً واضحاً أو كان الناتج طويلاً.
 */
export function extractTerm(text: string): string | null {
  const t = text.trim().replace(/[.؟!]+$/, "");
  const patterns = [
    /^عر[ّ]?في\s*[:：]\s*(.+)$/,
    /^عر[ّ]?في\s+(.+)$/,
    /^اذكري\s+تعريف\s*[:：]?\s+(.+)$/,
    /^ما\s+(?:هي\s+|هو\s+)?(.+)$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const term = m[1].trim();
      if (term.split(/\s+/).length <= 5) return term;
    }
  }
  return null;
}

export interface GamePair {
  /** المصطلح (الوجه الأول) */
  a: string;
  /** التعريف (الوجه الثاني) — مقصوص لطول بطاقة */
  b: string;
}

/** قصّ تعريف لطول يصلح لبطاقة كبيرة */
export function clipDefinition(answer: string, maxWords = 10): string {
  const words = answer.trim().split(/\s+/);
  return words.length <= maxWords ? answer.trim() : words.slice(0, maxWords).join(" ") + "…";
}

/**
 * أزواج (مصطلح ↔ تعريف) من أسئلة التعريف — أساس «طابقي» و«الذاكرة» و«من أنا؟»
 */
export function buildPairs(questions: Question[], max: number, rnd: () => number = Math.random): GamePair[] {
  const pairs: GamePair[] = [];
  for (const q of questions) {
    if (q.deletedAt || q.type !== "define" || typeof q.answerKey !== "string") continue;
    const term = extractTerm(q.text);
    if (!term) continue;
    pairs.push({ a: term, b: clipDefinition(q.answerKey) });
  }
  return shuffle(pairs, rnd).slice(0, max);
}

/**
 * أسئلة تعريف احتياطية من مفردات الدرس + مسرد الكتاب (ص146–149) —
 * تضمن عمل ألعاب التعريف في كل درس حتى لو قلّت أسئلة البنك (§2-ج).
 * لا تُحفظ في قاعدة البيانات؛ تُضاف لمخزون الألعاب في الذاكرة فقط.
 */
export function vocabDefineQuestions(lessonCode: string | undefined, unitId: number, lessonId?: number): Question[] {
  if (!lessonCode) return [];
  const found = bookLessonByCode(lessonCode);
  if (!found) return [];
  const now = Date.now();
  const qs: Question[] = [];
  for (const v of found.lesson.vocab) {
    const entry = BOOK_GLOSSARY.find((g) => g.term === v.term);
    if (!entry) continue;
    qs.push({
      unitId,
      lessonId,
      text: `عرّفي: ${entry.term}.`,
      type: "define",
      answerKey: entry.def,
      marks: 1,
      difficulty: "medium",
      cognitiveLevel: "remember",
      tags: ["من-المسرد"],
      usageCount: 0,
      createdAt: now,
    });
  }
  return qs;
}

/**
 * مخزون أسئلة الألعاب لدرس: أسئلة الدرس أولاً، وتتوسّع للوحدة إن نقصت
 * أسئلة التعريف (<3) أو الترتيب (0)، ثم يكمَّل التعريف من مسرد الكتاب.
 */
export function buildGamePool(
  all: Question[],
  opts: { lessonId?: number; unitId?: number; lessonCode?: string }
): Question[] {
  const live = all.filter((q) => !q.deletedAt);
  const ofLesson = live.filter((q) => q.lessonId === opts.lessonId);
  const defineCount = ofLesson.filter((q) => q.type === "define").length;
  const orderCount = ofLesson.filter((q) => q.type === "order").length;
  let pool = defineCount >= 3 && orderCount >= 1 ? ofLesson : live.filter((q) => q.unitId === opts.unitId);
  if (opts.unitId != null) {
    const covered = new Set(
      pool.filter((q) => q.type === "define").map((q) => extractTerm(q.text)).filter(Boolean)
    );
    const vocabQs = vocabDefineQuestions(opts.lessonCode, opts.unitId, opts.lessonId).filter(
      (q) => !covered.has(extractTerm(q.text))
    );
    pool = [...pool, ...vocabQs];
  }
  return pool;
}

export interface OrderGameData {
  prompt: string;
  /** الترتيب الصحيح */
  correct: string[];
  /** العناصر مخلوطة للعرض */
  shuffled: string[];
}

/**
 * لعبة الترتيب من سؤال نوع order — الإجابة سلسلة بفواصل «←»
 * (هكذا يخزّنها البنك). null إن لم تصلح (أقل من ٣ عناصر).
 */
export function buildOrderGame(q: Question, rnd: () => number = Math.random): OrderGameData | null {
  if (q.type !== "order" || typeof q.answerKey !== "string") return null;
  const correct = q.answerKey.split("←").map((s) => s.trim()).filter(Boolean);
  if (correct.length < 3) return null;
  // نص السؤال قبل القوسين = التعليمة
  const prompt = q.text.split("(")[0].replace(/[:：]\s*$/, "").trim();
  let shuffled = shuffle(correct, rnd);
  // لا نبدأ بالحل جاهزاً
  if (shuffled.join("|") === correct.join("|")) shuffled = [...shuffled.slice(1), shuffled[0]];
  return { prompt, correct, shuffled };
}

export interface MemoryCard {
  id: number;
  pairIndex: number;
  text: string;
  /** مصطلح أم تعريف — للتلوين فقط */
  face: "term" | "definition";
}

/** شبكة بطاقات الذاكرة من الأزواج — كل زوج بطاقتان مخلوطتان */
export function buildMemoryCards(pairs: GamePair[], rnd: () => number = Math.random): MemoryCard[] {
  const cards: MemoryCard[] = [];
  pairs.forEach((p, i) => {
    cards.push({ id: i * 2, pairIndex: i, text: p.a, face: "term" });
    cards.push({ id: i * 2 + 1, pairIndex: i, text: p.b, face: "definition" });
  });
  return shuffle(cards, rnd);
}

/** «من أنا؟»: تلميحات متدرجة من التعريف — نقسمه لجملتين أو ثلاث */
export function buildClues(definition: string): string[] {
  const words = definition.trim().split(/\s+/);
  if (words.length <= 4) return [definition.trim()];
  const third = Math.ceil(words.length / 3);
  const clues = [
    words.slice(0, third).join(" ") + "…",
    words.slice(0, third * 2).join(" ") + "…",
    definition.trim(),
  ];
  // أزيلي التكرار إن كان التعريف قصيراً
  return [...new Set(clues)];
}
