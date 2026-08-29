/**
 * اختبارات منطق قوالب الألعاب (زكريت م٤-ب):
 * استخراج المصطلح، بناء الأزواج، لعبة الترتيب، بطاقات الذاكرة، التلميحات
 * — وحالة الماء في المختبر التفاعلي.
 */
import { describe, expect, it } from "vitest";
import type { Question } from "@/db/schema";
import {
  buildClues,
  buildMemoryCards,
  buildOrderGame,
  buildPairs,
  clipDefinition,
  extractTerm,
} from "@/lib/classGames";
import { waterStateOf } from "@/pages/LabPage";

const fixedRnd = () => 0.4;

function defineQ(id: number, text: string, answer: string, deletedAt?: number): Question {
  return {
    id, unitId: 1, lessonId: 1, text, type: "define", answerKey: answer,
    marks: 2, difficulty: "easy", cognitiveLevel: "remember", usageCount: 0,
    createdAt: 0, updatedAt: 0, deletedAt,
  } as Question;
}

describe("extractTerm — استخراج المصطلح من سؤال التعريف", () => {
  it("يفهم «عرّفي» و«ما» بأشكالها", () => {
    expect(extractTerm("عرّفي المخلوط.")).toBe("المخلوط");
    expect(extractTerm("عرفي التغيّر الفيزيائي.")).toBe("التغيّر الفيزيائي");
    expect(extractTerm("ما وظيفة الجهاز الهضمي؟")).toBe("وظيفة الجهاز الهضمي");
  });

  it("يرفض ما لا نمط له أو ما طال", () => {
    expect(extractTerm("اشرحي بالتفصيل خطوات فصل الملح عن الماء بالتبخير")).toBeNull();
    expect(extractTerm("ما الفرق بين التغيّر الفيزيائي والتغيّر الكيميائي مع مثال لكل منهما")).toBeNull();
  });
});

describe("buildPairs — أزواج المصطلح والتعريف", () => {
  const qs = [
    defineQ(1, "عرّفي المادة.", "كل ما له كتلة ويشغل حيّزاً"),
    defineQ(2, "عرّفي المخلوط.", "مادتان أو أكثر مخلوطتان معاً"),
    defineQ(3, "عرّفي الذوبان.", "تفرّق جزيئات مادة بين جزيئات مادة أخرى", 99), // محذوف
    { ...defineQ(4, "رتّبي الخطوات", "أ ← ب ← ج"), type: "order" } as Question, // نوع آخر
  ];

  it("يبني من التعريفات فقط ويستبعد المحذوف والأنواع الأخرى", () => {
    const pairs = buildPairs(qs, 10, fixedRnd);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((p) => p.a).sort()).toEqual(["المادة", "المخلوط"]);
  });

  it("يقصّ التعريف الطويل لبطاقة", () => {
    expect(clipDefinition("واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة أحد عشر", 5)).toBe("واحد اثنان ثلاثة أربعة خمسة…");
  });
});

describe("buildOrderGame — لعبة الترتيب من إجابة «←»", () => {
  const q = {
    ...defineQ(5, "رتّبي حالات الماء من الأكثر تقارباً: (بخار — ثلج — ماء)", "الثلج ← الماء السائل ← بخار الماء"),
    type: "order",
  } as Question;

  it("يقرأ الترتيب الصحيح ويخلط العرض بلا حل جاهز", () => {
    const g = buildOrderGame(q, fixedRnd)!;
    expect(g.correct).toEqual(["الثلج", "الماء السائل", "بخار الماء"]);
    expect(g.shuffled).toHaveLength(3);
    expect(g.shuffled.join("|")).not.toBe(g.correct.join("|"));
    expect(g.prompt.startsWith("رتّبي حالات الماء")).toBe(true);
  });

  it("يرفض أقل من ٣ عناصر أو نوعاً آخر", () => {
    expect(buildOrderGame({ ...q, answerKey: "أ ← ب" } as Question)).toBeNull();
    expect(buildOrderGame(defineQ(6, "عرّفي.", "تعريف"))).toBeNull();
  });
});

describe("buildMemoryCards — شبكة الذاكرة", () => {
  it("بطاقتان لكل زوج بهوية زوج صحيحة", () => {
    const cards = buildMemoryCards([{ a: "المادة", b: "كل ما له كتلة" }, { a: "المخلوط", b: "مادتان معاً" }], fixedRnd);
    expect(cards).toHaveLength(4);
    const byPair = [0, 1].map((i) => cards.filter((c) => c.pairIndex === i));
    for (const g of byPair) {
      expect(g).toHaveLength(2);
      expect(g.map((c) => c.face).sort()).toEqual(["definition", "term"]);
    }
  });
});

