/**
 * مستندات التقارير المطبوعة (§5 طباعة المتصفح):
 * بطاقة ولية الأمر (برسم أعمدة SVG أحادي السلسلة وفق قواعد dataviz)،
 * تقرير الإدارة، تقرير تحليل الاختبار، وورقة عمل من بنك الأسئلة.
 */
import type { Question } from "@/db/schema";
import type { ClassAdminReport, StudentReport } from "./reportData";
import type { ExamAnalysis } from "./examAnalysis";
import { toEastern } from "./numerals";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityHeader } from "./printTheme";
import { printHtml } from "./sheetPrint";

const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);

const REPORT_CSS = `
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ${PRINT_FONTS_CSS}
  ${IDENTITY_HEADER_CSS}
  body { font-family: "Tajawal", sans-serif; font-size: 12pt; line-height: 1.8; color: #1E2430; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .head { text-align: center; border-bottom: 0.5mm solid #8A1538; padding-bottom: 3mm; margin-bottom: 4mm; }
  .head h1 { font-size: 15pt; color: #8A1538; }
  .head .meta { font-size: 10.5pt; color: #444; }
  h2 { font-size: 12.5pt; color: #0B534C; margin: 4mm 0 2mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.3mm solid #444; padding: 1.5mm 2.5mm; text-align: right; }
  th { background: #F5EFE4; } .c { text-align: center; }
  .tiles { display: flex; gap: 4mm; margin: 3mm 0; }
  .tile { flex: 1; border: 0.4mm solid #E6DFD4; border-radius: 2.5mm; padding: 3mm; text-align: center; }
  .tile b { display: block; font-size: 17pt; }
  .tile span { font-size: 10pt; color: #555; }
  .recs { border: 0.5mm solid #0F6B62; border-radius: 2.5mm; background: #E6F2F0; padding: 3mm 5mm; }
  .recs li { margin-inline-start: 5mm; }
  .footer-sign { display: flex; justify-content: space-between; margin-top: 8mm; font-size: 11pt; }
  .chart-note { font-size: 9.5pt; color: #555; }
`;

/**
 * رسم أعمدة SVG أحادي السلسلة (dataviz): لون واحد تركوازي، أطراف
 * علوية مدوّرة، فجوة 2px، تسميات قيم مباشرة بلون الحبر لا لون السلسلة،
 * محاور وشبكة خافتة. RTL: نرسم الأعمدة من اليمين.
 */
