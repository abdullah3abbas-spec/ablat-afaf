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
