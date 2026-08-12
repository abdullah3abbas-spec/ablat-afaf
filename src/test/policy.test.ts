/**
 * اختبارات الأمر ٢ — الأخطاء هنا تصل إلى شهادة طالبة (§8.6):
 * حدود التقدير، مجموع الفصل، النهائية السنوية،
 * وسلامة نسخ السياسة (تعديل بعد الرصد لا يفسد الماضي).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import type { Grade, GradeComponent } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { finalYearGrade, gradeLabel, percentOf, termTotal } from "@/lib/grades";
import { activePolicyOf, savePolicy } from "@/lib/policy";
import { ensureGradeComponents } from "@/lib/gradeComponents";

beforeAll(async () => {
  await seedIfEmpty();
});

// ── التقدير من الشرائح (بيانات لا كود) ────────────────────────

describe("التقدير من شرائح السياسة", () => {
  test("حدود الشرائح الدقيقة — على الحد وتحته مباشرة", () => {
    expect(gradeLabel(100, DEFAULT_GRADE_SCALE)).toBe("امتياز");
    expect(gradeLabel(90, DEFAULT_GRADE_SCALE)).toBe("امتياز");
    expect(gradeLabel(89.9, DEFAULT_GRADE_SCALE)).toBe("جيد جداً");
    expect(gradeLabel(80, DEFAULT_GRADE_SCALE)).toBe("جيد جداً");
    expect(gradeLabel(70, DEFAULT_GRADE_SCALE)).toBe("جيد");
    expect(gradeLabel(60, DEFAULT_GRADE_SCALE)).toBe("مقبول");
    expect(gradeLabel(50, DEFAULT_GRADE_SCALE)).toBe("ضعيف");
    expect(gradeLabel(49.9, DEFAULT_GRADE_SCALE)).toBe("دون الحد");
    expect(gradeLabel(0, DEFAULT_GRADE_SCALE)).toBe("دون الحد");
  });

  test("يعمل مع شرائح معدّلة وبأي ترتيب — لو غيّرت الوزارة السلّم", () => {
    const custom = [
      { min: 0, label: "ج" },
      { min: 85, label: "أ" },
      { min: 70, label: "ب" },
    ];
    expect(gradeLabel(85, custom)).toBe("أ");
    expect(gradeLabel(84.9, custom)).toBe("ب");
    expect(gradeLabel(10, custom)).toBe("ج");
  });
});

// ── مجموع الفصل ───────────────────────────────────────────────

describe("مجموع الفصل من المكوّنات", () => {
  const comps = [
    { id: 1, maxMark: 25 },
    { id: 2, maxMark: 40 },
    { id: 3, maxMark: 35 },
  ] as GradeComponent[];

  const g = (componentId: number, mark: number, createdAt = 1, deletedAt?: number): Grade =>
    ({ gradeComponentId: componentId, mark, createdAt, deletedAt }) as Grade;

  test("يجمع آخر درجة حيّة لكل مكوّن ويحسب عظمى المرصود", () => {
    const r = termTotal([g(1, 20), g(2, 35), g(3, 30)], comps);
    expect(r).toEqual({ total: 85, counted: 3, outOf: 100, countedOutOf: 100 });
    // رصد جزئي: عظمى المرصود = عظمى المكوّن المرصود فقط
    const partial = termTotal([g(1, 20)], comps);
    expect(partial.countedOutOf).toBe(25);
    expect(partial.outOf).toBe(100);
  });

  test("التصحيح الأحدث يطغى على الأقدم", () => {
    const r = termTotal([g(1, 10, 1), g(1, 22, 5)], comps);
    expect(r.total).toBe(22);
    expect(r.counted).toBe(1);
  });

  test("المحذوف ناعماً لا يُحسب، والمكوّن غير المرصود لا يُعد صفراً", () => {
    const r = termTotal([g(1, 20), g(2, 30, 2, 999)], comps);
    expect(r.total).toBe(20);
    expect(r.counted).toBe(1);
    expect(r.outOf).toBe(100);
  });

  test("النسبة المئوية تقرَّب لمنزلة واحدة وتتحمل صفر المقام", () => {
    expect(percentOf(85, 100)).toBe(85);
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(50, 0)).toBe(0);
  });
});

// ── النهائية السنوية وحد النجاح على الحدود ────────────────────

describe("النهائية السنوية على الحدود", () => {
  test("طالبة على حد النجاح تماماً (50) ناجحة، وتحته بعُشر راسبة", () => {
    const p = { termWeights: { term1: 40, term2: 60 }, passGrade: 50 };
    // ف١=50 وف٢=50 → 50 بالضبط
    expect(finalYearGrade(50, 50, p)).toBe(50);
    // ف١=35 وف٢=59.9 → 49.94 < 50
    const borderline = finalYearGrade(35, 59.9, p);
    expect(borderline).toBeCloseTo(49.94, 2);
    expect(borderline < 50).toBe(true);
  });
});

// ── سلامة نسخ السياسة — القاعدة الحرجة (§4) ──────────────────

describe("نسخ السياسة عبر التعديل", () => {
  test("تعديل بلا درجات = بمكانه · تعديل بعد الرصد = نسخة جديدة والقديم سليم", async () => {
    // عام مستقل للاختبار كي لا نلوث العام المزروع
    const yearId = await db.academicYears.add({
      name: "عام-اختبار-السياسة",
      isCurrent: false,
      isArchived: false,
      createdAt: Date.now(),
    });
    const basePolicy = await activePolicyOf((await db.settings.get(1))!.currentAcademicYearId);
    await db.assessmentPolicy.add({
      ...basePolicy!,
      id: undefined,
      academicYearId: yearId,
      version: 1,
      isActive: true,
      isDemo: false,
      createdAt: Date.now(),
    });

    // ١) تعديل قبل أي رصد → بمكانه، لا نسخة جديدة
    const p1 = await activePolicyOf(yearId);
    const edit1 = {
      components: p1!.components.map((c) => (c.key === "mid" ? { ...c, max: 30 } : c.key === "final" ? { ...c, max: 30 } : c)),
      termWeights: { term1: 50, term2: 50 },
      maxGrade: 100,
      passGrade: 50,
      gradeScale: p1!.gradeScale ?? DEFAULT_GRADE_SCALE,
    };
    const r1 = await savePolicy(yearId, edit1, 1);
    expect(r1.newVersion).toBe(false);
    expect(r1.version).toBe(1);

    const compsV1 = await ensureGradeComponents(yearId, 1);
    const midV1 = compsV1.find((c) => c.key === "mid")!;
    expect(midV1.maxMark).toBe(30);

    // ٢) رصد درجة ثم تعديل → نسخة جديدة، والمكوّن المرصود يبقى بدرجته القديمة
    await db.grades.add({
      studentId: 999999,
      classId: 1,
      academicYearId: yearId,
      term: 1,
      gradeComponentId: midV1.id!,
      mark: 28,
      source: "manual",
      createdAt: Date.now(),
    });

    const p2 = await activePolicyOf(yearId);
    const edit2 = {
      ...edit1,
      components: p2!.components.map((c) => (c.key === "mid" ? { ...c, max: 20, nameAr: "تقييم إلكتروني" } : c)),
    };
    const r2 = await savePolicy(yearId, edit2, 1);
    expect(r2.newVersion).toBe(true);
    expect(r2.version).toBe(2);

    // النسختان محفوظتان معاً
    const versions = await db.assessmentPolicy.where("academicYearId").equals(yearId).toArray();
    expect(versions).toHaveLength(2);
    expect(versions.find((v) => v.version === 1)!.isActive).toBe(false);
    expect(versions.find((v) => v.version === 2)!.isActive).toBe(true);

    // الدرجة المرصودة سليمة وما زالت تشير لمكوّنها
    const savedGrade = (await db.grades.where("gradeComponentId").equals(midV1.id!).toArray())[0];
    expect(savedGrade.mark).toBe(28);

    // المكوّن المجسّد تبع النسخة الجديدة بالاسم والدرجة الجديدة (له درجات فيبقى بنفس الصف محدثاً)
    const midAfter = (await db.gradeComponents.get(midV1.id!))!;
    expect(midAfter.nameAr).toBe("تقييم إلكتروني");
    expect(midAfter.maxMark).toBe(20);
    expect(midAfter.policyId).toBe(r2.policyId);

    // ٣) عزل الأعوام: سياسة العام المزروع لم تتأثر إطلاقاً
    const seededYearId = (await db.settings.get(1))!.currentAcademicYearId;
    const seededPolicy = await activePolicyOf(seededYearId);
    expect(seededPolicy!.termWeights).toEqual({ term1: 40, term2: 60 });

    // تنظيف
    await db.grades.where("gradeComponentId").equals(midV1.id!).delete();
    await db.gradeComponents.where("academicYearId").equals(yearId).delete();
    await db.assessmentPolicy.where("academicYearId").equals(yearId).delete();
    await db.academicYears.delete(yearId);
  });

  test("حذف مكوّن بلا درجات يزيله من التجسيد، وذو الدرجات يبقى", async () => {
    const yearId = await db.academicYears.add({
      name: "عام-حذف-مكوّن",
      isCurrent: false,
      isArchived: false,
      createdAt: Date.now(),
    });
    const base = await activePolicyOf((await db.settings.get(1))!.currentAcademicYearId);
    await db.assessmentPolicy.add({
      ...base!,
      id: undefined,
      academicYearId: yearId,
      version: 1,
      isActive: true,
      isDemo: false,
      createdAt: Date.now(),
    });
    const comps = await ensureGradeComponents(yearId, 1);
    const homework = comps.find((c) => c.key === "homework")!;

    // حذف «الواجبات» (بلا درجات) من السياسة
    const p = await activePolicyOf(yearId);
    const edit = {
      components: p!.components.filter((c) => c.key !== "homework").map((c) => (c.key === "coursework" ? { ...c, max: 30 } : c.key === "final" ? { ...c, max: 45 } : c)),
      termWeights: p!.termWeights,
      maxGrade: 100,
      passGrade: 50,
      gradeScale: p!.gradeScale ?? DEFAULT_GRADE_SCALE,
    };
    await savePolicy(yearId, edit, 1);

    expect(await db.gradeComponents.get(homework.id!)).toBeUndefined();

    // تنظيف
    await db.gradeComponents.where("academicYearId").equals(yearId).delete();
    await db.assessmentPolicy.where("academicYearId").equals(yearId).delete();
    await db.academicYears.delete(yearId);
  });
});
