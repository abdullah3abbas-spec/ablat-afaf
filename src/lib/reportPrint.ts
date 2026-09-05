/**
 * مستندات التقارير المطبوعة (§5 طباعة المتصفح):
 * بطاقة ولية الأمر (برسم أعمدة SVG أحادي السلسلة وفق قواعد dataviz)،
 * تقرير الإدارة، تقرير تحليل الاختبار، وورقة عمل من بنك الأسئلة.
 */
import type { Question } from "@/db/schema";
import type { ClassAdminReport, StudentReport } from "./reportData";
import type { ExamAnalysis } from "./examAnalysis";
import { toEastern } from "./numerals";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityFooter, identityHeader } from "./printTheme";
import { bookLessonByCode, type BookLessonMeta } from "@/content/bookG05S1P1";
import { WS_PANELS } from "@/content/wsActivities";
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
    ${identityFooter("تقرير الإدارة", termName)}${identityHeader(schoolName, "تقرير الإدارة (العلوم)", "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">${esc(termName)} · ${toEastern(new Date().toLocaleDateString("ar"))}</div></div>
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
    ${identityFooter("تحليل نتائج الاختبار")}${identityHeader(schoolName, "تحليل نتائج الاختبار", "")}<div class="head" style="border:0;padding:0;margin-bottom:2mm"><div class="meta">${esc(title)} · عدد النتائج: ${toEastern(String(analysis.resultsCount))} · المتوسط: ${toEastern(String(analysis.average))}</div></div>
    <table><tr><th class="c">س</th><th>نص السؤال</th><th class="c">معامل السهولة</th><th class="c">الخطأ الجماعي</th></tr>${rows}</table>
    <h2>دروس تحتاج إعادة شرح (خطأ جماعي > ٥٠٪)</h2>
    ${analysis.reteach.length === 0 ? `<p>لا دروس متعثرة.</p>` : `<ul class="recs" style="border-color:#B3261E;background:#FDECEA">${analysis.reteach.map((r) => `<li>${esc(r.lessonTitle)} — ${toEastern(String(r.hardQuestions))} سؤال عالي الخطأ (متوسط ${toEastern(String(r.avgErrorPct))}٪)</li>`).join("")}</ul>`}
  </body></html>`;
}

// ── ورقة عمل من بنك الأسئلة ──────────────────────────────────

/** صيغ المصطلح المحتملة داخل جمل الكتاب — الأطول أولاً حتى لا نقصّ داخل كلمة */
function termVariants(term: string): string[] {
  const v = new Set<string>([term, `ال${term}`]);
  if (term.startsWith("آكل ")) {
    const fem = term.replace("آكل ", "آكلة ");
    v.add(fem);
    v.add(`ال${fem}`);
  }
  if (term === "قارت") ["القوارت", "قوارت"].forEach((x) => v.add(x));
  return [...v].sort((a, b) => b.length - a.length);
}

const WS_DOTS = '<span class="ws-dots"></span>';
const wsAns = (s: string) => `<b class="ws-ans">${esc(s)}</b>`;

/** جمل «أكملي الفراغ» من خلاصات الدرس — نحجب المصطلح ونضعه في صندوق المصطلحات */
function wsBlankSentences(lesson: BookLessonMeta, withAnswers: boolean): string[] {
  const out: string[] = [];
  const used = new Set<number>();
  for (const v of lesson.vocab) {
    const variants = termVariants(v.term);
    const idx = lesson.takeaways.findIndex((t, i) => !used.has(i) && variants.some((x) => t.includes(x)));
    if (idx === -1) continue;
    used.add(idx);
    const t = lesson.takeaways[idx];
    const hit = variants.find((x) => t.includes(x))!;
    out.push(esc(t).replace(esc(hit), withAnswers ? wsAns(hit) : WS_DOTS));
    if (out.length >= 4) break;
  }
  return out;
}

const WS_ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

/**
 * ورقة عمل بنظام أوراق المدرسة الحقيقية:
 * ترويسة حقول (الاسم/الصف/التاريخ) · عنوان · أسئلة مرقّمة «السؤال الأول…» متنوعة الأنماط:
 * أكملي الفراغ بصندوق مصطلحات · نشاط مصوّر (لوحة مرسومة جاهزة) · ✓/✗ · اختيار وتوصيل وإجابات قصيرة.
 */
export function bankWorksheetHtml(
  questions: Question[],
  meta: { schoolName: string; title: string; unitName: string; lessonCode?: string },
  withAnswers: boolean
): string {
  const lesson = meta.lessonCode ? bookLessonByCode(meta.lessonCode)?.lesson : undefined;
  const panel = meta.lessonCode ? WS_PANELS[meta.lessonCode] : undefined;
  const lessonTitle = meta.title.replace(/^ورقة عمل:\s*/, "");

  const fillbank = questions.filter((q) => q.type === "fillblank");
  const tf = questions.filter((q) => q.type === "truefalse");
  const mcq = questions.filter((q) => q.type === "mcq");
  const rest = questions.filter((q) => !["fillblank", "truefalse", "mcq"].includes(q.type));

  const sections: string[] = [];
  const qbar = (instruction: string) =>
    `<div class="ws-qbar"><b>السؤال ${WS_ORDINALS[sections.length] ?? toEastern(String(sections.length + 1))}:</b> ${instruction}</div>`;

  // ١ — أكملي الفراغ بصندوق المصطلحات (من مفردات الدرس وخلاصاته + أسئلة الفراغ من البنك)
  const blanks = lesson ? wsBlankSentences(lesson, withAnswers) : [];
  const bankBlanks = fillbank.map((q) =>
    esc(q.text).replace(/[—ـ]{2,}|\.{4,}/g, withAnswers ? wsAns(String(q.answerKey ?? "")) : WS_DOTS)
  );
  const allBlanks = [...blanks, ...bankBlanks];
  if (allBlanks.length && lesson) {
    sections.push(`${qbar("أكملي الفراغ باستخدام المصطلحات التالية:")}
      <div class="ws-bank">${lesson.vocab.map((v) => esc(v.term)).join('<span class="sep">–</span>')}</div>
      <ol class="ws-blanks">${allBlanks.map((s) => `<li>${s}</li>`).join("")}</ol>`);
  }

  // ٢ — النشاط المصوّر: لوحة مرسومة جاهزة بدوائر تلوين
  if (panel) {
    const legend = panel.legend
      .map((l) => `<span class="ws-key"><i style="background:${l.hex}"></i> ${esc(l.label)} ${esc(l.colorAr)}</span>`)
      .join("");
    sections.push(`${qbar(esc(panel.instruction))}
      <div class="ws-legend">${legend}</div>
      <img class="ws-panel" src="${panel.img}" alt="${esc(panel.alt)}" onerror="this.remove()"/>
      ${withAnswers ? `<div class="ws-panel-ans">${panel.answers.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}`);
  }

  // ٣ — ضعي ✓ أو ✗ (عبارات اللوحة المشتقة أولاً ثم أسئلة البنك)
  const tfAll: { text: string; answer: boolean }[] = [
    ...(panel?.tfExtra ?? []),
    ...tf.map((q) => ({ text: q.text, answer: String(q.answerKey) === "true" })),
  ];
  if (tfAll.length) {
    const rows = tfAll
      .map((q) => {
        const mark = withAnswers ? (q.answer ? "✓" : "✗") : "";
        return `<tr><td class="box${withAnswers ? " ans" : ""}">${mark}</td><td>${esc(q.text)}</td></tr>`;
      })
      .join("");
    sections.push(`${qbar("ضعي علامة ✓ أمام العبارة الصحيحة وعلامة ✗ أمام العبارة الخطأ:")}
      <table class="ws-tf">${rows}</table>`);
  }

  // ٤ — اختاري الإجابة الصحيحة
  if (mcq.length) {
    const items = mcq
      .map(
        (q) => `<li>${esc(q.text)}
        <div class="ws-opts">${(q.options ?? []).map((o) => `<span${withAnswers && o.key === q.answerKey ? ' class="ws-ans"' : ""}>${esc(o.key)}) ${esc(o.text)}</span>`).join("")}</div></li>`
      )
      .join("");
    sections.push(`${qbar("اختاري رمز الإجابة الصحيحة:")}<ol class="ws-blanks ws-mcq">${items}</ol>`);
  }

  // ٥ — الباقي (توصيل · تعريف · تعليل …) بإجابات قصيرة
  if (rest.length) {
    const items = rest
      .map((q) => {
        const space = withAnswers
          ? `<div class="ws-restans">${wsAns(String(q.answerKey ?? ""))}</div>`
          : `<div class="ws-line"></div>${q.marks >= 3 ? '<div class="ws-line"></div>' : ""}`;
        return `<li>${esc(q.text)}${space}</li>`;
      })
      .join("");
    sections.push(`${qbar("أجيبي عن الأسئلة الآتية:")}<ol class="ws-blanks">${items}</ol>`);
  }

  const title = withAnswers ? `${meta.title} (نسخة الإجابات)` : meta.title;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${PRINT_FONTS_CSS}${IDENTITY_HEADER_CSS}${WS_CSS}</style></head><body>
    ${identityFooter(meta.title)}
    <img class="ws-letterhead" src="/letterhead.png" alt="مدرسة زكريت الابتدائية للبنات — وزارة التربية والتعليم والتعليم العالي"/>
    <div class="ws-fields"><span class="grow">الاسم: ${withAnswers ? "<b>نسخة الإجابات — للمعلّمة</b>" : ""}</span><span>الصف: ${esc("")}</span><span>التاريخ:</span></div>
    <div class="ws-title">ورقة عمل: ${esc(lessonTitle)}</div>
    ${sections.join("")}
  </body></html>`;
}

/** تنسيق ورقة العمل المدرسية — أبيض وأسود نظيف بخط Tajawal، يطابق شكل أوراق المدرسة */
const WS_CSS = `
  @page { size: A4; margin: 9mm 11mm 12mm 11mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Tajawal", sans-serif; font-size: 12.5pt; color: #111; direction: rtl; }
  .ws-letterhead { display: block; width: 100%; margin-bottom: 1.5mm; }
  .ws-fields { display: flex; gap: 4mm; border: 0.4mm solid #111; border-radius: 1.5mm; padding: 2mm 3mm; font-weight: 700; margin-bottom: 2.5mm; }
  .ws-fields .grow { flex: 1.4; } .ws-fields span { flex: 1; }
  .ws-fields span::after { content: " ........................."; font-weight: 400; color: #555; }
  .ws-fields .grow b { color: #8A1538; } .ws-fields .grow:has(b)::after { content: ""; }
  .ws-title { text-align: center; font-size: 15.5pt; font-weight: 800; color: #1D3557;
    border: 0.5mm solid #1D3557; border-radius: 1.5mm; padding: 1.6mm 2mm; margin-bottom: 3mm; }
  .ws-qbar { border: 0.4mm solid #111; border-radius: 1.5mm; padding: 1.6mm 3mm; font-weight: 700; margin: 3.5mm 0 2mm; background: #F6F6F6;
    break-inside: avoid; break-after: avoid; }
  .ws-tf tr, .ws-blanks li { break-inside: avoid; }
  .ws-panel, .ws-legend { break-inside: avoid; }
  .ws-qbar b { color: #8A1538; padding-inline-end: 1.5mm; }
  .ws-bank { border: 0.4mm solid #111; border-radius: 1.5mm; width: fit-content; margin: 0 auto 2mm;
    padding: 1.4mm 6mm; font-weight: 800; }
  .ws-bank .sep { padding: 0 4mm; color: #666; font-weight: 400; }
  .ws-blanks { padding-inline-start: 6.5mm; display: grid; gap: 1.8mm; }
  .ws-blanks li { line-height: 1.9; }
  .ws-dots::before { content: "................................"; letter-spacing: 0.6px; color: #444; }
  .ws-ans { color: #8A1538; }
  .ws-legend { display: flex; justify-content: center; gap: 7mm; font-weight: 700; margin-bottom: 1.6mm; }
  .ws-key i { display: inline-block; width: 4.2mm; height: 4.2mm; border-radius: 50%; vertical-align: -0.7mm; margin-inline-end: 1.2mm; }
  .ws-panel { display: block; width: 100%; border: 0.3mm solid #BBB; border-radius: 2mm; }
  .ws-panel-ans { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1mm 3mm; margin-top: 1.6mm;
    font-size: 10.5pt; font-weight: 700; color: #8A1538; }
  .ws-tf { width: 100%; border-collapse: collapse; }
  .ws-tf td { border: 0.35mm solid #111; padding: 1.6mm 3mm; line-height: 1.7; }
  .ws-tf .box { width: 13mm; text-align: center; font-size: 15pt; font-weight: 800; }
  .ws-tf .box.ans { color: #8A1538; }
  .ws-opts { display: flex; flex-wrap: wrap; gap: 2mm 8mm; padding: 1mm 2mm 0; font-weight: 500; }
  .ws-restans { color: #8A1538; margin-top: 1mm; }
  .ws-line { border-bottom: 0.3mm dotted #777; height: 7.5mm; }
`;

export function printDoc(html: string): void {
  printHtml(html);
}
