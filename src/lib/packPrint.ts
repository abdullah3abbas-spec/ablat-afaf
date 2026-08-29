/**
 * طباعة حزمة الحصة (١٥/١٠) — طباعة المتصفح حصراً (§5):
 * خطة الحصة والأنشطة وورقة الأسئلة وكرت الخروج والواجب في مستند واحد،
 * ونسخة المعلّمة بالإجابات والملاحظات في صفحات لاحقة.
 */
import type { LessonPackContent } from "@/db/schema";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityHeader } from "@/lib/printTheme";
import { printDoc } from "@/lib/reportPrint";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printLessonPack(title: string, pack: LessonPackContent, schoolName: string): void {
  const li = (arr: string[]) => arr.map((x) => `<li>${esc(x)}</li>`).join("");

  const stages = pack.plan.stages
    .map((st) => `<tr><td>${esc(st.name)}</td><td class="c">${st.minutes} د</td><td>${esc(st.what)}</td></tr>`)
    .join("");

  const qs = pack.questions
    .map((q, i) => {
      const opts = q.options ? `<ol class="opts">${q.options.map((o) => `<li><b>${esc(o.key)})</b> ${esc(o.text)}</li>`).join("")}</ol>` : "";
      return `<div class="q"><b>${i + 1})</b> ${esc(q.text)}${opts}</div>`;
    })
    .join("");

  const answers = pack.questions.map((q, i) => `<li><b>${i + 1})</b> ${esc(q.answer)}</li>`).join("");

  printDoc(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>حزمة ${esc(title)}</title>
  <style>
    ${PRINT_FONTS_CSS}
    ${IDENTITY_HEADER_CSS}
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: Tajawal, Arial, sans-serif; color: #1E2430; font-size: 12pt; line-height: 1.9; }
    header { border-bottom: 2pt solid #8A1538; padding-bottom: 3mm; margin-bottom: 5mm; }
    h1 { color: #8A1538; font-size: 20pt; }
    .meta { color: #4A5568; font-size: 10pt; }
    h2 { color: #0F6B62; font-size: 14pt; margin: 6mm 0 2mm; border-inline-start: 3pt solid #C08A2E; padding-inline-start: 3mm; }
    table { width: 100%; border-collapse: collapse; font-size: 11pt; }
    td, th { border: 1pt solid #E6DFD4; padding: 2mm 3mm; }
    th { background: #0F6B62; color: #fff; }
    .c { text-align: center; white-space: nowrap; }
    ul, ol { padding-inline-start: 7mm; }
    .box { border: 1.5pt solid #E6DFD4; border-radius: 4pt; padding: 3mm 4mm; margin-top: 2mm; }
    .q { margin: 3mm 0; }
    .opts { list-style: none; padding-inline-start: 6mm; }
    .teacher { page-break-before: always; }
    .warn { color: #7A5716; }
  </style></head><body>

  ${identityHeader(schoolName, `حزمة حصة: ${title}`, "العلوم — المستوى الخامس · جاهزة للتدريس والطباعة")}

  <h2>خطة الحصة (${pack.plan.stages.reduce((a, b) => a + b.minutes, 0)} دقيقة)</h2>
  <p><b>الأهداف:</b></p><ul>${li(pack.plan.objectives)}</ul>
  <table><tr><th>المرحلة</th><th>الزمن</th><th>ماذا يحدث</th></tr>${stages}</table>

  <h2>النشاط الافتتاحي (${pack.opener.minutes} د): ${esc(pack.opener.title)}</h2>
  <div class="box">${esc(pack.opener.text)}</div>

  <h2>أسئلة النقاش</h2><ul>${li(pack.discussion)}</ul>

  <h2>نشاط فردي: ${esc(pack.activityIndividual.title)}</h2>
  <div class="box">${esc(pack.activityIndividual.text)}</div>

  <h2>نشاط جماعي: ${esc(pack.activityGroup.title)}</h2>
  <div class="box">${esc(pack.activityGroup.text)}</div>

  <h2>ورقة الأسئلة</h2>${qs}

  <h2>كرت الخروج</h2><ul>${li(pack.exitTicket.questions)}</ul>

  <h2>الواجب المنزلي (اختياري)</h2><ul>${li(pack.homework.tasks)}</ul>

  <section class="teacher">
    <header><h1>نسخة المعلّمة</h1><p class="meta">${esc(title)} — الإجابات والملاحظات (لا تُوزَّع)</p></header>
    <h2>الإجابات النموذجية</h2><ol>${answers}</ol>
    <h2>ملاحظات المعلّمة</h2><div class="box">${esc(pack.teacherNotes.say)}</div>
    <h2 class="warn">أخطاء شائعة متوقعة</h2><ul>${li(pack.teacherNotes.misconceptions)}</ul>
    <h2>الأدوات المطلوبة</h2><ul>${li(pack.teacherNotes.materials)}</ul>
    <h2>المصادر</h2><ul>${li(pack.sources)}</ul>
  </section>

  </body></html>`);
}
