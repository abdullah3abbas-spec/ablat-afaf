/**
 * lesson-plan — خطة تحضير درس بنموذج المدرسة → Word (docx).
 * تُعبّأ الأهداف والمعايير من الدرس؛ الباقي حقول تُكملها المعلّمة.
 * العربية باتجاه صحيح (§5) · محلي بالكامل (§2-هـ).
 */
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, WidthType } from "docx";
import { loadData } from "../_shared/data.mjs";
import { parseArgs, dateYMD, fileDateSuffix, writeOutputBuffer, finalMessage } from "../_shared/format.mjs";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

if (typeof args.lesson !== "string") {
  console.error('حدّدي الدرس: --lesson "اسم الدرس"');
  process.exit(1);
}
const lesson = data.resolveLesson(args.lesson);
if (!lesson) {
  console.error(`لم أجد درساً باسم «${args.lesson}». تأكّدي من رفع المنهج أو جرّبي اسماً أقرب.`);
  process.exit(1);
}
const unit = data.units().find((u) => u.id === lesson.unitId);
const dateStr = typeof args.date === "string" ? args.date : dateYMD(Date.now(), data.numeralsTable());

// تعبئة تلقائية من الدرس
const objectives = (lesson.objectives?.length ? lesson.objectives : lesson.learningOutcomes?.map((o) => o.text)) ?? [];
const standards = lesson.standards ?? unit?.standards ?? [];

const FIELDS = [
  { label: "الأهداف", value: objectives.map((o, i) => `${i + 1}. ${o}`).join("\n") || "— أن تكون الطالبة قادرة على …" },
  { label: "المعايير", value: standards.join(" · ") || "—" },
  { label: "التمهيد", value: `سؤال مثير أو مشهد قصير يربط الطالبات بموضوع «${lesson.title}».` },
  { label: "الاستراتيجيات", value: "التعلّم التعاوني · العصف الذهني · الاستقصاء" },
  { label: "الأنشطة", value: "١. عرض تمهيدي\n٢. نشاط جماعي / تجربة\n٣. ورقة عمل\n٤. مناقشة ختامية" },
  { label: "الوسائل", value: "العرض التقديمي · أدوات التجربة · ورقة العمل · السبورة" },
  { label: "التقويم", value: "كرت خروج + أسئلة شفهية أثناء الحصة" },
  { label: "الواجب", value: "—" },
  { label: "الفروق الفردية", value: "نسخة دعم مبسّطة للمتعثّرات · مهمة إثراء للمتفوّقات" },
];

const cellP = (text, bold = false) =>
  String(text)
    .split("\n")
    .map((line) => new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: line, rightToLeft: true, bold, font: "Arial" })] }));

const row = (label, value) =>
  new TableRow({
    children: [
      new TableCell({ width: { size: 7200, type: WidthType.DXA }, children: cellP(value || "—") }),
      new TableCell({ width: { size: 2200, type: WidthType.DXA }, children: cellP(label, true) }),
    ],
  });

const children = [
  new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: data.schoolName(), rightToLeft: true, bold: true, size: 28, color: "8A1538", font: "Arial" })] }),
  new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `التحضير اليومي — ${data.subject().nameAr} · ${data.gradeName()} · ${unit?.title ?? ""} · ${lesson.title} · ${dateStr}`, rightToLeft: true, font: "Arial" })] }),
  new Table({
    visuallyRightToLeft: true,
    columnWidths: [7200, 2200],
    width: { size: 9400, type: WidthType.DXA },
    rows: FIELDS.map((f) => row(f.label, f.value)),
  }),
  new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: "توقيع المعلّمة: ................    توقيع المنسّقة: ................", rightToLeft: true, font: "Arial" })] }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Arial", rightToLeft: true, size: 24 } } } },
  sections: [{ properties: {}, children }],
});

const buffer = await Packer.toBuffer(doc);
const path = writeOutputBuffer(`تحضير-${lesson.title}-${fileDateSuffix()}.docx`, buffer);

console.log(
  finalMessage({
    done: `جهّزت خطة تحضير «${lesson.title}» (${unit?.title ?? ""}) بنموذج المدرسة، والأهداف معبّأة من المنهج.`,
    howTo: `الملف «${path.split("/").pop()}» في مجلد المخرجات — افتحيه في Word، أكملي التمهيد والأنشطة، ثم اطبعي.`,
    next: "تريدين خطة لدرس آخر؟ شغّلي المهارة باسمه.",
  })
);
