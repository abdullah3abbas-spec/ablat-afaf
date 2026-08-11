/**
 * اختبارات محرّك النقاط كاملاً (نص الأمر ٣):
 * السقف، الشهري/التراكمي، حدود المستويات، أسبوع الحضور بلا تكرار،
 * احتسابات الدرجات التلقائية، الصرف والرصيد، مكافآت الشهر.
 */
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import { DEFAULT_POINT_LEVELS } from "@/db/constants";
import {
  awardAfterGradeBatch,
  awardFullWeek,
  awardPoints,
  computeMonthAwards,
  cumulativePoints,
  levelOf,
  monthKeyOf,
  monthlyPoints,
  redeemReward,
  spendableBalance,
  weekKeyOf,
} from "@/lib/points";
import { ensureGradeComponents } from "@/lib/gradeComponents";

let studentId: number;
let classId: number;

beforeAll(async () => {
  await seedIfEmpty();
  const st = (await db.students.toArray())[0];
  studentId = st.id!;
  classId = st.classId;
});

beforeEach(async () => {
  // تنظيف قيود النقاط والصرف بين الاختبارات
  await db.points.clear();
  await db.rewardRedemptions.clear();
  await db.attendance.clear();
});

const RULE = { id: 999, points: 10, nameAr: "قاعدة اختبار" };

describe("مفاتيح الزمن", () => {
  test("مفتاح الشهر ومفتاح الأسبوع (الأحد بدايةً)", () => {
    const wed = new Date(2026, 8, 16).getTime(); // أربعاء 16 سبتمبر 2026
    expect(monthKeyOf(wed)).toBe("2026-09");
    expect(weekKeyOf(wed)).toBe("2026-09-13"); // الأحد قبله
  });
});

describe("المنح والسقف الشهري", () => {
  test("منح عادي يسجّل قيداً بقيمة القاعدة", async () => {
    const r = await awardPoints({ id: studentId, classId }, RULE);
    expect(r).toEqual({ ok: true, awarded: 10 });
    expect(await monthlyPoints(studentId, monthKeyOf(Date.now()))).toBe(10);
  });

  test("السقف يقص المنح الجزئي ويمنع بعد الامتلاء", async () => {
    const cap = (await db.settings.get(1))!.monthlyPointsCap!;
    expect(cap).toBe(100);
    // املئي حتى 95
    for (let i = 0; i < 9; i++) await awardPoints({ id: studentId, classId }, RULE); // 90
    await awardPoints({ id: studentId, classId }, { ...RULE, points: 5 }); // 95
    // منح 10 → يُقص إلى 5
    const clipped = await awardPoints({ id: studentId, classId }, RULE);
    expect(clipped).toEqual({ ok: true, awarded: 5 });
    expect(await monthlyPoints(studentId, monthKeyOf(Date.now()))).toBe(cap);
    // أي منح إضافي ممنوع
    const blocked = await awardPoints({ id: studentId, classId }, RULE);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("blocked_cap");
  });

  test("الشهري لشهر آخر مستقل، والتراكمي يجمع الكل", async () => {
    const jan = new Date(2026, 0, 10).getTime();
    const feb = new Date(2026, 1, 10).getTime();
    await awardPoints({ id: studentId, classId }, RULE, { atMs: jan });
    await awardPoints({ id: studentId, classId }, { ...RULE, points: 7 }, { atMs: feb });
    expect(await monthlyPoints(studentId, "2026-01")).toBe(10);
    expect(await monthlyPoints(studentId, "2026-02")).toBe(7);
    expect(await cumulativePoints(studentId)).toBe(17);
  });
});

describe("المستويات من البيانات — حدود دقيقة", () => {
  test("حدود الشرائح 49/50 و149/150 و499/500", () => {
    expect(levelOf(0, DEFAULT_POINT_LEVELS)!.nameAr).toBe("مستكشفة مبتدئة");
    expect(levelOf(49, DEFAULT_POINT_LEVELS)!.nameAr).toBe("مستكشفة مبتدئة");
    expect(levelOf(50, DEFAULT_POINT_LEVELS)!.nameAr).toBe("باحثة");
    expect(levelOf(149, DEFAULT_POINT_LEVELS)!.nameAr).toBe("باحثة");
    expect(levelOf(150, DEFAULT_POINT_LEVELS)!.nameAr).toBe("عالِمة صغيرة");
    expect(levelOf(499, DEFAULT_POINT_LEVELS)!.nameAr).toBe("عالِمة متميّزة");
    expect(levelOf(500, DEFAULT_POINT_LEVELS)!.nameAr).toBe("سفيرة العلوم");
    expect(levelOf(9999, DEFAULT_POINT_LEVELS)!.nameAr).toBe("سفيرة العلوم");
  });
});

