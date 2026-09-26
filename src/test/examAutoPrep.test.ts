/**
 * اختبار تجهيز الاختبار قبل موعده بأسبوعين (§2-د):
 * نافذة الاستحقاق النقية، والبناء التلقائي على قاعدة حقيقية الزرع،
 * وأمان التكرار، واحترام حذف المعلّمة، والدرجة من السياسة لا من الكود.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import { PREP_AHEAD_MS, dueForPrep, ensureScheduledExams, upcomingScheduledExams } from "@/lib/examAutoPrep";

const DAY = 86400000;

describe("dueForPrep — نافذة الأسبوعين النقية", () => {
  const date = new Date(2026, 9, 20, 8).getTime();
  test("يستحق داخل النافذة فقط", () => {
    expect(dueForPrep({ mid: date }, [], date - 15 * DAY)).toEqual([]);
    expect(dueForPrep({ mid: date }, [], date - 13 * DAY)).toEqual([{ typeKey: "mid", dateMs: date }]);
    expect(dueForPrep({ mid: date }, [], date - 1 * DAY)).toEqual([{ typeKey: "mid", dateMs: date }]);
    expect(dueForPrep({ mid: date }, [], date + 1 * DAY)).toEqual([]);
  });
  test("اختبار موجود لنفس النوع والموعد (حتى محذوفاً) يمنع البناء", () => {
    const existing = [{ typeKey: "mid", scheduledFor: date }];
    expect(dueForPrep({ mid: date }, existing, date - 5 * DAY)).toEqual([]);
    expect(dueForPrep({ final: date }, existing, date - 5 * DAY)).toEqual([{ typeKey: "final", dateMs: date }]);
  });
  test("بلا مواعيد: لا شيء", () => {
    expect(dueForPrep(undefined, [], date)).toEqual([]);
  });
});

describe("ensureScheduledExams — البناء التلقائي على القاعدة", () => {
  beforeAll(async () => {
    await seedIfEmpty();
  });

  test("موعد خلال أسبوعين ⇒ مسودة كاملة بدرجة السياسة وأسئلة من البنك", async () => {
    const policy = (await db.assessmentPolicy.toArray()).find((p) => p.isActive)!;
    const typeDef = policy.examTypes.find((t) => t.carryToComponentKey)!;
    const now = Date.now();
    const examDate = now + 10 * DAY;
    await db.settings.update(1, { examDates: { [typeDef.key]: examDate } });

    const built = await ensureScheduledExams(now);
    expect(built).toContain(typeDef.key);

    const exam = (await db.exams.toArray()).find((e) => e.typeKey === typeDef.key && e.scheduledFor === examDate)!;
    expect(exam).toBeTruthy();
    expect(exam.status).toBe("draft");
    // الدرجة الكلية من مكوّن السياسة — بيانات لا كود (§4)
    const comp = (await db.gradeComponents.toArray()).find((c) => c.id === exam.carryToComponentId)!;
    expect(exam.totalMarks).toBe(comp.maxMark);
    // الأسئلة مرفقة ومجموع درجاتها لا يتجاوز الكلية
    const eqs = await db.examQuestions.where("examId").equals(exam.id!).toArray();
    expect(eqs.length).toBeGreaterThan(0);
    expect(eqs.reduce((s2, q) => s2 + q.marks, 0)).toBeLessThanOrEqual(exam.totalMarks);
    // يظهر في تنبيهات الرئيسية
    const soon = await upcomingScheduledExams(now);
    expect(soon.some((e) => e.id === exam.id)).toBe(true);
  });

  test("آمن التكرار — لا ازدواج", async () => {
    const before = await db.exams.count();
    await ensureScheduledExams(Date.now());
    expect(await db.exams.count()).toBe(before);
  });

  test("حذف المعلّمة للمسودة لا يعيد بناءها خلف ظهرها", async () => {
    const exam = (await db.exams.toArray()).find((e) => e.scheduledFor != null)!;
    await db.exams.update(exam.id!, { deletedAt: Date.now() });
    const before = await db.exams.count();
    await ensureScheduledExams(Date.now());
    expect(await db.exams.count()).toBe(before);
    await db.exams.update(exam.id!, { deletedAt: undefined });
  });

  test("الموعد الأبعد من أسبوعين لا يُبنى بعد", async () => {
    const policy = (await db.assessmentPolicy.toArray()).find((p) => p.isActive)!;
    const other = policy.examTypes.filter((t) => t.carryToComponentKey)[1];
    if (!other) return; // سياسة بنوع واحد فقط — لا شيء نختبره
    const now = Date.now();
    const settings = await db.settings.get(1);
    await db.settings.update(1, { examDates: { ...settings?.examDates, [other.key]: now + 30 * DAY } });
    const built = await ensureScheduledExams(now);
    expect(built).not.toContain(other.key);
  });

  test("نافذة PREP_AHEAD_MS أسبوعان بالضبط", () => {
    expect(PREP_AHEAD_MS).toBe(14 * DAY);
  });
});
