/**
 * اختبارات الأمر ٤: خوارزمية البناء (النسب والاستبعاد والموازنات)،
 * خلط النسختين بتتبع الإجابة، التحليل (صعوبة/خطأ جماعي/إعادة شرح)،
 * والترحيل الآمن للتكرار.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import type { Question } from "@/db/schema";
import {
  autoPick,
  buildVariant,
  checkBudgets,
  defaultUnitPct,
  EXCLUDE_USED_WITHIN_MS,
  seededRandom,
  shuffleWith,
} from "@/lib/examBuilder";
import { analyzeExam, carryResultsToGrades, saveResult } from "@/lib/examAnalysis";
import { ensureGradeComponents } from "@/lib/gradeComponents";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("بنك الأسئلة المبذور", () => {
  test("مبذور بكل الأنواع الأحد عشر تقريباً وبعدد كافٍ", async () => {
    const all = (await db.questions.toArray()).filter((q) => !q.deletedAt);
    expect(all.length).toBeGreaterThanOrEqual(80);
    const types = new Set(all.map((q) => q.type));
    for (const t of ["mcq", "truefalse", "matching", "fillblank", "define", "order", "readchart", "drawlabel", "justify", "shortessay", "inquiry"]) {
      expect(types.has(t as never), `النوع ${t} غير موجود`).toBe(true);
    }
    const cogs = new Set(all.map((q) => q.cognitiveLevel));
    expect(cogs.size).toBe(4);
  });
});

describe("أوزان الوحدات وموازنات البناء", () => {
  test("الأوزان الافتراضية بحسب عدد الحصص ومجموعها 100", async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt);
    const pct = defaultUnitPct(units, units.map((u) => u.id!));
    const sum = Object.values(pct).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  test("فحص الموازنات: مجموع ناقص وزمن زائد وتحذير اختلال", () => {
    const qs = [
      { marks: 5, estimatedMinutes: 30, cognitiveLevel: "remember" },
      { marks: 5, estimatedMinutes: 30, cognitiveLevel: "remember" },
    ] as Question[];
    const check = checkBudgets(qs, {
      totalMarks: 20,
      durationMinutes: 45,
      cognitivePct: { remember: 40, understand: 35, apply: 20, higher: 5 },
    });
    expect(check.marksSum).toBe(10);
    expect(check.marksOk).toBe(false);
    expect(check.timeOk).toBe(false);
    expect(check.warnings.length).toBeGreaterThanOrEqual(2);
    expect(check.cogActualPct.remember).toBe(100);
  });
});

describe("الاختيار التلقائي", () => {
  test("يقارب الدرجة الكلية ويستبعد المستخدم حديثاً", async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt);
    const unitIds = units.map((u) => u.id!);
    const input = {
      unitIds,
      totalMarks: 20,
      durationMinutes: 45,
      cognitivePct: { remember: 40, understand: 35, apply: 20, higher: 5 } as const,
      unitPct: defaultUnitPct(units, unitIds),
    };

    const r1 = await autoPick(input);
    const sum1 = r1.picked.reduce((s, q) => s + q.marks, 0);
    expect(sum1).toBeGreaterThanOrEqual(input.totalMarks - 2);
    expect(sum1).toBeLessThanOrEqual(input.totalMarks);
    expect(r1.excludedRecentlyUsed).toBe(0);

    // علّمي نصف المختار مستخدماً الآن → يُستبعد في السحب التالي
    const usedIds = r1.picked.slice(0, 5).map((q) => q.id!);
    for (const id of usedIds) await db.questions.update(id, { lastUsedDate: Date.now() });

    const r2 = await autoPick(input);
    expect(r2.excludedRecentlyUsed).toBe(5);
    for (const q of r2.picked) expect(usedIds).not.toContain(q.id);

    // المستخدم قبل أكثر من سنتين يعود متاحاً
    for (const id of usedIds) await db.questions.update(id, { lastUsedDate: Date.now() - EXCLUDE_USED_WITHIN_MS - 1000 });
    const r3 = await autoPick(input);
    expect(r3.excludedRecentlyUsed).toBe(0);

    // تنظيف
    for (const id of usedIds) await db.questions.update(id, { lastUsedDate: undefined });
  });

  test("البدائل من نفس الوحدة والمستوى وبدرجة متقاربة", async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt);
    const unitIds = units.map((u) => u.id!);
    const r = await autoPick({
      unitIds,
      totalMarks: 15,
      durationMinutes: 30,
      cognitivePct: { remember: 50, understand: 50, apply: 0, higher: 0 },
      unitPct: defaultUnitPct(units, unitIds),
    });
    const target = r.picked[0];
    const alts = r.alternativesFor(target);
    for (const alt of alts) {
      expect(alt.unitId).toBe(target.unitId);
      expect(alt.cognitiveLevel).toBe(target.cognitiveLevel);
      expect(Math.abs(alt.marks - target.marks)).toBeLessThanOrEqual(1);
      expect(r.picked.map((p) => p.id)).not.toContain(alt.id);
    }
  });
});

describe("نسختا أ/ب", () => {
  test("الخلط مضبوط البذرة: نفس البذرة نفس الترتيب، وبذرتان ترتيبان", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const a1 = shuffleWith(arr, seededRandom(42));
    const a2 = shuffleWith(arr, seededRandom(42));
    const b = shuffleWith(arr, seededRandom(43));
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
    expect([...a1].sort((x, y) => x - y)).toEqual(arr);
  });

  test("خلط خيارات الاختيار من متعدد يتتبع الإجابة الصحيحة", async () => {
    const mcqs = (await db.questions.toArray()).filter((q) => q.type === "mcq" && q.options);
    const variant = buildVariant(mcqs, 7);
    for (const vq of variant) {
      const original = vq.question;
      const correctText = original.options!.find((o) => o.key === original.answerKey)!.text;
      const relabeled = vq.options!.find((o) => o.key === vq.correctKey)!;
      expect(relabeled.text).toBe(correctText);
    }
  });
});

describe("التحليل والترحيل", () => {
  test("معامل الصعوبة والخطأ الجماعي وإعادة الشرح والترحيل الآمن", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const comps = await ensureGradeComponents(year.id!, 1);
    const quizComp = comps.find((c) => c.key === "short")!;
    const klass = (await db.classes.toArray())[0];
    const students = (await db.students.where("classId").equals(klass.id!).toArray()).slice(0, 4);

    // اختبار من سؤالين من البنك
    const qs = (await db.questions.toArray()).filter((q) => !q.deletedAt).slice(0, 2);
    const examId = await db.exams.add({
      title: "كويز اختبار التحليل",
      typeKey: "quiz",
      academicYearId: year.id!,
      term: 1,
      classId: klass.id!,
      unitIds: [qs[0].unitId],
      totalMarks: qs[0].marks + qs[1].marks,
      durationMinutes: 10,
      cognitiveDistribution: { remember: 100, understand: 0, apply: 0, higher: 0 },
      status: "administered",
      carryToComponentId: quizComp.id,
      createdAt: Date.now(),
    });
    await db.examQuestions.bulkAdd(qs.map((q, i) => ({ examId, questionId: q.id!, order: i + 1, marks: q.marks })));

    // النتائج: الكل أصبن س١، وثلاث من أربع أخطأن س٢ (75% خطأ جماعي)
    for (const [i, st] of students.entries()) {
      await saveResult(examId, st.id!, {
        total: qs[0].marks + (i === 0 ? qs[1].marks : 0),
        perQuestion: [
          { questionId: qs[0].id!, score: qs[0].marks },
          { questionId: qs[1].id!, score: i === 0 ? qs[1].marks : 0 },
        ],
      });
    }

    const analysis = await analyzeExam(examId);
    const s1 = analysis.stats.find((x) => x.question.id === qs[0].id)!;
    const s2 = analysis.stats.find((x) => x.question.id === qs[1].id)!;
    expect(s1.facility).toBe(1);
    expect(s1.massErrorPct).toBe(0);
    expect(s2.facility).toBe(0.25);
    expect(s2.massErrorPct).toBe(75);
    // س٢ عالي الخطأ ← درسه في تقرير إعادة الشرح
    expect(analysis.reteach.some((r) => r.lessonId === qs[1].lessonId)).toBe(true);

    // الترحيل: 4 درجات في المكوّن الصحيح
    const exam = (await db.exams.get(examId))!;
    const carry1 = await carryResultsToGrades(exam);
    expect(carry1).toEqual({ carried: 4 });
    const live1 = (await db.grades.where("sourceExamId").equals(examId).toArray()).filter((g) => !g.deletedAt);
    expect(live1).toHaveLength(4);
    expect(live1.every((g) => g.gradeComponentId === quizComp.id)).toBe(true);

    // إعادة الترحيل لا تكرر (تلغي القديم)
    await carryResultsToGrades(exam);
    const live2 = (await db.grades.where("sourceExamId").equals(examId).toArray()).filter((g) => !g.deletedAt);
    expect(live2).toHaveLength(4);

    // تنظيف
    await db.grades.where("sourceExamId").equals(examId).delete();
    await db.gradeBatches.filter((b) => b.sheetCode === `EXAM-${examId}`).delete();
    await db.examResults.where("examId").equals(examId).delete();
    await db.examQuestions.where("[examId+order]").between([examId, 0], [examId, Infinity]).delete();
    await db.exams.delete(examId);
  });
});
