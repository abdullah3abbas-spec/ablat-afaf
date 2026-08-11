/**
 * اختبارات الأمر ١-ب: هندسة الورقة، تطبيع الأرقام المقروءة،
 * تجسيد مكوّنات الدرجات، والتراجع عن دفعة كاملة.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import {
  BOX,
  CANON_SCALE,
  MARK_CENTERS,
  MAX_PER_SHEET,
  PAGE,
  boxPixelRect,
  scoreBoxes,
  sheetCode,
} from "@/lib/sheetLayout";
import { parseReadNumber } from "@/lib/scanPipeline";
import { ensureGradeComponents, leafComponents } from "@/lib/gradeComponents";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("هندسة ورقة الرصد", () => {
  test("مربع الدرجة لا يقل عن 18×14 مم (§2-ب)", () => {
    expect(BOX.w).toBeGreaterThanOrEqual(18);
    expect(BOX.h).toBeGreaterThanOrEqual(14);
  });

  test("٢٦ خانة كحد أقصى وكلها داخل الصفحة وبلا تداخل", () => {
    const boxes = scoreBoxes(MAX_PER_SHEET);
    expect(boxes).toHaveLength(26);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(PAGE.w);
      expect(b.y + b.h).toBeLessThanOrEqual(PAGE.h);
    }
    // لا تداخل بين أي مربعين
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  test("مراكز العلامات الأربع في الأركان الأربعة", () => {
    expect(MARK_CENTERS).toHaveLength(4);
    const [tr, tl, br, bl] = MARK_CENTERS;
    expect(tr.x).toBeGreaterThan(PAGE.w / 2);
    expect(tl.x).toBeLessThan(PAGE.w / 2);
    expect(tr.y).toBeLessThan(PAGE.h / 2);
    expect(br.y).toBeGreaterThan(PAGE.h / 2);
    expect(bl.x).toBeLessThan(PAGE.w / 2);
  });

  test("تحويل مم ← بكسل متسق مع المقياس", () => {
    const r = boxPixelRect({ x: 10, y: 20, w: 20, h: 15, index: 0 }, 0);
    expect(r.x).toBe(10 * CANON_SCALE);
    expect(r.w).toBe(20 * CANON_SCALE);
  });

  test("رمز الورقة يحمل الفصل والمكوّن والتاريخ", () => {
    const code = sheetCode(3, 7, new Date(2026, 8, 15).getTime());
    expect(code).toBe("AA-C3-K7-20260915");
  });
});

describe("تطبيع الرقم المقروء", () => {
  test("أرقام غربية", () => {
    expect(parseReadNumber("23")).toBe(23);
    expect(parseReadNumber(" 8 ")).toBe(8);
  });
  test("أرقام شرقية تتحول", () => {
    expect(parseReadNumber("٢٣")).toBe(23);
    expect(parseReadNumber("٧")).toBe(7);
  });
  test("الفواصل العشرية بأشكالها", () => {
    expect(parseReadNumber("12.5")).toBe(12.5);
    expect(parseReadNumber("12,5")).toBe(12.5);
    expect(parseReadNumber("١٢٫٥")).toBe(12.5);
  });
  test("نص بلا أرقام = null", () => {
    expect(parseReadNumber("")).toBeNull();
    expect(parseReadNumber("ـ")).toBeNull();
  });
});

describe("تجسيد مكوّنات الدرجات من السياسة", () => {
  test("ينشئ المكوّنات من السياسة المزروعة ويعيد الورقية فقط", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const leaves = await ensureGradeComponents(year.id!, 1);
    // الورقية: منتصف + قصيرة + مشاركة + واجبات + نهاية = ٥ (أعمال الفصل أبٌ مركّب)
    expect(leaves).toHaveLength(5);
    expect(leaves.map((c) => c.key)).toContain("mid");
    expect(leaves.map((c) => c.key)).not.toContain("coursework");
    // الاستدعاء الثاني لا يكرر
    const again = await ensureGradeComponents(year.id!, 1);
    expect(again).toHaveLength(5);
    const all = await db.gradeComponents.where("[academicYearId+term]").equals([year.id!, 1]).count();
    expect(all).toBe(6); // ٥ ورقية + الأب
  });

  test("leafComponents يستبعد الآباء", () => {
    const mock = [
      { key: "a", parentKey: undefined, order: 1 },
      { key: "b", parentKey: undefined, order: 2 },
      { key: "b1", parentKey: "b", order: 3 },
    ] as never[];
    const leaves = leafComponents(mock);
    expect(leaves.map((c: { key: string }) => c.key)).toEqual(["a", "b1"]);
  });
});

describe("الاعتماد بالدفعة والتراجع الكامل", () => {
  test("حفظ دفعة ثم التراجع يخفي كل درجاتها", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const leaves = await ensureGradeComponents(year.id!, 1);
    const comp = leaves[0];
    const klass = (await db.classes.toArray())[0];
    const students = (await db.students.where("classId").equals(klass.id!).toArray()).slice(0, 3);

    const now = Date.now();
    const batchId = await db.gradeBatches.add({
      classId: klass.id!,
      gradeComponentId: comp.id!,
      academicYearId: year.id!,
      term: 1,
      source: "manual",
      savedCount: students.length,
      createdAt: now,
    });
    for (const [i, st] of students.entries()) {
      await db.grades.add({
        studentId: st.id!,
        classId: klass.id!,
        academicYearId: year.id!,
        term: 1,
        gradeComponentId: comp.id!,
        mark: 10 + i,
        source: "manual",
        batchId,
        createdAt: now,
      });
    }

    expect(await db.grades.where("batchId").equals(batchId).count()).toBe(3);

    // التراجع: حذف ناعم للدفعة وكل درجاتها
    const delAt = Date.now();
    await db.gradeBatches.update(batchId, { deletedAt: delAt });
    const grades = await db.grades.where("batchId").equals(batchId).toArray();
    for (const g of grades) await db.grades.update(g.id!, { deletedAt: delAt });

    const live = (await db.grades.where("batchId").equals(batchId).toArray()).filter((g) => !g.deletedAt);
    expect(live).toHaveLength(0);

    // تنظيف
    await db.grades.where("batchId").equals(batchId).delete();
    await db.gradeBatches.delete(batchId);
  });
});
