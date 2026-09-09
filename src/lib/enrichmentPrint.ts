/**
 * طباعة إثراء الحصة — HTML بطباعة المتصفح حصراً (§5):
 * ورقة المعلّمة (الوسيلة ولماذا وخطوات التنفيذ وأسئلة النقاش)
 * + بطاقات القص + نص القصة بخط كبير للقراءة المسرحية.
 */
import type { LessonEnrichment } from "@/content/enrichment";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityFooter, identityHeader } from "./printTheme";
import { printHtml } from "./sheetPrint";
import { getBrand } from "./brand";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  ${PRINT_FONTS_CSS}
  ${IDENTITY_HEADER_CSS}
  @page { size: A4; margin: 14mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Tajawal", sans-serif; font-size: 13pt; line-height: 1.9; color: #111; }
  .doc-header { text-align: center; border-bottom: 0.5mm solid #8A1538; padding-bottom: 3mm; margin-bottom: 5mm; }
  .doc-header h1 { font-size: 16pt; color: #8A1538; }
  .doc-header .meta { font-size: 10.5pt; color: #333; margin-top: 1mm; }
  h2 { font-size: 13.5pt; color: #0B534C; margin: 5mm 0 2mm; }
  .why { border: 0.5mm solid #0B534C; border-radius: 3mm; background: #E6F2F0; padding: 3mm 5mm; margin: 3mm 0; }
  ul, ol { padding-inline-start: 7mm; }
  li { margin-bottom: 2mm; }
  .badge { display: inline-block; background: #8A1538; color: #fff; border-radius: 3mm; padding: 1mm 4mm; font-size: 11pt; }
  .cards { display: flex; flex-wrap: wrap; gap: 5mm; margin-top: 3mm; }
  .cut-card { width: 85mm; min-height: 40mm; border: 0.5mm dashed #8A1538; border-radius: 3mm; padding: 4mm;
              display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13pt; font-weight: 700; }
  .story p { font-size: 14.5pt; margin-bottom: 5mm; text-align: justify; }
  .story p::first-letter { font-size: 20pt; color: #8A1538; }
  .page-break { page-break-after: always; }
  .footer-line { margin-top: 6mm; font-size: 10pt; color: #444; text-align: left; }
</style>
</head>
<body>${identityFooter(title)}${bodyHtml}</body>
</html>`;
}

function header(e: LessonEnrichment, schoolName: string, lessonTitle: string): string {
  return identityHeader(
    schoolName,
    `إثراء الحصة: ${e.title}`,
    `${getBrand().subjectName} · المستوى الخامس · الدرس ${e.lessonCode}: ${lessonTitle} · الوسيلة: ${e.vehicle} · ${e.minutes} دقيقة`
  );
}

/** ورقة المعلّمة الكاملة (+ القصة والبطاقات إن وجدت) */
export function enrichmentSheetHtml(e: LessonEnrichment, schoolName: string, lessonTitle: string): string {
  const parts: string[] = [header(e, schoolName, lessonTitle)];
  parts.push(`<div class="why"><strong>لماذا هذه الوسيلة لهذا الدرس؟</strong><br/>${esc(e.why)}</div>`);
  parts.push(`<h2>الأدوات</h2><ul>${e.materials.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`);
  parts.push(`<h2>خطوات التنفيذ</h2><ol>${e.steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol>`);
  if (e.story?.length) {
    parts.push(`<div class="page-break"></div><h2>نص القصة — للقراءة المسرحية</h2><div class="story">${e.story
      .map((p) => `<p>${esc(p)}</p>`)
      .join("")}</div>`);
  }
  if (e.cards?.length) {
    parts.push(`<div class="page-break"></div><h2>البطاقات — اقصّيها على الخطوط المتقطعة</h2><div class="cards">${e.cards
      .map((c) => `<div class="cut-card">${esc(c)}</div>`)
      .join("")}</div>`);
  }
  parts.push(`<h2>أسئلة ما بعد النشاط</h2><ol>${e.debrief.map((d) => `<li>${esc(d)}</li>`).join("")}</ol>`);
  parts.push(`<div class="footer-line">منصّة أبلة عفاف — إثراء مصمَّم لعقدة هذا الدرس تحديداً</div>`);
  return wrap(`إثراء ${e.lessonCode}`, parts.join("\n"));
}

export function printEnrichmentSheet(e: LessonEnrichment, schoolName: string, lessonTitle: string): void {
  printHtml(enrichmentSheetHtml(e, schoolName, lessonTitle));
}

/** بطاقات فقط — للطباعة السريعة قبل الحصة */
export function printEnrichmentCards(e: LessonEnrichment, schoolName: string, lessonTitle: string): void {
  if (!e.cards?.length) return;
  const body = [
    header(e, schoolName, lessonTitle),
    `<h2>البطاقات — اقصّيها على الخطوط المتقطعة</h2><div class="cards">${e.cards.map((c) => `<div class="cut-card">${esc(c)}</div>`).join("")}</div>`,
  ].join("\n");
  printHtml(wrap(`بطاقات ${e.lessonCode}`, body));
}
