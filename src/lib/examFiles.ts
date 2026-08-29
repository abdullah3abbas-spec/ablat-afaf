/**
 * مخرجات الاختبار الأربعة (§ الأمر ٤ رابعاً):
 * ورقة الاختبار (طباعة §5 + Word) بالترويسة الرسمية الكاملة،
 * نموذج الإجابة بسلّم التصحيح، جدول المواصفات Excel (بمعادلات لا
 * أرقام مجمّدة)، ونسختا أ/ب بنماذجهما.
 */
import { db } from "@/db";
import type { Exam, Question, Unit } from "@/db/schema";
import { buildVariant, COG_AR, COG_ORDER, markQuestionsUsed, type VariantQuestion } from "./examBuilder";
import { printHtml } from "./sheetPrint";

const TYPE_AR: Record<Question["type"], string> = {
  mcq: "اختاري الإجابة الصحيحة",
  truefalse: "ضعي صح أو خطأ مع التصحيح",
  matching: "صنّفي / صِلي",
  fillblank: "أكملي الفراغ",
  define: "عرّفي",
  order: "رتّبي",
  readchart: "اقرئي الجدول وأجيبي",
  drawlabel: "ارسمي وسمّي",
  justify: "علّلي علمياً",
  shortessay: "أجيبي بإيجاز",
  inquiry: "استقصاء علمي",
};

export interface ExamMeta {
  schoolName: string;
  subjectName: string;
  gradeName: string;
  termName: string;
  yearName: string;
  examTypeName: string;
  className?: string;
  dateStr: string;
}

