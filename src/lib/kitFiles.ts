/**
 * توليد الملفات الحقيقية للحزمة: عرض PowerPoint وورقة عمل وخطة Word.
 * قواعد §5 إلزامية: rtlMode لكل نص في pptx · bidirectional لكل فقرة
 * وrightToLeft لكل run في docx. المكتبتان تُحمَّلان كسولاً (ثقيلتان).
 */
import type { LessonKit } from "@/content/kitTypes";

// ألوان الهوية بلا # — قاعدة pptxgenjs الصارمة
const MAROON = "8A1538";
const TEAL_DARK = "0B534C";
const INK = "1E2430";

/** تنزيل عرض PowerPoint حقيقي قابل للتعديل */
export async function downloadPptx(kit: LessonKit): Promise<void> {
  const { default: Pptxgen } = await import("pptxgenjs");
  const pres = new Pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 × 5.625 بوصة
  pres.rtlMode = true;

  // شريحة العنوان
  const title = pres.addSlide();
  title.background = { color: "FFFFFF" };
  title.addText(kit.lessonTitle, {
    x: 0.5, y: 1.6, w: 9, h: 1.2,
    align: "center", fontFace: "Arial", fontSize: 40, bold: true, color: MAROON, rtlMode: true,
  });
  title.addText(`العلوم — المستوى الخامس · الوحدة: ${kit.unitTitle}`, {
    x: 0.5, y: 2.9, w: 9, h: 0.6,
    align: "center", fontFace: "Arial", fontSize: 18, color: TEAL_DARK, rtlMode: true,
  });

  for (const s of kit.slides) {
    const slide = pres.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(s.title, {
      x: 0.5, y: 0.35, w: 9, h: 0.8,
      align: "right", fontFace: "Arial", fontSize: 30, bold: true, color: MAROON, rtlMode: true,
    });
    slide.addText(
      s.bullets.map((b, i) => ({
        text: b,
        options: { bullet: true, breakLine: i < s.bullets.length - 1, paraSpaceAfter: 8 },
      })),
      {
        x: 0.7, y: 1.4, w: 8.6, h: 3.6,
        align: "right", fontFace: "Arial", fontSize: 20, color: INK, rtlMode: true, valign: "top",
      }
    );
    if (s.note) slide.addNotes(s.note);
  }

  await pres.writeFile({ fileName: `عرض-${kit.lessonTitle}.pptx` });
}

// ── Word ──────────────────────────────────────────────────────

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** بنية docx عربية مشتركة: rightToLeft على كل run وbidirectional على كل فقرة */
async function buildArabicDoc(children: unknown[]): Promise<Blob> {
  const { Document, Packer } = await import("docx");
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", rightToLeft: true, size: 26 } } },
    },
    sections: [{ properties: {}, children: children as never[] }],
  });
  return Packer.toBlob(doc);
}

/** ورقة عمل Word قابلة للتعديل (+ نسخة إجابات) */
export async function downloadWorksheetDocx(kit: LessonKit, withAnswers: boolean): Promise<void> {
  const { AlignmentType, HeadingLevel, Paragraph, TextRun } = await import("docx");

  const P = (text: string, opts?: { bold?: boolean; color?: string; heading?: boolean }) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      heading: opts?.heading ? HeadingLevel.HEADING_2 : undefined,
      spacing: { after: 160 },
      children: [
        new TextRun({ text, rightToLeft: true, bold: opts?.bold, color: opts?.color, size: opts?.heading ? 30 : 26 }),
      ],
    });

  const children: unknown[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `ورقة عمل${withAnswers ? " — نسخة الإجابات" : ""} · ${kit.lessonTitle}`,
          rightToLeft: true, bold: true, size: 34, color: MAROON,
        }),
      ],
    }),
    P(`العلوم — المستوى الخامس · الوحدة: ${kit.unitTitle}`, { color: TEAL_DARK }),
    P(withAnswers ? "" : "اسم الطالبة: ................ · الرقم: ...... · التاريخ: ..........."),
  ];

  kit.worksheet.forEach((q, i) => {
    children.push(P(`${i + 1}) ${q.text}`, { bold: true }));
    children.push(withAnswers ? P(`الإجابة: ${q.answer}`, { color: TEAL_DARK }) : P("..............................................................."));
  });

  downloadBlob(await buildArabicDoc(children), `ورقة-عمل-${kit.lessonTitle}${withAnswers ? "-إجابات" : ""}.docx`);
}

/** خطة درس Word بنموذج المدرسة — جدول معكوس الأعمدة (§5) */
export async function downloadPlanDocx(kit: LessonKit): Promise<void> {
  const { AlignmentType, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");

  const cellP = (text: string, bold = false) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, rightToLeft: true, bold })],
    });

  // §5: نعكس ترتيب الأعمدة يدوياً — خلية القيمة أولاً ثم العنوان
  const row = (label: string, value: string) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 7000, type: WidthType.DXA }, children: value.split("\n").map((v) => cellP(v)) }),
        new TableCell({ width: { size: 2400, type: WidthType.DXA }, children: [cellP(label, true)] }),
      ],
    });

  const p = kit.plan;
  const list = (a: string[]) => a.map((x) => `• ${x}`).join("\n");

  const children: unknown[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `خطة درس · ${kit.lessonTitle}`, rightToLeft: true, bold: true, size: 34, color: MAROON })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: `العلوم — المستوى الخامس · الوحدة: ${kit.unitTitle}`, rightToLeft: true, color: TEAL_DARK })],
    }),
    new Table({
      visuallyRightToLeft: true,
      columnWidths: [7000, 2400],
      width: { size: 9400, type: WidthType.DXA },
      rows: [
        row("الأهداف", list(p.objectives)),
        row("التمهيد", p.warmup),
        row("الاستراتيجيات", list(p.strategies)),
        row("الأنشطة", list(p.activities)),
        row("الوسائل", list(p.materials)),
        row("التقويم", p.assessment),
        row("الواجب", p.homework),
        row("الفروق الفردية", p.differentiation),
      ],
    }),
  ];

  downloadBlob(await buildArabicDoc(children), `خطة-درس-${kit.lessonTitle}.docx`);
}