describe("buildClues — تلميحات «من أنا؟» المتدرجة", () => {
  it("ثلاثة تلميحات يتوسع كل منها عن سابقه", () => {
    const clues = buildClues("مادتان أو أكثر مخلوطتان معاً وتحتفظ كل مادة بخصائصها");
    expect(clues.length).toBeGreaterThanOrEqual(2);
    expect(clues[clues.length - 1]).toContain("بخصائصها");
    expect(clues[0].length).toBeLessThan(clues[clues.length - 1].length);
  });

  it("التعريف القصير تلميح واحد", () => {
    expect(buildClues("كل ما له كتلة")).toHaveLength(1);
  });
});

describe("waterStateOf — حالة الماء في المحاكاة", () => {
  it("حدود التحول عند صفر ومئة", () => {
    expect(waterStateOf(-10)).toBe("ice");
    expect(waterStateOf(0)).toBe("ice");
    expect(waterStateOf(5)).toBe("liquid");
    expect(waterStateOf(99)).toBe("liquid");
    expect(waterStateOf(100)).toBe("steam");
  });
});

// ═══════ إصلاح أغسطس ٢٠٢٦: صيغة «عرّفي:» + مخزون يضمن عمل الألعاب في كل درس ═══════
import { buildGamePool, vocabDefineQuestions } from "@/lib/classGames";
import { BOOK_UNITS } from "@/content/bookG05S1P1";
import { buildBankQuestions } from "@/content/questionBank";

/** بنك الكتاب كاملاً بمعرّفات دروس اصطناعية (كما تزرعه seed) */
function bookBank(): { all: Question[]; lessons: { id: number; unitId: number; code: string }[] } {
  const byCode = new Map<string, { id: number; unitId: number }>();
  const lessons: { id: number; unitId: number; code: string }[] = [];
  let id = 1;
  BOOK_UNITS.forEach((u, ui) =>
    u.lessons.forEach((l) => {
      byCode.set(l.code, { id, unitId: ui + 1 });
      lessons.push({ id, unitId: ui + 1, code: l.code });
      id++;
    })
  );
  return { all: buildBankQuestions(byCode), lessons };
}

describe("extractTerm — صيغة الكتاب «عرّفي: المصطلح.»", () => {
  it("يقرأ صيغة النقطتين الرأسيتين", () => {
    expect(extractTerm("عرّفي: آكل العشب.")).toBe("آكل العشب");
    expect(extractTerm("عرّفي: القارت.")).toBe("القارت");
  });

  it("الصيغ القديمة ما زالت تعمل", () => {
    expect(extractTerm("عرّفي المخلوط.")).toBe("المخلوط");
    expect(extractTerm("اذكري تعريف المادة.")).toBe("المادة");
  });
});

describe("vocabDefineQuestions — احتياطي مسرد الكتاب", () => {
  it("درس 1.1 ينتج ٣ أسئلة تعريف فأكثر من مفرداته", () => {
    const qs = vocabDefineQuestions("1.1", 1, 5);
    expect(qs.length).toBeGreaterThanOrEqual(3);
    for (const q of qs) {
      expect(q.type).toBe("define");
      expect(extractTerm(q.text)).toBeTruthy();
      expect(typeof q.answerKey).toBe("string");
      expect((q.answerKey as string).length).toBeGreaterThan(5);
      expect(q.lessonId).toBe(5);
      expect(q.unitId).toBe(1);
    }
  });

  it("درس بلا رمز أو برمز مجهول يعيد قائمة فارغة", () => {
    expect(vocabDefineQuestions(undefined, 1)).toEqual([]);
    expect(vocabDefineQuestions("9.9", 1)).toEqual([]);
  });
});

describe("buildGamePool — كل درس من الكتاب يشغّل كل الألعاب", () => {
  const { all, lessons } = bookBank();
  const rnd = () => 0.42;

  for (const l of lessons) {
    it(`درس ${l.code}: ≥3 أزواج تعريف وسؤال ترتيب صالح`, () => {
      const pool = buildGamePool(all, { lessonId: l.id, unitId: l.unitId, lessonCode: l.code });
      // «طابقي وصنّفي» و«بطاقات الذاكرة» تحتاجان ٣ أزواج
      expect(buildPairs(pool, 6, rnd).length).toBeGreaterThanOrEqual(3);
      // «رتّبي الخطوات» تحتاج سؤال ترتيب واحداً بإجابة ≥3 عناصر
      const orderGames = pool.filter((q) => q.type === "order").map((q) => buildOrderGame(q, rnd)).filter(Boolean);
      expect(orderGames.length).toBeGreaterThanOrEqual(1);
      // «من أنا؟» يكفيها زوج واحد — مغطاة ضمناً بالشرط الأول
    });
  }

  it("لا يكرّر مصطلحاً موجوداً في البنك", () => {
    const l = lessons.find((x) => x.code === "1.1")!;
    const pool = buildGamePool(all, { lessonId: l.id, unitId: l.unitId, lessonCode: l.code });
    const terms = pool.filter((q) => q.type === "define").map((q) => extractTerm(q.text)).filter(Boolean);
    expect(new Set(terms).size).toBe(terms.length);
  });
});