/** ترويسة الورقة الرسمية + خانات الطالبة + جدول الرصد + التعليمات */
function officialHeader(exam: Exam, meta: ExamMeta, variantLabel: string, count: number): string {
  const gradingCells = Array.from({ length: count }, (_, i) => `<td class="c">${i + 1}</td>`).join("");
  const gradingEmpty = Array.from({ length: count }, () => `<td></td>`).join("");
  return `
  <img class="letterhead" src="/letterhead.png" alt="دولة قطر — وزارة التربية والتعليم والتعليم العالي — ${esc(meta.schoolName)}" />
  <table class="meta-table">
    <tr>
      <td>المادة: <b>${esc(meta.subjectName)}</b></td>
      <td>الصف: <b>${esc(meta.gradeName)}</b></td>
      <td>الفصل الدراسي: <b>${esc(meta.termName)}</b></td>
      <td>العام الأكاديمي: <b>${esc(meta.yearName)}</b></td>
    </tr>
    <tr>
      <td>نوع الاختبار: <b>${esc(meta.examTypeName)}</b> ${variantLabel ? `— النسخة <b>${variantLabel}</b>` : ""}</td>
      <td>الزمن: <b>${exam.durationMinutes} دقيقة</b></td>
      <td>الدرجة الكلية: <b>${exam.totalMarks}</b></td>
      <td>التاريخ: <b>${esc(meta.dateStr)}</b></td>
    </tr>
  </table>
  <div class="student-fields">
    اسم الطالبة: <span class="dots wide"></span>
    الرقم: <span class="dots"></span>
    الشعبة: <span class="dots">${meta.className ? esc(meta.className) : ""}</span>
  </div>
  <table class="grading">
    <tr><th>رقم السؤال</th>${gradingCells}<th>المجموع</th></tr>
    <tr><th>الدرجة المستحقة</th>${gradingEmpty}<td></td></tr>
    <tr><th>الدرجة المرصودة</th>${gradingEmpty}<td></td></tr>
  </table>
  <div class="instructions">تعليمات: اقرئي كل سؤال بتمعّن · أجيبي بقلم أزرق أو أسود · الدرجة مدوّنة بجانب كل سؤال · تأكدي من إجابة جميع الأسئلة قبل التسليم.</div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** جسد سؤال واحد (للورقة أو النموذج) */
function questionHtml(vq: VariantQuestion, index: number, withAnswer: boolean): string {
  const q = vq.question;
  const opts = vq.options ?? q.options;
  const optionsHtml =
    q.type === "mcq" && opts
      ? `<div class="opts">${opts.map((o) => `<span class="opt">${o.key}) ${esc(o.text)}</span>`).join("")}</div>`
      : "";
  const answerSpace =
    withAnswer || q.type === "mcq"
      ? ""
      : q.type === "drawlabel"
        ? `<div class="draw-box"></div>`
        : `<div class="ans-line"></div>${q.marks >= 3 ? '<div class="ans-line"></div>' : ""}`;
  const answer = withAnswer
    ? `<div class="model-answer"><b>الإجابة:</b> ${
        q.type === "mcq" ? esc(vq.correctKey ?? String(q.answerKey ?? "")) : esc(String(q.answerKey ?? ""))
      }<div class="rubric">سلّم التصحيح: ${rubricOf(q)}</div></div>`
    : "";
  return `<div class="q">
    <div class="q-head"><span class="q-num">${index + 1}</span><span class="q-type">${TYPE_AR[q.type]}:</span><span class="q-marks">(${q.marks} ${q.marks === 1 ? "درجة" : "درجات"})</span></div>
    <p class="q-text">${esc(q.text)}</p>
    ${optionsHtml}${answerSpace}${answer}
  </div>`;
}

/** سلّم تصحيح مشتق من نوع السؤال ودرجته */
function rubricOf(q: Question): string {
  switch (q.type) {
    case "mcq":
    case "truefalse":
      return `الإجابة الصحيحة كاملة = ${q.marks}`;
    case "fillblank":
    case "define":
      return `المصطلح/الإكمال الدقيق = ${q.marks} · إجابة قريبة بلفظ مغاير = ${Math.max(q.marks - 1, 0)}`;
    case "matching":
      return `توزَّع ${q.marks} درجات بالتساوي على المفردات المصنّفة`;
    case "order":
      return `الترتيب كاملاً = ${q.marks} · خطأ موضع واحد = ${Math.max(q.marks - 1, 0)}`;
    case "justify":
      return `ذكر السبب العلمي = ${Math.max(q.marks - 1, 1)} · دقة الصياغة = 1`;
    case "drawlabel":
      return `الرسم الصحيح = ${Math.max(q.marks - 1, 1)} · التسمية = 1`;
    case "readchart":
      return `قراءة البيانات = ${Math.max(q.marks - 1, 1)} · الاستنتاج = 1`;
    case "shortessay":
    case "inquiry":
      return `الفكرة العلمية = ${Math.max(q.marks - 2, 1)} · التفسير/التصميم = ${Math.min(2, q.marks - 1) > 0 ? 2 : 1}`;
  }
}

const EXAM_CSS = `
  @page { size: A4; margin: 12mm 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Amiri", "Tajawal", serif; font-size: 12.5pt; line-height: 1.9; color: #000; counter-reset: page; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  .letterhead { width: 100%; max-height: 20mm; object-fit: contain; display: block; margin-bottom: 2mm; }
  .state-line, .ministry, .school { text-align: center; font-weight: 700; }
  .state-line { font-size: 13pt; }
  .ministry { font-size: 14pt; }
  .school { font-size: 12.5pt; margin-bottom: 2mm; border-bottom: 0.5mm double #000; padding-bottom: 2mm; }
  .meta-table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 11pt; }
  .meta-table td { border: 0.3mm solid #000; padding: 1.5mm 2.5mm; }
  .student-fields { margin: 2.5mm 0; font-size: 12pt; }
  .dots { display: inline-block; min-width: 28mm; border-bottom: 0.3mm dotted #000; margin-inline-end: 6mm; }
  .dots.wide { min-width: 70mm; }
  .grading { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 2.5mm; }
  .grading th, .grading td { border: 0.3mm solid #000; padding: 1.2mm; text-align: center; min-width: 8mm; }
  .instructions { border: 0.4mm solid #000; border-radius: 2mm; padding: 2mm 3mm; font-size: 10.5pt; margin-bottom: 4mm; }
  .q { margin-bottom: 5mm; page-break-inside: avoid; }
  .q-head { display: flex; align-items: center; gap: 3mm; font-weight: 700; }
  .q-num { display: inline-flex; align-items: center; justify-content: center; min-width: 8mm; height: 8mm; border: 0.4mm solid #000; border-radius: 50%; }
  .q-marks { margin-inline-start: auto; font-size: 11pt; }
  .q-text { margin: 1.5mm 0; }
  .opts { display: flex; flex-wrap: wrap; gap: 3mm 10mm; padding-inline-start: 10mm; }
  .ans-line { border-bottom: 0.3mm dotted #555; height: 9mm; }
  .draw-box { border: 0.4mm solid #555; border-radius: 2mm; height: 45mm; margin-top: 2mm; }
  .model-answer { background: #f0f0f0; border: 0.3mm solid #999; border-radius: 2mm; padding: 2mm 3mm; margin-top: 1.5mm; }
  .rubric { font-size: 10.5pt; color: #333; margin-top: 1mm; }
  .the-end { text-align: center; font-weight: 700; font-size: 13pt; margin-top: 8mm; }
  .signatures { display: flex; justify-content: space-between; margin-top: 10mm; font-size: 11pt; }
  .footer-note { position: fixed; bottom: 4mm; left: 0; right: 0; text-align: center; font-size: 9.5pt; }
`;

/** مستند طباعة كامل لورقة اختبار (أو نموذج إجابتها) */
export function examPrintHtml(
  exam: Exam,
  variant: VariantQuestion[],
  meta: ExamMeta,
  opts: { variantLabel: string; withAnswers: boolean }
): string {
  const title = `${meta.examTypeName} — ${meta.subjectName}${opts.variantLabel ? ` — نسخة ${opts.variantLabel}` : ""}${opts.withAnswers ? " — نموذج الإجابة" : ""}`;
  const questions = variant.map((vq, i) => questionHtml(vq, i, opts.withAnswers)).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${EXAM_CSS}</style></head><body>
    ${opts.withAnswers ? `<div class="ministry">نموذج الإجابة وسلّم التصحيح — ${esc(meta.examTypeName)} ${opts.variantLabel ? `(نسخة ${opts.variantLabel})` : ""}</div><div class="school">${esc(meta.subjectName)} · ${esc(meta.gradeName)} · ${esc(meta.yearName)}</div>` : officialHeader(exam, meta, opts.variantLabel, variant.length)}
    ${questions}
    <div class="the-end">انتهت الأسئلة — بالتوفيق يا بناتي</div>
    <div class="signatures"><span>توقيع المعلّمة: ................</span><span>منسّقة المادة: ................</span><span>مديرة المدرسة: ................</span></div>
  </body></html>`;
}

// ── Word (docx) ───────────────────────────────────────────────

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** ورقة اختبار Word قابلة للتعديل — قواعد §5 كاملة + ترقيم صفحات */
export async function downloadExamDocx(
  exam: Exam,
  variant: VariantQuestion[],
  meta: ExamMeta,
  opts: { variantLabel: string; withAnswers: boolean }
): Promise<void> {
  const docx = await import("docx");
  const { AlignmentType, Document, Footer, PageNumber, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = docx;

  const P = (text: string, o?: { bold?: boolean; center?: boolean; size?: number; boxed?: boolean }) =>
    new Paragraph({
      bidirectional: true,
      alignment: o?.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
      spacing: { after: 120 },
      border: o?.boxed ? { top: { style: "single" as never, size: 4 }, bottom: { style: "single" as never, size: 4 }, left: { style: "single" as never, size: 4 }, right: { style: "single" as never, size: 4 } } : undefined,
      children: [new TextRun({ text, rightToLeft: true, bold: o?.bold, size: o?.size ?? 24 })],
    });

  const children: unknown[] = [
    P("دولة قطر", { bold: true, center: true, size: 26 }),
    P("وزارة التربية والتعليم والتعليم العالي", { bold: true, center: true, size: 28 }),
    P(meta.schoolName, { bold: true, center: true, size: 26 }),
    P(`المادة: ${meta.subjectName} · الصف: ${meta.gradeName} · الفصل الدراسي: ${meta.termName} · العام: ${meta.yearName}`, { center: true }),
    P(`نوع الاختبار: ${meta.examTypeName}${opts.variantLabel ? ` — النسخة ${opts.variantLabel}` : ""} · الزمن: ${exam.durationMinutes} دقيقة · الدرجة الكلية: ${exam.totalMarks} · التاريخ: ${meta.dateStr}`, { center: true }),
    P("اسم الطالبة: .......................................... · الرقم: .......... · الشعبة: .........."),
  ];

  // جدول رصد الدرجات — أعمدة معكوسة يدوياً (§5)
  const nums = variant.map((_, i) => String(i + 1));
  const rowOf = (label: string, cells: string[]) =>
    new TableRow({
      children: [
        ...cells.map(
          (c) =>
            new TableCell({
              width: { size: 700, type: WidthType.DXA },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [new TextRun({ text: c, rightToLeft: true })] })],
            })
        ),
        new TableCell({
          width: { size: 2200, type: WidthType.DXA },
          children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, rightToLeft: true, bold: true })] })],
        }),
      ],
    });
  children.push(
    new Table({
      visuallyRightToLeft: true,
      columnWidths: [...nums.map(() => 700), 2200],
      rows: [
        rowOf("رقم السؤال", [...nums, "المجموع"]),
        rowOf("الدرجة المستحقة", Array.from({ length: nums.length + 1 }, () => "")),
        rowOf("الدرجة المرصودة", Array.from({ length: nums.length + 1 }, () => "")),
      ],
    })
  );

  children.push(P("تعليمات: اقرئي كل سؤال بتمعّن · أجيبي بقلم أزرق أو أسود · الدرجة مدوّنة بجانب كل سؤال.", { boxed: true }));

  variant.forEach((vq, i) => {
    const q = vq.question;
    children.push(P(`س${i + 1}) ${TYPE_AR[q.type]}: ${q.text} (${q.marks} ${q.marks === 1 ? "درجة" : "درجات"})`, { bold: true }));
    if (q.type === "mcq") {
      const opts2 = vq.options ?? q.options ?? [];
      children.push(P(opts2.map((o) => `${o.key}) ${o.text}`).join("        ")));
    } else if (!opts.withAnswers) {
      children.push(P("..............................................................................."));
    }
    if (opts.withAnswers) {
      children.push(P(`الإجابة: ${q.type === "mcq" ? (vq.correctKey ?? String(q.answerKey ?? "")) : String(q.answerKey ?? "")}`, { bold: true }));
      children.push(P(`سلّم التصحيح: ${rubricOf(q)}`));
    }
  });

  children.push(P("انتهت الأسئلة — بالتوفيق يا بناتي", { bold: true, center: true, size: 26 }));
  children.push(P("توقيع المعلّمة: ................    منسّقة المادة: ................    مديرة المدرسة: ................", { center: true }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", rightToLeft: true, size: 24 } } } },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                children: [
                  new TextRun({ text: "صفحة ", rightToLeft: true }),
                  new TextRun({ children: [PageNumber.CURRENT], rightToLeft: true }),
                  new TextRun({ text: " من ", rightToLeft: true }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], rightToLeft: true }),
                ],
              }),
            ],
          }),
        },
        children: children as never[],
      },
    ],
  });

  const suffix = `${opts.variantLabel ? `-نسخة-${opts.variantLabel}` : ""}${opts.withAnswers ? "-نموذج-الإجابة" : ""}`;
  await downloadBlob(await Packer.toBlob(doc), `${meta.examTypeName}-${meta.subjectName}${suffix}.docx`);
}

