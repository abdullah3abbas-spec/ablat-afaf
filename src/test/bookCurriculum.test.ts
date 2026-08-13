/**
 * اختبارات المنهج الحقيقي (كتاب الوزارة ف١ ج١):
 * سلامة البنية والصفحات، مقاطع النص، الاسترجاع والبحث الموزون،
 * خريطة الإثراء الـ١٣، وتجميع خطة التحضير الوزارية.
 */
import { describe, expect, test } from "vitest";
import { BOOK_GLOSSARY, BOOK_UNITS, bookLessonByCode, bookLessonByTitle } from "@/content/bookG05S1P1";
import { BOOK_CHUNKS } from "@/content/bookText";
import { APPROVED_GAMES } from "@/content/kitTypes";
import { LESSON_ENRICHMENTS } from "@/content/enrichment";
import { buildBankQuestions, BOOK_BANK_COUNT } from "@/content/questionBank";
import { hitsToSources, lessonBookSources, normalizeArabic, searchBook, searchTokens } from "@/lib/bookRetrieval";
import { buildMinistryPlan } from "@/lib/ministryPlan";
import type { Lesson, LessonPackContent } from "@/db/schema";

const ALL_LESSONS = BOOK_UNITS.flatMap((u) => u.lessons);

describe("بنية الكتاب", () => {
  test("وحدتان و١٣ درساً بصفحات متعاقبة بلا تداخل", () => {
    expect(BOOK_UNITS.length).toBe(2);
    expect(ALL_LESSONS.length).toBe(13);
    for (const unit of BOOK_UNITS) {
      let prevEnd = unit.pageStart - 1;
      for (const lesson of unit.lessons) {
        expect(lesson.pageStart).toBeGreaterThan(prevEnd);
        expect(lesson.pageEnd).toBeGreaterThanOrEqual(lesson.pageStart);
        expect(lesson.pageEnd).toBeLessThanOrEqual(unit.pageEnd);
        prevEnd = lesson.pageEnd;
      }
    }
  });

  test("رموز نواتج كل درس موجودة في نواتج وحدته", () => {
    for (const unit of BOOK_UNITS) {
      const codes = new Set(unit.outcomes.map((o) => o.code));
      for (const lesson of unit.lessons) {
        expect(lesson.outcomeCodes.length).toBeGreaterThan(0);
        for (const c of lesson.outcomeCodes) expect(codes.has(c)).toBe(true);
      }
    }
  });

  test("مفردات الدروس كلها معرَّفة في قاموس الكتاب", () => {
    const glossaryTerms = new Set(BOOK_GLOSSARY.map((g) => g.term));
    for (const lesson of ALL_LESSONS) {
      for (const v of lesson.vocab) expect(glossaryTerms.has(v.term)).toBe(true);
    }
  });

  test("البحث بالرمز والعنوان يعملان", () => {
    expect(bookLessonByCode("1.4")?.lesson.title).toContain("أكثر تعقيداً");
    expect(bookLessonByTitle("ما الدوائر الكهربائية؟")?.lesson.code).toBe("2.1");
    expect(bookLessonByCode("9.9")).toBeUndefined();
  });
});

