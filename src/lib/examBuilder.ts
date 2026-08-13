/**
 * خوارزمية بناء الاختبار (§ الأمر ٤ ثالثاً):
 * اختيار تلقائي من البنك حسب نسب المستويات المعرفية وتوزيع الوحدات
 * (بعدد الحصص)، مع استبعاد المستخدم في آخر سنتين، وموازنات حية
 * (مجموع الدرجات، الزمن المقدّر، تحذيرات الاختلال)، ونسختا أ/ب
 * بخلط مضبوط البذرة مع نموذج إجابة لكل نسخة.
 */
import { db } from "@/db";
import type { CognitiveLevel, Question, QuestionOption, Unit } from "@/db/schema";

/** استبعاد الأسئلة المستخدمة خلال هذه المدة (سنتان) */
export const EXCLUDE_USED_WITHIN_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const COG_ORDER: CognitiveLevel[] = ["remember", "understand", "apply", "higher"];

export interface BuilderInput {
  unitIds: number[];
  totalMarks: number;
  durationMinutes: number;
  /** نسب المستويات المعرفية (مجموعها 100) */
  cognitivePct: Record<CognitiveLevel, number>;
  /** أوزان الوحدات (مجموعها 100) — الافتراضي بحسب عدد الحصص */
  unitPct: Record<number, number>;
  nowMs?: number;
}

/** أوزان الوحدات الافتراضية بحسب عدد الحصص */
export function defaultUnitPct(units: Unit[], selected: number[]): Record<number, number> {
  const chosen = units.filter((u) => selected.includes(u.id!));
  const totalSessions = chosen.reduce((s, u) => s + (u.sessionsCount ?? 1), 0);
  const pct: Record<number, number> = {};
  let acc = 0;
  chosen.forEach((u, i) => {
    if (i === chosen.length - 1) {
      pct[u.id!] = 100 - acc;
    } else {
      const p = Math.round(((u.sessionsCount ?? 1) / totalSessions) * 100);
      pct[u.id!] = p;
      acc += p;
    }
  });
  return pct;
}

export interface BudgetCheck {
  marksSum: number;
  minutesSum: number;
  marksOk: boolean;
  timeOk: boolean;
  /** تحذيرات عربية جاهزة للعرض */
  warnings: string[];
  /** انحراف توزيع المستويات الفعلي عن المطلوب */
  cogActualPct: Record<CognitiveLevel, number>;
}

/** فحص موازنات مجموعة أسئلة مقابل مدخلات الاختبار */
export function checkBudgets(questions: Question[], input: Pick<BuilderInput, "totalMarks" | "durationMinutes" | "cognitivePct">): BudgetCheck {
  const marksSum = questions.reduce((s, q) => s + q.marks, 0);
  const minutesSum = questions.reduce((s, q) => s + (q.estimatedMinutes ?? 2), 0);
  const warnings: string[] = [];

  const cogMarks: Record<CognitiveLevel, number> = { remember: 0, understand: 0, apply: 0, higher: 0 };
  for (const q of questions) cogMarks[q.cognitiveLevel] += q.marks;
  const cogActualPct = { ...cogMarks };
  for (const k of COG_ORDER) {
    cogActualPct[k] = marksSum > 0 ? Math.round((cogMarks[k] / marksSum) * 100) : 0;
  }

  const marksOk = marksSum === input.totalMarks;
  if (!marksOk) {
    warnings.push(
      marksSum > input.totalMarks
        ? `مجموع الدرجات ${marksSum} يتجاوز الدرجة الكلية ${input.totalMarks}`
        : `مجموع الدرجات ${marksSum} أقل من الدرجة الكلية ${input.totalMarks}`
    );
  }
  const timeOk = minutesSum <= input.durationMinutes;
  if (!timeOk) warnings.push(`الزمن المقدّر ${minutesSum} دقيقة يتجاوز زمن الاختبار ${input.durationMinutes}`);

  for (const k of COG_ORDER) {
    const diff = Math.abs(cogActualPct[k] - input.cognitivePct[k]);
    if (diff > 15) warnings.push(`اختلال توازن: مستوى «${COG_AR[k]}» فعلياً ${cogActualPct[k]}٪ والمطلوب ${input.cognitivePct[k]}٪`);
  }

  return { marksSum, minutesSum, marksOk, timeOk, warnings, cogActualPct };
}

export const COG_AR: Record<CognitiveLevel, string> = {
  remember: "تذكّر",
  understand: "فهم",
  apply: "تطبيق",
  higher: "مهارات عليا",
};

export interface AutoPickResult {
  picked: Question[];
  /** لكل سؤال: بدائل متاحة للاستبدال اليدوي */
  alternativesFor: (q: Question) => Question[];
  pool: Question[];
  excludedRecentlyUsed: number;
}

/**
 * الاختيار التلقائي: يوزّع درجات المستويات على الوحدات، ثم يلتقط
 * الأسئلة الأقرب لهدف الدرجات لكل خلية (مستوى×وحدة) بترتيب أقل
 * استخداماً فالأحدث إضافة، مع استبعاد المستخدم في آخر سنتين.
 */
