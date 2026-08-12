/**
 * create-quiz — تقييم صفي قصير من بنك الأسئلة (ورقة + نموذج إجابة).
 * محلي بالكامل (§2-هـ) · طباعة المتصفح للعربية (§5).
 */
import { loadData } from "../_shared/data.mjs";
import { parseArgs, splitList, esc, dateYMD, fileDateSuffix, writeOutput, finalMessage } from "../_shared/format.mjs";
import { printableHtml } from "../_shared/print.mjs";
import { TYPE_AR } from "../_shared/exam.mjs";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

// جمع الأسئلة: من درس محدّد، أو من وحدات
let scopeLabel = "";
let pool = [];
if (typeof args.lesson === "string") {
  const lesson = data.resolveLesson(args.lesson);
  if (!lesson) {
    console.error(`لم أجد درساً باسم «${args.lesson}». جرّبي اسماً أقرب أو --units.`);
    process.exit(1);
  }
  scopeLabel = lesson.title;
  pool = data.table("questions").filter((q) => !q.deletedAt && (q.lessonId === lesson.id || q.unitId === lesson.unitId));
  // فضّلي أسئلة الدرس نفسه إن وُجدت
  const own = pool.filter((q) => q.lessonId === lesson.id);
  if (own.length >= 3) pool = own;
} else {
  const units = data.resolveUnits(splitList(args.units).map((u) => (/^\d+$/.test(u) ? +u : u)));
  scopeLabel = units.map((u) => u.title).join(" و ");
  pool = data.questionsOfUnits(units.map((u) => u.id));
}
if (pool.length === 0) {
  console.error("لا توجد أسئلة مناسبة في البنك لهذا النطاق.");
  process.exit(1);
}

const count = Math.min(pool.length, args.count ? +args.count : 5);
const minutes = args.minutes ? +args.minutes : 5;

// اختيار: الأقل استخداماً أولاً، وتنويع الأنواع قدر الإمكان
const sorted = [...pool].sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0) || a.id - b.id);
const picked = [];
const usedTypes = new Set();
for (const q of sorted) {
  if (picked.length >= count) break;
  if (usedTypes.has(q.type) && usedTypes.size < 4 && picked.length < count - 1) continue;
  picked.push(q);
  usedTypes.add(q.type);
}
for (const q of sorted) {
  if (picked.length >= count) break;
  if (!picked.includes(q)) picked.push(q);
}

const nums = data.numeralsTable();
const dateStr = dateYMD(Date.now(), nums);

function questionBlock(q, i) {
  const opts =
    q.type === "mcq" && q.options
      ? `<div class="opts">${q.options.map((o) => `<span class="opt">${o.key}) ${esc(o.text)}</span>`).join("")}</div>`
      : q.type === "truefalse"
        ? `<div class="opts"><span class="opt">( ) صح</span><span class="opt">( ) خطأ</span></div>`
        : `<div class="ans"></div>`;
  return `<div class="q"><div class="qh"><span class="n">${i + 1}</span><span class="t">${TYPE_AR[q.type]} <span class="m">(${q.marks})</span></span></div><p class="qt">${esc(q.text)}</p>${opts}</div>`;
}

const quizBody = `
  <div class="head">
    <div class="school">${esc(data.schoolName())}</div>
    <div class="title">تقييم قصير — ${esc(data.subject().nameAr)}</div>
    <div class="sub">${esc(scopeLabel)} · الزمن: ${minutes} دقائق · الدرجة: ${picked.reduce((s, q) => s + q.marks, 0)}</div>
  </div>
  <div class="fields">الاسم: <span class="line"></span> الشعبة: <span class="line short"></span> التاريخ: ${dateStr}</div>
  ${picked.map(questionBlock).join("")}
  <div class="end">— بالتوفيق —</div>
  <div class="page-break"></div>
  <div class="head"><div class="title">نموذج الإجابة — ${esc(scopeLabel)}</div></div>
  <ol class="key">${picked
    .map((q) => `<li><b>${TYPE_AR[q.type]}:</b> ${esc(String(q.answerKey ?? "—"))} <span class="km">(${q.marks})</span></li>`)
    .join("")}</ol>`;

const css = `
  @page{size:A4;margin:14mm}
  body{font-family:"Tajawal",sans-serif;font-size:13pt;line-height:1.9}
  .head{text-align:center;margin-bottom:3mm}
  .school{font-weight:500;color:#333}
  .title{font-size:16pt;font-weight:700;color:#0B534C}
  .sub{color:#555;font-size:12pt;margin-top:1mm}
  .fields{border:0.3mm solid #000;border-radius:2mm;padding:2.5mm 3mm;margin:3mm 0;font-size:12pt}
  .line{display:inline-block;min-width:45mm;border-bottom:0.3mm dotted #000}
  .line.short{min-width:25mm}
  .q{margin:4mm 0;page-break-inside:avoid}
  .qh{display:flex;align-items:center;gap:3mm;font-weight:700}
  .n{display:inline-flex;align-items:center;justify-content:center;width:8mm;height:8mm;border:0.4mm solid #0B534C;border-radius:50%;color:#0B534C}
  .m{color:#0B534C}
  .qt{margin:1.5mm 0}
  .opts{display:flex;flex-wrap:wrap;gap:2mm 10mm;padding-inline-start:11mm}
  .ans{border-bottom:0.3mm dotted #666;height:10mm;margin-top:1mm}
  .end{text-align:center;font-weight:700;margin-top:6mm;color:#0B534C}
  .key{padding-inline-start:8mm;line-height:2.2}
  .km{color:#0B534C}
`;

const html = printableHtml({ title: `تقييم قصير — ${scopeLabel}`, css, body: quizBody });
const path = writeOutput(`كويز-${scopeLabel.slice(0, 30)}-${fileDateSuffix()}.html`, html);

console.log(
  finalMessage({
    done: `جهّزت كويز ${picked.length} أسئلة على «${scopeLabel}» (${minutes} دقائق).`,
    howTo: `الملف «${path.split("/").pop()}» في مجلد المخرجات — افتحيه واطبعي. نموذج الإجابة في آخر صفحة.`,
    next: "تريدينه أطول؟ أضيفي --count 8. أو على درس آخر بـ --lesson.",
  })
);
