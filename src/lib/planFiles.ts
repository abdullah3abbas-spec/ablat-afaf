/**
 * التحضير اليومي والتجارب (§ الأمر ٦ البنود ٤ و٥ و٧):
 * خطة درس بنموذج المدرسة → Word، قائمة مشتريات المختبر → Excel،
 * وملف الإنجاز → Word يجمع الخطط والأنشطة وإحصاءات النتائج.
 */
import type { LessonPlan } from "@/db/schema";

/** حقول نموذج المدرسة بالترتيب المعتمد */
export const PLAN_FIELDS: { key: string; label: string }[] = [
  { key: "objectives", label: "الأهداف" },
  { key: "standards", label: "المعايير" },
  { key: "warmup", label: "التمهيد" },
  { key: "strategies", label: "الاستراتيجيات" },
  { key: "activities", label: "الأنشطة" },
  { key: "materials", label: "الوسائل" },
  { key: "assessment", label: "التقويم" },
  { key: "homework", label: "الواجب" },
  { key: "differentiation", label: "الفروق الفردية" },
];

async function downloadBlob(blob: Blob, name: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export interface PlanMeta {
  schoolName: string;
  lessonTitle: string;
  unitTitle: string;
  dateStr: string;
}

/** خطة درس Word بجدول نموذج المدرسة — أعمدة معكوسة يدوياً (§5) */
export async function downloadPlanWord(plan: LessonPlan, meta: PlanMeta): Promise<void> {
  const { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");

  const cellP = (text: string, bold = false) =>
    text
      .split("\n")
      .map((line) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line, rightToLeft: true, bold })] }));

  const row = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 7200, type: WidthType.DXA }, children: cellP(value || "—") }),
        new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: cellP(label, true) }),
      ],
    });

  const children: unknown[] = [
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: meta.schoolName, rightToLeft: true, bold: true, size: 28, color: "8A1538" })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `التحضير اليومي — العلوم · المستوى الخامس · ${meta.unitTitle} · ${meta.lessonTitle} · ${meta.dateStr}`, rightToLeft: true })] }),
    new Table({
      visuallyRightToLeft: true,
      columnWidths: [7200, 2200],
      width: { size: 9400, type: WidthType.DXA },
      rows: PLAN_FIELDS.map((f) => row(f.label, plan.fields?.[f.key] ?? "")),
    }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: "توقيع المعلّمة: ................    توقيع المنسّقة: ................", rightToLeft: true })] }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", rightToLeft: true, size: 24 } } } },
    sections: [{ properties: {}, children: children as never[] }],
  });
  await downloadBlob(await Packer.toBlob(doc), `تحضير-${meta.lessonTitle}.docx`);
}

// ── خطة التحضير اليومية بنموذج الوزارة الحرفي (٢٠٢٥) ─────────

import type { MinistryPlanData } from "./ministryPlan";
import {
  MINISTRY_COMPETENCIES,
  MINISTRY_PRO_STANDARDS,
  MINISTRY_STRATEGIES,
  MINISTRY_TOOLS,
  MINISTRY_VALUES,
} from "@/content/ministryTemplates";

/**
 * «خطة التحضير اليومية» — البنية الوزارية كما في نموذج أبلة عفاف المرجعي:
 * ترويسة (المادة/المعلمة/الوحدة/الدرس/الصف/التاريخ/النتاجات/الكفايات/القيم/
 * المصطلحات/الوسائل/المصادر) ثم التهيئة ٥د ← أهداف|أنشطة|تقويم ٣٠د ← غلق ٥د
 * ← الواجب، وذيل المعايير المهنية والاستراتيجيات.
 * اصطلاح §5: أعمدة معكوسة يدوياً + visuallyRightToLeft.
 */
