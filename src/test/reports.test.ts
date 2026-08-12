/**
 * اختبارات الأمر ٥: التوصيات الآلية، تقرير الطالبة، تقرير الإدارة
 * (متوسط/نجاح/توزيع)، ترتيب أعمدة الكشف، ورسم الأعمدة SVG.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import { buildRecommendations, classAdminReport, orderColumns, studentReport } from "@/lib/reportData";
import { barChartSvg } from "@/lib/reportPrint";
import { certSerial } from "@/lib/certificates";
import { ensureGradeComponents } from "@/lib/gradeComponents";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("التوصيات الآلية", () => {
  test("مشتقة من الأرقام: تفوّق، ضعف مكوّن، غياب متكرر", () => {
    const excellent = buildRecommendations({ pct: 95, absent: 0, late: 0, monthlyPoints: 40 });
    expect(excellent.some((r) => r.includes("ممتاز"))).toBe(true);
    expect(excellent.some((r) => r.includes("انتظام كامل"))).toBe(true);
    expect(excellent.some((r) => r.includes("مشاركة صفية"))).toBe(true);

    const struggling = buildRecommendations({
      pct: 45,
      absent: 4,
      late: 1,
      weakest: { name: "اختبار منتصف الفصل", pct: 40 },
      monthlyPoints: 0,
    });
    expect(struggling.some((r) => r.includes("عاجلة"))).toBe(true);
    expect(struggling.some((r) => r.includes("اختبار منتصف الفصل"))).toBe(true);
    expect(struggling.some((r) => r.includes("تكرر الغياب"))).toBe(true);

    // بلا درجات: لا توصية درجات ولا انهيار
    const none = buildRecommendations({ pct: null, absent: 0, late: 0, monthlyPoints: 0 });
    expect(none.every((r) => !r.includes("أداء"))).toBe(true);
  });
});

describe("تقرير الطالبة وتقرير الإدارة", () => {
  test("يجمعان الدرجات والتوزيع ونسبة النجاح", async () => {
    const year = (await db.academicYears.toArray()).find((y) => y.isCurrent)!;
    const comps = await ensureGradeComponents(year.id!, 1);
    const comp = comps[0]; // منتصف (25)
    const klass = (await db.classes.toArray())[0];
    const [st1, st2] = (await db.students.where("classId").equals(klass.id!).toArray()).slice(0, 2);

    const now = Date.now();
    // st1: 24/25 = 96% (امتياز) · st2: 10/25 = 40% (دون الحد)
    const g1 = await db.grades.add({ studentId: st1.id!, classId: klass.id!, academicYearId: year.id!, term: 1, gradeComponentId: comp.id!, mark: 24, source: "manual", createdAt: now });
    const g2 = await db.grades.add({ studentId: st2.id!, classId: klass.id!, academicYearId: year.id!, term: 1, gradeComponentId: comp.id!, mark: 10, source: "manual", createdAt: now });

    const report = await studentReport(st1.id!, 1);
    expect(report).not.toBeNull();
    expect(report!.total).toBe(24);
    expect(report!.pct).toBe(96);
    expect(report!.label).toBe("امتياز");
    expect(report!.components.find((c) => c.name === comp.nameAr)!.mark).toBe(24);
    expect(report!.recommendations.length).toBeGreaterThan(0);

    const admin = await classAdminReport(klass.id!, 1);
    expect(admin!.gradedCount).toBe(2);
    expect(admin!.average).toBe(68); // (96+40)/2
    expect(admin!.passRate).toBe(50);
    expect(admin!.distribution.find((d) => d.label === "امتياز")!.count).toBe(1);
    expect(admin!.distribution.find((d) => d.label === "دون الحد")!.count).toBe(1);

    await db.grades.bulkDelete([g1, g2]);
  });
});

describe("ترتيب أعمدة الكشف الرسمي", () => {
  const available = ["roll", "name", "comp:mid", "comp:final", "total", "label"];

  test("بلا ترتيب محفوظ = الافتراضي", () => {
    expect(orderColumns(available)).toEqual(available);
    expect(orderColumns(available, [])).toEqual(available);
  });

  test("الترتيب المحفوظ يُطبَّق والمفقود يُلحق والزائد يُهمل", () => {
    const saved = ["name", "total", "comp:ghost", "roll"];
    expect(orderColumns(available, saved)).toEqual(["name", "total", "roll", "comp:mid", "comp:final", "label"]);
  });
});

describe("رسم الأعمدة SVG (dataviz)", () => {
  test("سلسلة واحدة بلون واحد وتسميات مباشرة بأرقام شرقية وحواف مدورة", () => {
    const svg = barChartSvg(
      [
        { label: "منتصف", value: 80 },
        { label: "نهاية", value: 60 },
      ],
      { maxValue: 100, valueSuffix: "٪" }
    );
    // لون واحد للسلسلة (تركوازي) — لا ألوان متعددة
    expect((svg.match(/#0F6B62/g) ?? []).length).toBe(2);
    expect(svg).not.toContain("#8A1538");
    // تسميات القيم بلون الحبر لا لون السلسلة، بأرقام شرقية
    expect(svg).toContain("٨٠٪");
    expect(svg).toContain('fill="#1E2430"');
    // حواف مدورة وأساس مرسوم
    expect(svg).toContain('rx="4"');
  });

  test("قيمة صفرية لا تكسر الرسم", () => {
    const svg = barChartSvg([{ label: "أ", value: 0 }], { maxValue: 0 });
    expect(svg).toContain("<svg");
  });
});

describe("تسلسل الشهادات", () => {
  test("صيغة الرقم التسلسلي", () => {
    const serial = certSerial("excellence", 42, new Date(2026, 8, 15).getTime());
    expect(serial).toBe("AA-EXC-202609-42");
  });
});
