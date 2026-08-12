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