export async function downloadMinistryPlanWord(d: MinistryPlanData): Promise<void> {
  const { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");

  const TOTAL = 9600;
  const P = (text: string, opts?: { bold?: boolean; center?: boolean; color?: string; size?: number }) =>
    new Paragraph({
      bidirectional: true,
      alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
      children: [new TextRun({ text, rightToLeft: true, bold: opts?.bold, color: opts?.color, size: opts?.size })],
    });
  const lines = (texts: string[], bold = false) => texts.map((t) => P(t, { bold }));
  const cell = (children: InstanceType<typeof Paragraph>[], width: number, span?: number) =>
    new TableCell({ width: { size: width, type: WidthType.DXA }, columnSpan: span, children });

  // صف من أزواج (قيمة عريضة/قيمة) — يُمرَّر بترتيب القراءة العربية ويُعكس هنا (§5)
  const row = (cells: { texts: string[]; width: number; bold?: boolean; span?: number }[]) =>
    new TableRow({
      children: [...cells].reverse().map((c) => cell(lines(c.texts, c.bold), c.width, c.span)),
    });

  const W4 = [1700, 3100, 1700, 3100]; // ترويسة رباعية الأعمدة

  const headerTable = new Table({
    visuallyRightToLeft: true,
    columnWidths: [...W4].reverse(),
    width: { size: TOTAL, type: WidthType.DXA },
    rows: [
      row([
        { texts: ["خطة التحضير اليومية"], width: W4[0] + W4[1], bold: true, span: 2 },
        { texts: [`العام الدراسي ${d.yearLabel} — ${d.termLabel}`], width: W4[2] + W4[3], bold: true, span: 2 },
      ]),
      row([
        { texts: ["المادة الدراسية"], width: W4[0], bold: true },
        { texts: ["العلوم"], width: W4[1] },
        { texts: ["اسم المعلمة"], width: W4[2], bold: true },
        { texts: [d.teacherName], width: W4[3] },
      ]),
      row([
        { texts: ["الوحدة / المحور / المجال"], width: W4[0], bold: true },
        { texts: [d.unitLine], width: W4[1] },
        { texts: ["عنوان الدرس"], width: W4[2], bold: true },
        { texts: [d.lessonTitle], width: W4[3] },
      ]),
      row([
        { texts: ["الصف"], width: W4[0], bold: true },
        { texts: [d.classLine], width: W4[1] },
        { texts: ["اليوم والتاريخ"], width: W4[2], bold: true },
        { texts: [d.dateLine], width: W4[3] },
      ]),
      row([
        { texts: ["نتاجات التعلم"], width: W4[0], bold: true },
        { texts: d.outcomes, width: W4[1] + W4[2] + W4[3], span: 3 },
      ]),
      row([
        { texts: ["الكفايات الأساسية"], width: W4[0], bold: true },
        { texts: [MINISTRY_COMPETENCIES.join(" · ")], width: W4[1] },
        { texts: ["القيم الأساسية"], width: W4[2], bold: true },
        { texts: [MINISTRY_VALUES.join(" · ")], width: W4[3] },
      ]),
      row([
        { texts: ["المصطلحات والمفاهيم الرئيسة"], width: W4[0], bold: true },
        { texts: [d.keyTerms.length > 0 ? d.keyTerms.join(" · ") : "—"], width: W4[1] },
        { texts: ["الوسائل التعليمية"], width: W4[2], bold: true },
        { texts: [MINISTRY_TOOLS.join(" · ")], width: W4[3] },
      ]),
      row([
        { texts: ["مصادر التعلم الرئيسة"], width: W4[0], bold: true },
        { texts: [d.bookPagesLine], width: W4[1] },
        { texts: ["مصادر التعلم المساندة (إن وجدت)"], width: W4[2], bold: true },
        { texts: ["منصّة أبلة عفاف — حزمة الحصة والإثراء"], width: W4[3] },
      ]),
    ],
  });

  const WBODY = [2200, 3800, 2400, 1200]; // أهداف | أنشطة | تقويم | زمن

  const bodyTable = new Table({
    visuallyRightToLeft: true,
    columnWidths: [...WBODY].reverse(),
    width: { size: TOTAL, type: WidthType.DXA },
    rows: [
      row([
        { texts: ["التهيئة"], width: WBODY[0] + WBODY[1] + WBODY[2], bold: true, span: 3 },
        { texts: ["الزمن"], width: WBODY[3], bold: true },
      ]),
      row([
        { texts: [d.warmup], width: WBODY[0] + WBODY[1] + WBODY[2], span: 3 },
        { texts: [`${d.warmupMinutes} د`], width: WBODY[3] },
      ]),
      row([
        { texts: ["أهداف التعلم"], width: WBODY[0], bold: true },
        { texts: ["أنشطة التعليم والتعلم"], width: WBODY[1], bold: true },
        { texts: ["التقويم البنائي"], width: WBODY[2], bold: true },
        { texts: ["الزمن"], width: WBODY[3], bold: true },
      ]),
      row([
        { texts: ["يُتوقع في نهاية الدرس أن تكون الطالبة قادرة على أن:", ...d.objectives], width: WBODY[0] },
        { texts: d.activities, width: WBODY[1] },
        { texts: [d.assessment], width: WBODY[2] },
        { texts: [`${d.activitiesMinutes} د`], width: WBODY[3] },
      ]),
      row([
        { texts: ["الغلق الختامي"], width: WBODY[0], bold: true },
        { texts: [d.closure], width: WBODY[1] + WBODY[2], span: 2 },
        { texts: [`${d.closureMinutes} د`], width: WBODY[3] },
      ]),
      row([
        { texts: ["الواجب"], width: WBODY[0], bold: true },
        { texts: [d.homework], width: WBODY[1] + WBODY[2] + WBODY[3], span: 3 },
      ]),
    ],
  });

  const WFOOT = [2400, 7200];
  const footTable = new Table({
    visuallyRightToLeft: true,
    columnWidths: [...WFOOT].reverse(),
    width: { size: TOTAL, type: WidthType.DXA },
    rows: [
      row([
        { texts: ["المعايير المهنية للمعلمين"], width: WFOOT[0], bold: true },
        { texts: MINISTRY_PRO_STANDARDS.map((st, i) => `${i + 1}- ${st}`), width: WFOOT[1] },
      ]),
      row([
        { texts: ["استراتيجيات التعلم المقترحة"], width: WFOOT[0], bold: true },
        { texts: [MINISTRY_STRATEGIES.join(" · ")], width: WFOOT[1] },
      ]),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", rightToLeft: true, size: 22 } } } },
    sections: [
      {
        properties: {},
        children: [
          P(d.schoolName, { center: true, bold: true, color: "8A1538", size: 28 }),
          headerTable,
          P("", {}),
          bodyTable,
          P("", {}),
          footTable,
          P("توقيع المعلّمة: ................    توقيع المنسّقة: ................", { center: true }),
        ] as never[],
      },
    ],
  });
  await downloadBlob(await Packer.toBlob(doc), `تحضير-وزاري-${d.lessonTitle}.docx`);
}

// ── قائمة مشتريات المختبر (Excel) ────────────────────────────

export interface ShoppingItem {
  tool: string;
  lesson: string;
  /** عدد النسخ المطلوبة (لكل مجموعة/فصل) */
  qty?: number;
}

/** كشف مشتريات لأمين المختبر — §5: rightToLeft، نص يمين، أرقام وسط */
export async function downloadLabShoppingXlsx(items: ShoppingItem[], schoolName: string): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("مشتريات المختبر", { views: [{ rightToLeft: true }] });

  sheet.addRow([`${schoolName} — قائمة احتياجات مختبر العلوم (المستوى الخامس)`]);
  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").font = { name: "Arial", bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  const head = sheet.addRow(["م", "الأداة/المادة", "الدرس/التجربة", "الكمية"]);
  head.font = { name: "Arial", bold: true };
  items.forEach((it, i) => sheet.addRow([i + 1, it.tool, it.lesson, it.qty ?? ""]));

  sheet.columns = [{ width: 8 }, { width: 34 }, { width: 30 }, { width: 12 }];
  sheet.eachRow((row, r) => {
    if (r === 1) return;
    row.eachCell((cell, col) => {
      cell.font = cell.font ?? { name: "Arial" };
      cell.alignment = col === 2 || col === 3 ? { horizontal: "right", readingOrder: "rtl", vertical: "middle" } : { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  await downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "مشتريات-المختبر.xlsx");
}

// ── ملف الإنجاز (§ الأمر ٦ البند ٧) ──────────────────────────

export interface AchievementData {
  schoolName: string;
  yearName: string;
  plansCount: number;
  examsCount: number;
  certsCount: number;
  classStats: { className: string; average: number; passRate: number }[];
  topLessonsTaught: string[];
}

/** ملف إنجاز Word يجمع تلقائياً خطط المعلّمة وأنشطتها وإحصاءات نتائجها */
export async function downloadAchievementFile(data: AchievementData): Promise<void> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");

  const H = (text: string) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, rightToLeft: true, bold: true, color: "0B534C", size: 28 })] });
  const P = (text: string, bold = false) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, spacing: { after: 100 }, children: [new TextRun({ text, rightToLeft: true, bold })] });

  const statRow = (c: { className: string; average: number; passRate: number }) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${c.passRate}٪`, rightToLeft: true })] })] }),
        new TableCell({ width: { size: 2000, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${c.average}٪`, rightToLeft: true })] })] }),
        new TableCell({ width: { size: 3000, type: WidthType.DXA }, children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: c.className, rightToLeft: true, bold: true })] })] }),
      ],
    });

  const children: unknown[] = [
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `${data.schoolName} — ملف إنجاز معلّمة العلوم`, rightToLeft: true, bold: true, size: 32, color: "8A1538" })] }),
    new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: `المستوى الخامس · ${data.yearName}`, rightToLeft: true })] }),
    H("ملخص الجهد"),
    P(`عدد خطط الدروس المحضّرة: ${data.plansCount}`),
    P(`عدد الاختبارات المبنية: ${data.examsCount}`),
    P(`عدد الشهادات الممنوحة: ${data.certsCount}`),
    H("إحصاءات نتائج الطالبات"),
    new Table({
      visuallyRightToLeft: true,
      columnWidths: [2000, 2000, 3000],
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "نسبة النجاح", rightToLeft: true, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "المتوسط", rightToLeft: true, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "الفصل", rightToLeft: true, bold: true })] })] }),
          ],
        }),
        ...data.classStats.map(statRow),
      ],
    }),
    H("الدروس المنجزة"),
    ...data.topLessonsTaught.map((l) => P(`• ${l}`)),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", rightToLeft: true, size: 24 } } } },
    sections: [{ properties: {}, children: children as never[] }],
  });
  await downloadBlob(await Packer.toBlob(doc), `ملف-إنجاز-${data.yearName.replace("/", "-")}.docx`);
}