export function barChartSvg(
  data: { label: string; value: number }[],
  opts: { maxValue: number; width?: number; height?: number; valueSuffix?: string }
): string {
  const W = opts.width ?? 660;
  const H = opts.height ?? 200;
  const padTop = 22;
  const padBottom = 34;
  const plotH = H - padTop - padBottom;
  const n = data.length || 1;
  const slot = W / n;
  const barW = Math.min(56, slot - 14);

  const bars = data
    .map((d, i) => {
      // RTL: العنصر الأول في أقصى اليمين
      const xCenter = W - (i + 0.5) * slot;
      const h = opts.maxValue > 0 ? Math.max(2, (d.value / opts.maxValue) * plotH) : 2;
      const y = padTop + plotH - h;
      const suffix = opts.valueSuffix ?? "";
      return `
      <rect x="${xCenter - barW / 2}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#0F6B62"/>
      <text x="${xCenter}" y="${y - 6}" text-anchor="middle" font-size="12" fill="#1E2430" font-weight="700">${toEastern(String(d.value))}${suffix}</text>
      <text x="${xCenter}" y="${H - 12}" text-anchor="middle" font-size="11.5" fill="#4A5568">${esc(d.label)}</text>`;
    })
    .join("");

  // خط أساس + شبكة خافتة عند 50% و100%
  const grid = [0.5, 1]
    .map((f) => {
      const y = padTop + plotH - plotH * f;
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#E6DFD4" stroke-width="1"/>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <line x1="0" y1="${padTop + plotH}" x2="${W}" y2="${padTop + plotH}" stroke="#4A5568" stroke-width="1.5"/>
    ${bars}
  </svg>`;
}

// ── بطاقة متابعة ولية الأمر ───────────────────────────────────

export function parentCardHtml(reports: StudentReport[], schoolName: string, termName: string): string {
  const pages = reports
    .map((r) => {
      const chartData = r.components
        .filter((c) => c.pct !== null)
        .map((c) => ({ label: c.name, value: c.pct! }));
      const compRows = r.components
        .map(
          (c) =>
            `<tr><td>${esc(c.name)}</td><td class="c">${c.mark === null ? "—" : toEastern(String(c.mark))}</td><td class="c">${toEastern(String(c.max))}</td></tr>`
        )
        .join("");
      return `<div class="page">
      ${identityHeader(schoolName, "بطاقة متابعة الطالبة", "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">العلوم · ${esc(termName)} · الفصل: ${esc(r.className)} · التاريخ: ${toEastern(new Date().toLocaleDateString("ar"))}</div></div>
      <h2>الطالبة: ${esc(r.student.name)}</h2>
      <div class="tiles">
        <div class="tile"><b>${toEastern(String(r.total))} / ${toEastern(String(r.outOf))}</b><span>المجموع</span></div>
        <div class="tile"><b>${toEastern(String(r.pct))}٪</b><span>النسبة</span></div>
        <div class="tile"><b>${esc(r.label)}</b><span>التقدير</span></div>
        <div class="tile"><b>${esc(r.points.levelName || "—")}</b><span>مستوى التحفيز</span></div>
      </div>
      <h2>الدرجات التفصيلية</h2>
      <table><tr><th>المكوّن</th><th class="c">الدرجة</th><th class="c">من</th></tr>${compRows}</table>
      ${chartData.length > 0 ? `<h2>نسب المكوّنات ٪</h2>${barChartSvg(chartData, { maxValue: 100, valueSuffix: "٪" })}` : ""}
      <div class="tiles">
        <div class="tile"><b>${toEastern(String(r.attendance.present))}</b><span>حضور الشهر</span></div>
        <div class="tile"><b>${toEastern(String(r.attendance.absent))}</b><span>غياب</span></div>
        <div class="tile"><b>${toEastern(String(r.attendance.late))}</b><span>تأخّر</span></div>
        <div class="tile"><b>${toEastern(String(r.points.monthly))}</b><span>نقاط الشهر</span></div>
      </div>
      ${r.notes.length > 0 ? `<h2>ملاحظات المعلّمة</h2><ul class="recs" style="border-color:#C08A2E;background:#FCF3E2">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <h2>التوصيات</h2>
      <ul class="recs">${r.recommendations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="footer-sign"><span>توقيع المعلّمة: ................</span><span>اطلاع ولية الأمر: ................</span></div>
    </div>`;
    })
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>بطاقات المتابعة</title><style>${REPORT_CSS}</style></head><body>${pages}</body></html>`;
}

// ── تقرير الإدارة ─────────────────────────────────────────────

export function adminReportHtml(reports: ClassAdminReport[], schoolName: string, termName: string): string {
  const rows = reports
    .map(
      (r) =>
        `<tr><td>${esc(r.className)}</td><td class="c">${toEastern(String(r.studentsCount))}</td><td class="c">${toEastern(String(r.gradedCount))}</td><td class="c">${toEastern(String(r.average))}٪</td><td class="c">${toEastern(String(r.passRate))}٪</td></tr>`
    )
    .join("");
  const charts = reports
    .map((r) => {
      const dist = r.distribution.filter((d) => d.count > 0);
      if (dist.length === 0) return "";
      const maxCount = Math.max(...dist.map((d) => d.count));
      return `<h2>توزيع التقديرات — ${esc(r.className)}</h2>${barChartSvg(
        dist.map((d) => ({ label: d.label, value: d.count })),
        { maxValue: maxCount }
      )}<p class="chart-note">القيم = عدد الطالبات في كل تقدير</p>`;
    })
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقرير الإدارة</title><style>${REPORT_CSS}</style></head><body>
    ${identityHeader(schoolName, "تقرير الإدارة (العلوم)", "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">${esc(termName)} · ${toEastern(new Date().toLocaleDateString("ar"))}</div></div>
    <h2>ملخص الفصول</h2>
    <table><tr><th>الفصل</th><th class="c">الطالبات</th><th class="c">المرصود لهنّ</th><th class="c">المتوسط</th><th class="c">نسبة النجاح</th></tr>${rows}</table>
    ${charts}
    <div class="footer-sign"><span>معلّمة المادة: ................</span><span>منسّقة المادة: ................</span></div>
  </body></html>`;
}

// ── تقرير تحليل الاختبار ──────────────────────────────────────

export function examAnalysisHtml(title: string, analysis: ExamAnalysis, schoolName: string): string {
  const rows = analysis.stats
    .map(
      (st, i) =>
        `<tr><td class="c">${toEastern(String(i + 1))}</td><td>${esc(st.question.text.slice(0, 70))}${st.question.text.length > 70 ? "…" : ""}</td><td class="c">${toEastern(String(Math.round(st.facility * 100)))}٪</td><td class="c" ${st.massErrorPct > 50 ? 'style="background:#FDECEA;font-weight:700"' : ""}>${toEastern(String(st.massErrorPct))}٪</td></tr>`
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تحليل ${esc(title)}</title><style>${REPORT_CSS}</style></head><body>
    ${identityHeader(schoolName, "تحليل نتائج الاختبار", "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">${esc(title)} · عدد النتائج: ${toEastern(String(analysis.resultsCount))} · المتوسط: ${toEastern(String(analysis.average))}</div></div>
    <table><tr><th class="c">س</th><th>نص السؤال</th><th class="c">معامل السهولة</th><th class="c">الخطأ الجماعي</th></tr>${rows}</table>
    <h2>دروس تحتاج إعادة شرح (خطأ جماعي > ٥٠٪)</h2>
    ${analysis.reteach.length === 0 ? `<p>لا دروس متعثرة.</p>` : `<ul class="recs" style="border-color:#B3261E;background:#FDECEA">${analysis.reteach.map((r) => `<li>${esc(r.lessonTitle)} — ${toEastern(String(r.hardQuestions))} سؤال عالي الخطأ (متوسط ${toEastern(String(r.avgErrorPct))}٪)</li>`).join("")}</ul>`}
  </body></html>`;
}

// ── ورقة عمل من بنك الأسئلة ──────────────────────────────────

export function bankWorksheetHtml(
  questions: Question[],
  meta: { schoolName: string; title: string; unitName: string },
  withAnswers: boolean
): string {
  const items = questions
    .map((q, i) => {
      const opts = q.type === "mcq" && q.options ? `<div style="padding-inline-start:8mm">${q.options.map((o) => `<span style="margin-inline-end:9mm">${o.key}) ${esc(o.text)}</span>`).join("")}</div>` : "";
      const space = withAnswers
        ? `<div class="recs" style="margin-top:1mm"><b>الإجابة:</b> ${esc(String(q.answerKey ?? ""))}</div>`
        : q.type === "mcq"
          ? ""
          : `<div style="border-bottom:0.3mm dotted #888;height:9mm"></div>${q.marks >= 3 ? '<div style="border-bottom:0.3mm dotted #888;height:9mm"></div>' : ""}`;
      return `<div style="margin-bottom:5mm"><b>${toEastern(String(i + 1))})</b> ${esc(q.text)} <span style="color:#555">(${toEastern(String(q.marks))})</span>${opts}${space}</div>`;
    })
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(meta.title)}</title><style>${REPORT_CSS}</style></head><body>
    ${identityHeader(meta.schoolName, `${meta.title}${withAnswers ? " (نسخة الإجابات)" : ""}`, "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">العلوم · المستوى الخامس · ${esc(meta.unitName)}</div>
    ${withAnswers ? "" : `<div style="font-size:11pt;margin-top:2mm">اسم الطالبة: .............................. · الرقم: ...... · التاريخ: ..........</div>`}</div>
    ${items}
  </body></html>`;
}

export function printDoc(html: string): void {
  printHtml(html);
}