export async function autoPick(input: BuilderInput): Promise<AutoPickResult> {
  const now = input.nowMs ?? Date.now();
  const all = (await db.questions.toArray()).filter(
    (q) => !q.deletedAt && input.unitIds.includes(q.unitId)
  );
  const cutoff = now - EXCLUDE_USED_WITHIN_MS;
  const pool = all.filter((q) => !q.lastUsedDate || q.lastUsedDate < cutoff);
  const excludedRecentlyUsed = all.length - pool.length;

  const picked: Question[] = [];
  const used = new Set<number>();

  for (const cog of COG_ORDER) {
    const cogTarget = Math.round((input.cognitivePct[cog] / 100) * input.totalMarks);
    if (cogTarget <= 0) continue;
    for (const unitId of input.unitIds) {
      const target = Math.round((input.unitPct[unitId] / 100) * cogTarget);
      if (target <= 0) continue;
      let acc = 0;
      const candidates = pool
        .filter((q) => q.unitId === unitId && q.cognitiveLevel === cog && !used.has(q.id!))
        .sort((a, b) => a.usageCount - b.usageCount || b.createdAt - a.createdAt);
      for (const q of candidates) {
        if (acc >= target) break;
        // لا نلتقط سؤالاً يفجّر الهدف بأكثر من درجته الصغرى الممكنة
        if (acc + q.marks <= target + 1) {
          picked.push(q);
          used.add(q.id!);
          acc += q.marks;
        }
      }
    }
  }

  // ضبط أخير نحو الدرجة الكلية.
  // أولاً: قصّ أي تجاوز — مجموع الأسئلة لا يتخطى درجة الاختبار المعلنة أبداً
  // (سماحية +1 في كل خلية مستوى×وحدة قد تتراكم فوق الدرجة الكلية).
  let sum = picked.reduce((s, q) => s + q.marks, 0);
  while (sum > input.totalMarks && picked.length > 0) {
    const overshoot = sum - input.totalMarks;
    const byMarks = [...picked].sort((a, b) => a.marks - b.marks);
    // أصغر سؤال يكفي حذفه وحده لإزالة التجاوز — يقلّل النقص الناتج؛
    // وإلا أكبر الملتقطة ليتقلص التجاوز بأسرع خطوة
    const removable = byMarks.find((q) => q.marks >= overshoot) ?? byMarks[byMarks.length - 1];
    picked.splice(picked.indexOf(removable), 1);
    sum -= removable.marks;
    // يبقى في used فلا يعود كمكمّل — التعبئة أدناه تكمل بأسئلة أصغر
  }
  if (sum < input.totalMarks) {
    const fillers = pool
      .filter((q) => !used.has(q.id!))
      .sort((a, b) => a.marks - b.marks || a.usageCount - b.usageCount);
    for (const q of fillers) {
      if (sum >= input.totalMarks) break;
      if (sum + q.marks <= input.totalMarks) {
        picked.push(q);
        used.add(q.id!);
        sum += q.marks;
      }
    }
  }

  const alternativesFor = (q: Question) =>
    pool
      .filter(
        (x) =>
          !used.has(x.id!) &&
          x.unitId === q.unitId &&
          x.cognitiveLevel === q.cognitiveLevel &&
          Math.abs(x.marks - q.marks) <= 1
      )
      .sort((a, b) => a.usageCount - b.usageCount)
      .slice(0, 6);

  return { picked, alternativesFor, pool, excludedRecentlyUsed };
}

// ── نسختا أ/ب — خلط مضبوط البذرة ─────────────────────────────

/** مولّد عشوائي مضبوط (mulberry32) — نفس البذرة = نفس الترتيب دائماً */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(arr: T[], rnd: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface VariantQuestion {
  question: Question;
  /** خيارات معاد ترتيبها (للاختيار من متعدد) */
  options?: QuestionOption[];
  /** مفتاح الإجابة الصحيحة بعد الخلط */
  correctKey?: string;
}

/**
 * توليد نسخة (أ أو ب): ترتيب أسئلة مختلف وخيارات مخلوطة،
 * مع إعادة ترقيم مفاتيح الخيارات (أ ب ج د) وتتبع الإجابة الصحيحة.
 */
export function buildVariant(questions: Question[], seed: number): VariantQuestion[] {
  const rnd = seededRandom(seed);
  const ordered = shuffleWith(questions, rnd);
  const KEYS = ["أ", "ب", "ج", "د", "هـ", "و"];
  return ordered.map((question) => {
    if (question.type === "mcq" && question.options && question.options.length > 1) {
      const shuffled = shuffleWith(question.options, rnd);
      const relabeled = shuffled.map((opt, i) => ({ key: KEYS[i], text: opt.text }));
      const correctIdx = shuffled.findIndex((opt) => opt.key === (question.answerKey as string));
      return { question, options: relabeled, correctKey: KEYS[correctIdx] ?? undefined };
    }
    return { question };
  });
}

/** تعليم الأسئلة مستخدمةً بعد التوليد (عدّاد وتاريخ) */
export async function markQuestionsUsed(questionIds: number[], atMs: number): Promise<void> {
  for (const id of questionIds) {
    const q = await db.questions.get(id);
    if (q) {
      await db.questions.update(id, { usageCount: (q.usageCount ?? 0) + 1, lastUsedDate: atMs });
    }
  }
}