describe("حضور أسبوع كامل — آمن التكرار", () => {
  const sunday = new Date(2026, 8, 13).getTime(); // أحد

  async function markWeek(status: "present" | "late", days = 5) {
    for (let i = 0; i < days; i++) {
      await db.attendance.add({
        studentId,
        classId,
        date: sunday + i * 86400000,
        status: i === 2 && status === "late" ? "late" : "present",
        createdAt: Date.now(),
      });
    }
  }

  test("أسبوع كامل حضوراً يمنح مرة واحدة فقط", async () => {
    await markWeek("present");
    const r1 = await awardFullWeek(classId, sunday + 2 * 86400000);
    expect(r1.awarded).toBe(1); // طالبتنا فقط سجّلت حضوراً
    const r2 = await awardFullWeek(classId, sunday);
    expect(r2.awarded).toBe(0);
    expect(r2.skipped).toBeGreaterThanOrEqual(1);
    const rule = (await db.pointRules.toArray()).find((x) => x.key === "full_week")!;
    expect(await monthlyPoints(studentId, monthKeyOf(sunday))).toBe(rule.points);
  });

  test("تأخر يوم واحد يمنع المنح", async () => {
    await markWeek("late");
    const r = await awardFullWeek(classId, sunday);
    expect(r.awarded).toBe(0);
  });
});

describe("الاحتساب التلقائي من الدرجات", () => {
  test("90%+ تمنح مرة لكل مكوّن، والتحسّن يقارن بالرصد السابق", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const comps = await ensureGradeComponents(year.id!, 1);
    const comp = comps[0]; // منتصف 25

    // رصد قديم: 18/25 = 72%
    const t0 = Date.now() - 10_000;
    await db.grades.add({
      studentId,
      classId,
      academicYearId: year.id!,
      term: 1,
      gradeComponentId: comp.id!,
      mark: 18,
      source: "manual",
      createdAt: t0,
    });

    // دفعة جديدة: 24/25 = 96% → تستحق 90%+ والتحسّن معاً
    const batchId = await db.gradeBatches.add({
      classId,
      gradeComponentId: comp.id!,
      academicYearId: year.id!,
      term: 1,
      source: "manual",
      savedCount: 1,
      createdAt: Date.now(),
    });
    await db.grades.add({
      studentId,
      classId,
      academicYearId: year.id!,
      term: 1,
      gradeComponentId: comp.id!,
      mark: 24,
      source: "manual",
      batchId,
      createdAt: Date.now(),
    });

    const r1 = await awardAfterGradeBatch(batchId);
    expect(r1).toEqual({ grade90: 1, improved: 1 });

    // إعادة التشغيل لا تكرر المنح
    const r2 = await awardAfterGradeBatch(batchId);
    expect(r2).toEqual({ grade90: 0, improved: 0 });

    const rule90 = (await db.pointRules.toArray()).find((x) => x.key === "grade_90")!;
    const ruleImp = (await db.pointRules.toArray()).find((x) => x.key === "improvement")!;
    expect(await cumulativePoints(studentId)).toBe(rule90.points + ruleImp.points);

    // تنظيف درجات الاختبار
    await db.grades.where("batchId").equals(batchId).delete();
    await db.gradeBatches.delete(batchId);
    await db.grades.where("[studentId+gradeComponentId]").equals([studentId, comp.id!]).delete();
  });
});

describe("متجر المكافآت والرصيد", () => {
  test("الصرف يخصم من الرصيد ويُمنع عند العجز", async () => {
    const reward = (await db.rewards.toArray())[0]; // 20 نقطة
    // رصيد 15 فقط → ممنوع
    await awardPoints({ id: studentId, classId }, { ...RULE, points: 15 });
    const fail = await redeemReward(studentId, reward.id!);
    expect(fail.ok).toBe(false);
    expect(fail.reason).toBe("insufficient");

    // رفع الرصيد إلى 25 → الصرف يمر ويبقى 5
    await awardPoints({ id: studentId, classId }, { ...RULE, points: 10 });
    const ok = await redeemReward(studentId, reward.id!);
    expect(ok.ok).toBe(true);
    expect(ok.balanceAfter).toBe(25 - reward.costPoints);
    expect(await spendableBalance(studentId)).toBe(25 - reward.costPoints);
    // الشهري لا يتأثر بالصرف (الصدارة على المكتسب)
    expect(await monthlyPoints(studentId, monthKeyOf(Date.now()))).toBe(25);
  });
});

describe("مكافآت الشهر المحسوبة", () => {
  test("نجوم الشهر أعلى ٣، ونجمة الالتزام بلا غياب ولا تأخر", async () => {
    const students = (await db.students.where("classId").equals(classId).toArray()).slice(0, 4);
    const mk = monthKeyOf(Date.now());

    await awardPoints({ id: students[0].id!, classId }, { ...RULE, points: 30 });
    await awardPoints({ id: students[1].id!, classId }, { ...RULE, points: 20 });
    await awardPoints({ id: students[2].id!, classId }, { ...RULE, points: 10 });
    await awardPoints({ id: students[3].id!, classId }, { ...RULE, points: 5 });

    // حضور الشهر: الأولى كاملة، الثانية فيها تأخر
    const day = Date.now();
    await db.attendance.add({ studentId: students[0].id!, classId, date: day, status: "present", createdAt: day });
    await db.attendance.add({ studentId: students[1].id!, classId, date: day, status: "late", createdAt: day });

    const awards = await computeMonthAwards(mk, classId);
    expect(awards.stars.map((s) => s.student.id)).toEqual([students[0].id, students[1].id, students[2].id]);
    expect(awards.stars[0].points).toBe(30);
    expect(awards.commitmentStars.map((s) => s.id)).toEqual([students[0].id]);
    expect(awards.topClass?.classId).toBe(classId);
  });
});