describe("مقاطع نص الكتاب", () => {
  test("الصفحات فريدة وكل مقطع درس داخل نطاق درسه", () => {
    const pages = BOOK_CHUNKS.map((c) => c.page);
    expect(new Set(pages).size).toBe(pages.length);
    for (const chunk of BOOK_CHUNKS) {
      expect(chunk.text.length).toBeGreaterThan(20);
      if (chunk.lessonCode) {
        const found = bookLessonByCode(chunk.lessonCode);
        expect(found).toBeDefined();
        expect(chunk.page).toBeGreaterThanOrEqual(found!.lesson.pageStart);
        expect(chunk.page).toBeLessThanOrEqual(found!.lesson.pageEnd);
      }
    }
  });

  test("كل درس له مقاطع نصية فعلية", () => {
    for (const lesson of ALL_LESSONS) {
      const count = BOOK_CHUNKS.filter((c) => c.lessonCode === lesson.code).length;
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("الاسترجاع والبحث", () => {
  test("التطبيع يوحّد الهمزات والياء ويسقط أل التعريف", () => {
    expect(normalizeArabic("الدَّائِرة")).toBe("الدايره");
    expect(searchTokens("الدوائر الكهربائية")).toEqual(["دواير", "كهربايي" + "ه"]);
  });

  test("البحث عن المفترس والفريسة يعيد صفحات وحدة السلاسل الغذائية", async () => {
    const hits = await searchBook("المفترس والفريسة في السلسلة الغذائية", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.unitOrder).toBe(1);
    const sources = hitsToSources(hits);
    expect(sources[0].locator).toMatch(/^ص\d+$/);
    expect(sources[0].text).toContain("【ص");
  });

  test("البحث عن دائرة التوالي يعيد صفحات الوحدة الثانية", async () => {
    const hits = await searchBook("دائرة التوالي والتوازي", 4);
    expect(hits[0].chunk.unitOrder).toBe(2);
  });

  test("مصادر الدرس تشمل نواتج الوحدة وصفحات الدرس باستشهاداتها", async () => {
    const sources = await lessonBookSources("1.2");
    expect(sources[0].name).toContain("نواتج الوحدة");
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const src of sources.slice(1)) {
      expect(src.locator).toMatch(/^ص\d+([–-]\d+)?$/);
    }
    const joined = sources.map((s) => s.text).join("\n");
    expect(joined).toContain("سلسلة غذائية");
  });
});

describe("خريطة الإثراء الـ١٣", () => {
  test("إثراء واحد لكل درس من دروس الكتاب", () => {
    expect(LESSON_ENRICHMENTS.length).toBe(13);
    const codes = LESSON_ENRICHMENTS.map((e) => e.lessonCode).sort();
    expect(codes).toEqual(ALL_LESSONS.map((l) => l.code).sort());
  });

  test("كل إثراء مكتمل: سبب وخطوات وأدوات ونقاش، والزمن ≤ ٢٠ دقيقة", () => {
    for (const e of LESSON_ENRICHMENTS) {
      expect(e.why.length).toBeGreaterThan(30);
      expect(e.steps.length).toBeGreaterThanOrEqual(3);
      expect(e.materials.length).toBeGreaterThan(0);
      expect(e.debrief.length).toBeGreaterThanOrEqual(2);
      expect(e.minutes).toBeLessThanOrEqual(20);
      if (e.vehicle === "قصة") expect(e.story?.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("الألعاب من قائمة الألعاب الاثنتي عشرة المعتمدة فقط (§2-ج)", () => {
    for (const e of LESSON_ENRICHMENTS.filter((x) => x.vehicle === "لعبة")) {
      const named = APPROVED_GAMES.some((g) => e.title.includes(g));
      expect(named).toBe(true);
    }
  });
});

describe("بنك أسئلة الكتاب", () => {
  test("يُبنى كاملاً حين تتوفر كل الدروس، وكل سؤال موثّق بصفحة وناتج", () => {
    const map = new Map(ALL_LESSONS.map((l, i) => [l.code, { id: i + 1, unitId: l.code.startsWith("1") ? 1 : 2 }]));
    const rows = buildBankQuestions(map);
    expect(rows.length).toBe(BOOK_BANK_COUNT);
    expect(BOOK_BANK_COUNT).toBeGreaterThanOrEqual(70);
    const codes = new Set(rows.map((r) => r.learningOutcomeCode));
    expect(codes.size).toBeGreaterThanOrEqual(12);
    for (const lesson of ALL_LESSONS) {
      const lessonRows = rows.filter((r) => r.lessonId === map.get(lesson.code)!.id);
      expect(lessonRows.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("درس ناقص من الخريطة → تُسقط أسئلته ولا ينهار البناء", () => {
    const map = new Map([["1.1", { id: 1, unitId: 1 }]]);
    const rows = buildBankQuestions(map);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.lessonId === 1)).toBe(true);
  });
});

describe("خطة التحضير الوزارية", () => {
  const lesson: Lesson = {
    id: 5,
    unitId: 1,
    subjectId: 1,
    title: "كيف أستطيع أن أبني سلاسل غذائية أكثر تعقيداً؟",
    order: 4,
    code: "1.4",
    bookPageStart: 38,
    bookPageEnd: 47,
    learningOutcomes: [{ code: "B0502.3", text: "أنشئ السلاسل الغذائية وأسمّيها بثلاثة مستويات أو أكثر." }],
    objectives: ["أبني السلاسل الغذائية المكوّنة من أكثر من ثلاثة مستويات."],
    createdAt: 0,
  };
  const base = {
    lesson,
    unitTitle: "السلاسل الغذائية",
    schoolName: "مدرسة زكريت",
    teacherName: "عفاف حسين",
    yearName: "2026/2027",
    term: 1 as const,
    classNames: ["خامس ١", "خامس ٢"],
    dateStr: "الأحد 1/9/2026",
  };

  test("بلا حزمة: توقيت الوزارة ٥/٣٠/٥ والواجب على نظام قطر والصفحات مذكورة", () => {
    const d = buildMinistryPlan(base);
    expect(d.warmupMinutes).toBe(5);
    expect(d.activitiesMinutes).toBe(30);
    expect(d.closureMinutes).toBe(5);
    expect(d.homework).toContain("نظام قطر للتعليم");
    expect(d.bookPagesLine).toBe("الكتاب المدرسي ص38–47");
    expect(d.termLabel).toBe("الفصل الدراسي الأول");
    expect(d.classLine).toBe("الخامس (خامس ١ · خامس ٢)");
    // الإثراء المقرَّر للدرس 1.4 (المحطات) يظهر نشاطاً جماعياً
    expect(d.activities.join(" ")).toContain("محطات");
  });

  test("بحزمة معتمدة: الأنشطة والتقويم والغلق من الحزمة", () => {
    const pack: LessonPackContent = {
      plan: { objectives: ["هدف ١", "هدف ٢"], stages: [{ name: "التهيئة", minutes: 5, what: "..." }] },
      opener: { title: "لغز السلسلة", text: "من يأكل من؟", minutes: 5 },
      discussion: ["سؤال ١"],
      activityIndividual: { title: "فردي", text: "حل ص40" },
      activityGroup: { title: "جماعي", text: "محطات التعلم" },
      questions: [
        { type: "truefalse", text: "س", answer: "صواب", difficulty: "easy", cognitiveLevel: "remember" },
      ],
      exitTicket: { questions: ["ما المستويات؟"] },
      homework: { tasks: ["مهمة"] },
      teacherNotes: { say: "", misconceptions: [], materials: [] },
      sources: [],
    };
    const d = buildMinistryPlan({ ...base, pack });
    expect(d.objectives).toEqual(["هدف ١", "هدف ٢"]);
    expect(d.warmup).toContain("لغز السلسلة");
    expect(d.activities.join(" ")).toContain("محطات التعلم");
    expect(d.assessment).toContain("1");
    expect(d.closure).toContain("ما المستويات؟");
    expect(d.homework).toContain("مهمة");
  });
});
