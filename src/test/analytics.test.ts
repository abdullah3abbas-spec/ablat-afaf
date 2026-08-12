/**
 * اختبارات الأمر ٧: العجلة العادلة، تقسيم المجموعات، الأوسمة،
 * وتنبيهات الإنذار المبكر والمجموعات العلاجية.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import type { Grade, GradeComponent } from "@/db/schema";
import { awardBadge, fairPick, makeGroups, removeBadge, type Pickable } from "@/lib/funTools";
import { earlyWarnings, hasGradeDropStreak, remedialGroups } from "@/lib/analytics";
import { seededRandom } from "@/lib/examBuilder";
import { ensureGradeComponents } from "@/lib/gradeComponents";

beforeAll(async () => {
  await seedIfEmpty();
});

const people = (n: number): Pickable[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `ط${i + 1}` }));

describe("العجلة العادلة (§2-ز)", () => {
  test("تستبعد الغائبات ولا تختارهنّ أبداً", () => {
    const cands = people(5);
    const absent = new Set([2, 4]);
    const rnd = seededRandom(1);
    let picked: number[] = [];
    for (let i = 0; i < 20; i++) {
      const r = fairPick(cands, absent, picked, rnd);
      expect(r).not.toBeNull();
      expect([2, 4]).not.toContain(r!.picked.id);
      picked = r!.pickedAfter;
    }
  });

  test("لا تكرر اسماً حتى تُستوفى القائمة، ثم تبدأ جولة جديدة", () => {
    const cands = people(4);
    const absent = new Set<number>();
    const rnd = seededRandom(7);
    let picked: number[] = [];
    // الجولة الأولى: ٤ اختيارات فريدة
    const round1: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = fairPick(cands, absent, picked, rnd)!;
      round1.push(r.picked.id);
      picked = r.pickedAfter;
    }
    expect(new Set(round1).size).toBe(4);
    // الاختيار الخامس يبدأ جولة جديدة (القائمة استُوفيت)
    const fifth = fairPick(cands, absent, picked, rnd)!;
    expect(fifth.pickedAfter).toHaveLength(1);
    expect([1, 2, 3, 4]).toContain(fifth.picked.id);
  });

  test("كل المرشحات غائبات = null", () => {
    expect(fairPick(people(2), new Set([1, 2]), [], seededRandom(1))).toBeNull();
  });
});

describe("تقسيم المجموعات", () => {
  test("بعدد المجموعات: أحجام متوازنة تشمل الجميع بلا تكرار", () => {
    const students = people(25);
    const groups = makeGroups(students, { by: "count", count: 4 }, seededRandom(3));
    expect(groups).toHaveLength(4);
    const all = groups.flat().map((s) => s.id);
    expect(new Set(all).size).toBe(25);
    const sizes = groups.map((g) => g.length).sort();
    expect(sizes[sizes.length - 1] - sizes[0]).toBeLessThanOrEqual(1);
  });

  test("بحجم المجموعة: عدد المجموعات = ceil(العدد/الحجم)", () => {
    const groups = makeGroups(people(25), { by: "size", size: 5 }, seededRandom(9));
    expect(groups).toHaveLength(5);
    expect(groups.flat()).toHaveLength(25);
  });
});

describe("الأوسمة", () => {
  test("منح وسام يظهر في ملف الطالبة ولا يتكرر في نفس الشهر، والتراجع يزيله", async () => {
    const st = (await db.students.toArray())[0];
    const badge = (await db.badges.toArray())[0];
    await awardBadge(st.id!, badge.id!, "تجربة");
    let fresh = (await db.students.get(st.id!))!;
    const count1 = fresh.earnedBadges?.length ?? 0;
    expect(count1).toBeGreaterThanOrEqual(1);
    // لا يتكرر في نفس الشهر
    await awardBadge(st.id!, badge.id!, "مرة ثانية");
    fresh = (await db.students.get(st.id!))!;
    expect(fresh.earnedBadges?.length).toBe(count1);
    // التراجع
    const awardedAt = fresh.earnedBadges!.find((b) => b.badgeId === badge.id)!.awardedAt;
    await removeBadge(st.id!, awardedAt);
    fresh = (await db.students.get(st.id!))!;
    expect(fresh.earnedBadges?.some((b) => b.awardedAt === awardedAt)).toBe(false);
  });
});

describe("هبوط الدرجات ٣ مرات متتالية", () => {
  const comp = { id: 1, maxMark: 10 } as GradeComponent;
  const g = (mark: number, t: number): Grade => ({ gradeComponentId: 1, mark, createdAt: t, term: 1 } as Grade);

  test("ثلاث هبوطات متتالية = تنبيه", () => {
    // 90 → 80 → 70 → 60 (ثلاث هبوطات)
    expect(hasGradeDropStreak([g(9, 1), g(8, 2), g(7, 3), g(6, 4)], [comp])).toBe(true);
  });
  test("هبوط ثم صعود يكسر التتابع", () => {
    expect(hasGradeDropStreak([g(9, 1), g(8, 2), g(9, 3), g(7, 4)], [comp])).toBe(false);
  });
  test("أقل من أربع درجات لا يكفي", () => {
    expect(hasGradeDropStreak([g(9, 1), g(8, 2), g(7, 3)], [comp])).toBe(false);
  });
});

describe("الإنذار المبكر والمجموعات العلاجية", () => {
  test("تنبيه الغياب المتكرر، والتجميع بنقطة الضعف المشتركة", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const comps = await ensureGradeComponents(year.id!, 1);
    const midComp = comps.find((c) => c.key === "mid")!;
    const klass = (await db.classes.toArray())[0];
    const students = (await db.students.where("classId").equals(klass.id!).toArray()).slice(0, 3);
    const now = Date.now();

    // طالبتان ضعيفتان في «منتصف الفصل» (نفس نقطة الضعف)
    const gids: number[] = [];
    for (const st of students.slice(0, 2)) {
      gids.push(await db.grades.add({ studentId: st.id!, classId: klass.id!, academicYearId: year.id!, term: 1, gradeComponentId: midComp.id!, mark: 8, source: "manual", createdAt: now }));
    }
    // غياب متكرر للأولى
    const aids: number[] = [];
    for (let i = 0; i < 4; i++) {
      aids.push(await db.attendance.add({ studentId: students[0].id!, classId: klass.id!, date: now - i * 86400000, status: "absent", createdAt: now }));
    }

    const groups = await remedialGroups(klass.id!, 1, 60);
    const midGroup = groups.find((g) => g.weaknessKey === "mid");
    expect(midGroup).toBeDefined();
    expect(midGroup!.students.length).toBe(2); // مجموعة واحدة للاثنتين
    expect(midGroup!.suggestedActivity).toContain("منتصف الفصل");

    const alerts = await earlyWarnings(klass.id!, now);
    expect(alerts.some((a) => a.kind === "absence" && a.studentId === students[0].id)).toBe(true);

    // تنظيف
    await db.grades.bulkDelete(gids);
    await db.attendance.bulkDelete(aids);
  });
});
