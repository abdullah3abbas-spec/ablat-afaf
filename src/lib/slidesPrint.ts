/**
 * طباعة العرض البصري / حفظه PDF (زكريت م٣) — طباعة المتصفح حصراً (§5):
 * صفحة أفقية لكل شريحة، والرسوم CSS بسيطة أمينة للمحتوى.
 * إجابات التفاعل لا تُطبع في نسخة العرض — تظهر في «ملاحظات المعلّمة» أسفل كل صفحة.
 */
import type { Presentation, VisualSlide } from "@/db/schema";
import { printDoc } from "@/lib/reportPrint";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function visualHtml(sl: VisualSlide): string {
  const parts: string[] = [];
  if (sl.bullets?.length) parts.push(`<ul class="bl">${sl.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
  if (sl.comparison) {
    parts.push(
      `<table class="cmp"><tr>${sl.comparison.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>` +
        sl.comparison.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") +
        `</table>`
    );
  }
  const seq = sl.cycle?.steps ?? sl.steps?.steps;
  if (seq?.length) {
    parts.push(
      `<div class="seq">${seq.map((s, i) => `<span class="step"><b>${i + 1}</b> ${esc(s)}</span>`).join('<span class="arr">←</span>')}${sl.cycle ? '<span class="loop">↩ دورة</span>' : ""}</div>`
    );
  }
  if (sl.labeled) {
    parts.push(
      `<div class="lab"><div class="center">${esc(sl.labeled.center)}</div><div class="tags">${sl.labeled.labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>`
    );
  }
  if (sl.icons) parts.push(`<ul class="ic">${sl.icons.items.map((it) => `<li>▣ ${esc(it.text)}</li>`).join("")}</ul>`);
  if (sl.interaction) parts.push(`<p class="inter">؟ ${esc(sl.interaction.prompt)}</p>`);
  return parts.join("");
}

function notesHtml(sl: VisualSlide): string {
  const items: string[] = [`قولي: ${esc(sl.note.say)}`];
  if (sl.note.ask) items.push(`اسألي: ${esc(sl.note.ask)}`);
  if (sl.note.expected) items.push(`المتوقعة: ${esc(sl.note.expected)}`);
  if (sl.note.misconception) items.push(`الخطأ الشائع: ${esc(sl.note.misconception)}`);
  if (sl.interaction) items.push(`إجابة النشاط: ${esc(sl.interaction.answer)}`);
  if (sl.source) items.push(`المصدر: ${esc(sl.source)}`);
  return `<div class="notes">${items.map((x) => `<span>${x}</span>`).join(" · ")}</div>`;
}

export function printSlides(p: Presentation, schoolName: string): void {
  const pages = p.slides
    .map(
      (sl, i) => `
  <section class="pg ${sl.layout === "cover" ? "cover" : ""}">
    <header>${esc(schoolName)} · العلوم — المستوى الخامس</header>
    <h2>${esc(sl.title)}</h2>
    ${visualHtml(sl)}
    ${notesHtml(sl)}
    <footer>شريحة ${i + 1} من ${p.slides.length}</footer>
  </section>`
    )
    .join("");

  printDoc(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(p.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: Tajawal, Arial, sans-serif; color: #1E2430; }
    .pg { page-break-after: always; min-height: 180mm; padding: 8mm; border: 1.5pt solid #E6DFD4; border-radius: 6pt; position: relative; }
    .pg.cover { background: #A34460; color: #fff; display: flex; flex-direction: column; justify-content: center; text-align: center; }
    .pg.cover h2 { font-size: 40pt; color: #fff; }
    header { font-size: 9pt; color: #4A5568; margin-bottom: 4mm; }
    .cover header { color: #E8D5A3; }
    h2 { font-size: 24pt; color: #A34460; margin-bottom: 5mm; }
    .bl { font-size: 15pt; line-height: 2; padding-inline-start: 8mm; }
    .cmp { width: 100%; border-collapse: collapse; font-size: 13pt; }
    .cmp th { background: #12796F; color: #fff; padding: 3mm; }
    .cmp td { border: 1pt solid #E6DFD4; padding: 3mm; }
    .seq { display: flex; flex-wrap: wrap; align-items: center; gap: 3mm; font-size: 12pt; }
    .step { border: 1.5pt solid #12796F; border-radius: 4pt; padding: 2.5mm 4mm; background: #FBF8F3; }
    .step b { color: #C7952F; }
    .arr { color: #C7952F; font-size: 16pt; }
    .loop { color: #12796F; font-size: 10pt; }
    .lab { text-align: center; }
    .lab .center { display: inline-block; border: 2.5pt solid #C7952F; border-radius: 50%; padding: 6mm 10mm; font-size: 16pt; font-weight: bold; margin-bottom: 4mm; }
    .lab .tags span { display: inline-block; border: 1pt solid #E6DFD4; border-radius: 99pt; padding: 1.5mm 4mm; margin: 1mm; font-size: 12pt; }
    .ic { list-style: none; font-size: 14pt; line-height: 2; }
    .inter { background: #FCF3E2; border: 1.5pt solid #C7952F; border-radius: 4pt; padding: 4mm; font-size: 16pt; font-weight: bold; color: #7C5A14; margin-top: 4mm; }
    .notes { position: absolute; bottom: 12mm; right: 8mm; left: 8mm; border-top: 1pt dashed #E6DFD4; padding-top: 2mm; font-size: 8.5pt; color: #4A5568; }
    .cover .notes { color: #E8D5A3; border-color: rgba(255,255,255,.3); }
    footer { position: absolute; bottom: 5mm; left: 8mm; font-size: 8pt; color: #4A5568; }
  </style></head><body>${pages}</body></html>`);
}