// ── جدول المواصفات Excel — مجاميع بمعادلات ───────────────────

export async function downloadSpecTableXlsx(exam: Exam, questions: Question[], units: Unit[], meta: ExamMeta): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("جدول المواصفات", { views: [{ rightToLeft: true }] });

  sheet.getCell("A1").value = `جدول مواصفات ${meta.examTypeName} — ${meta.subjectName} — ${meta.gradeName} — ${meta.yearName}`;
  sheet.mergeCells("A1", `${String.fromCharCode(66 + COG_ORDER.length + 1)}1`);
  sheet.getCell("A1").font = { name: "Arial", bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  // الرأس: الوحدة | المستويات الأربعة | المجموع | النسبة
  const header = ["الوحدة", ...COG_ORDER.map((c) => COG_AR[c]), "المجموع", "النسبة ٪"];
  sheet.addRow([]);
  const headRow = sheet.addRow(header);
  headRow.font = { name: "Arial", bold: true };

  const startRow = headRow.number + 1;
  const chosenUnits = units.filter((u) => exam.unitIds.includes(u.id!));

  for (const unit of chosenUnits) {
    const counts = COG_ORDER.map((cog) => {
      const qs = questions.filter((q) => q.unitId === unit.id && q.cognitiveLevel === cog);
      const marks = qs.reduce((s, q) => s + q.marks, 0);
      return qs.length > 0 ? `${qs.length} أسئلة (${marks} درجة)` : "—";
    });
    // خلية الدرجات الرقمية تُخزَّن في أعمدة مساعدة للمعادلات؟ نبقيها نصاً وصفياً + عمود درجات رقمي
    const marksNum = questions.filter((q) => q.unitId === unit.id).reduce((s, q) => s + q.marks, 0);
    sheet.addRow([unit.title, ...counts, marksNum, ""]);
  }
  const endRow = sheet.lastRow!.number;

  // المجاميع بمعادلات لا أرقاماً مجمّدة (مهارة xlsx)
  const totalCol = String.fromCharCode(65 + 1 + COG_ORDER.length); // العمود بعد المستويات
  const pctCol = String.fromCharCode(66 + 1 + COG_ORDER.length);
  for (let r = startRow; r <= endRow; r++) {
    sheet.getCell(`${pctCol}${r}`).value = {
      formula: `ROUND(${totalCol}${r}/${totalCol}${endRow + 1}*100,1)`,
    };
  }
  const totalRow = sheet.addRow(["المجموع", ...COG_ORDER.map(() => ""), "", ""]);
  sheet.getCell(`${totalCol}${totalRow.number}`).value = {
    formula: `SUM(${totalCol}${startRow}:${totalCol}${endRow})`,
  };
  sheet.getCell(`${pctCol}${totalRow.number}`).value = { formula: `SUM(${pctCol}${startRow}:${pctCol}${endRow})` };
  totalRow.font = { name: "Arial", bold: true };

  // تنسيق §5: نص يمين، أرقام وسط
  sheet.columns.forEach((col, idx) => {
    col.width = idx === 0 ? 26 : 16;
  });
  sheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      cell.font = cell.font ?? { name: "Arial" };
      cell.alignment =
        colNumber === 1
          ? { horizontal: "right", readingOrder: "rtl", vertical: "middle", wrapText: true }
          : { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  await downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `جدول-مواصفات-${meta.examTypeName}.xlsx`
  );
}

// ── التوليد الكامل بضغطة واحدة ────────────────────────────────

export interface GeneratedVariants {
  A: VariantQuestion[];
  B: VariantQuestion[];
}

/** بناء النسختين من أسئلة الاختبار المرتبة (بذرتان ثابتتان من رقم الاختبار) */
export function buildVariants(examId: number, questions: Question[]): GeneratedVariants {
  return {
    A: buildVariant(questions, examId * 7919 + 1),
    B: buildVariant(questions, examId * 7919 + 2),
  };
}

/**
 * «ولّدي الملفات» — بضغطة واحدة:
 * Word للنسختين + نموذجَي الإجابة + جدول المواصفات Excel،
 * وتعليم الأسئلة مستخدمة وتحديث حالة الاختبار.
 */
export async function generateAllFiles(exam: Exam, questions: Question[], units: Unit[], meta: ExamMeta): Promise<void> {
  const variants = buildVariants(exam.id!, questions);
  await downloadExamDocx(exam, variants.A, meta, { variantLabel: "أ", withAnswers: false });
  await downloadExamDocx(exam, variants.B, meta, { variantLabel: "ب", withAnswers: false });
  await downloadExamDocx(exam, variants.A, meta, { variantLabel: "أ", withAnswers: true });
  await downloadExamDocx(exam, variants.B, meta, { variantLabel: "ب", withAnswers: true });
  await downloadSpecTableXlsx(exam, questions, units, meta);

  const now = Date.now();
  await markQuestionsUsed(questions.map((q) => q.id!), now);
  await db.exams.update(exam.id!, {
    status: "ready",
    variants: ["A", "B"],
    exports: [
      { kind: "wordExam", path: `${meta.examTypeName}-نسخة-أ.docx`, createdAt: now },
      { kind: "variantB", path: `${meta.examTypeName}-نسخة-ب.docx`, createdAt: now },
      { kind: "answerKey", path: `${meta.examTypeName}-نموذج-الإجابة.docx`, createdAt: now },
      { kind: "specTable", path: `جدول-مواصفات.xlsx`, createdAt: now },
    ],
    updatedAt: now,
  });
}

/** طباعة نسخة (§5) — ورقة أو نموذج إجابة */
export function printExam(exam: Exam, variant: VariantQuestion[], meta: ExamMeta, opts: { variantLabel: string; withAnswers: boolean }): void {
  printHtml(examPrintHtml(exam, variant, meta, opts));
}
