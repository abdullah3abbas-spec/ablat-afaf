/**
 * create-worksheet — ورقة عمل بترويسة المدرسة (+ نسخة إجابات).
 * محلي بالكامل (§2-هـ) · طباعة المتصفح للعربية (§5).
 */
import { loadData } from "../_shared/data.mjs";
import { parseArgs, splitList, esc, dateYMD, fileDateSuffix, writeOutput, finalMessage } from "../_shared/format.mjs";
import { printableHtml } from "../_shared/print.mjs";
import { TYPE_AR } from "../_shared/exam.mjs";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

// النطاق: درس أو وحدات
let scopeLabel = "";
let objectives = [];
let pool = [];
if (typeof args.lesson === "string") {
  const lesson = data.resolveLesson(args.lesson);
  if (!lesson) {
    console.error(`لم أجد درساً باسم «${args.lesson}». جرّبي --units بدلاً منه.`);
    process.exit(1);
  }
  scopeLabel = lesson.title;
  objectives = (lesson.objectives?.length ? lesson.objectives : lesson.learningOutcomes?.map((o) => o.text)) ?? [];
  const own = data.table("questions").filter((q) => !q.deletedAt && q.lessonId === lesson.id);
  pool = own.length >= 3 ? own : data.questionsOfUnits([lesson.unitId]);
} else {
  const units = data.resolveUnits(splitList(args.units).map((u) => (/^\d+$/.test(u) ? +u : u)));
  scopeLabel = units.map((u) => u.title).join(" و ");
  objectives = units.flatMap((u) => u.objectives ?? []);
  pool = data.questionsOfUnits(units.map((u) => u.id));
}
if (pool.length === 0) {
  console.error("لا توجد أسئلة مناسبة في البنك لهذا النطاق.");
  process.exit(1);
}

const count = Math.min(pool.length, args.count ? +args.count : 6);
const title = typeof args.title === "string" ? args.title : `ورقة عمل — ${scopeLabel}`;
const picked = [...pool].sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0) || a.id - b.id).slice(0, count);
const dateStr = dateYMD(Date.now(), data.numeralsTable());

function activityBlock(q, i, withAnswer) {
  const opts =
    q.type === "mcq" && q.options
      ? `<div class="opts">${q.options.map((o) => `<span>${o.key}) ${esc(o.text)}</span>`).join("")}</div>`
      : q.type === "truefalse"
        ? `<div class="opts"><span>( ) صح</span><span>( ) خطأ</span></div>`
        : q.type === "drawlabel"
          ? `<div class="draw"></div>`
          : `<div class="ans"></div>${q.marks >= 3 ? '<div class="ans"></div>' : ""}`;
  const answer = withAnswer ? `<div class="key"><b>الإجابة:</b> ${esc(String(q.answerKey ?? "—"))}</div>` : "";
  return `<div class="act"><div class="ah"><span class="n">${i + 1}</span><span class="tp">${TYPE_AR[q.type]}</span></div><p class="q">${esc(q.text)}</p>${withAnswer ? answer : opts}</div>`;
}

const objectivesHtml = objectives.length
  ? `<div class="objectives"><b>أهداف الورقة:</b><ul>${objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>`
  : "";

const header = (sub) => `
  <div class="head">
    <div class="school">${esc(data.schoolName())} — ${esc(data.subject().nameAr)} · ${esc(data.gradeName())}</div>
    <div class="title">${esc(sub)}</div>
  </div>`;

const body = `
  ${header(title)}
  <div class="fields">الاسم: <span class="line"></span> الشعبة: <span class="line short"></span> التاريخ: ${dateStr}</div>
  ${objectivesHtml}
  ${picked.map((q, i) => activityBlock(q, i, false)).join("")}
  <div class="foot">— أحسنتِ العمل —</div>
  <div class="page-break"></div>
  ${header(`نسخة الإجابات — ${scopeLabel}`)}
  ${picked.map((q, i) => activityBlock(q, i, true)).join("")}`;

const css = `
  @page{size:A4;margin:14mm}
  body{font-family:"Tajawal",sans-serif;font-size:13pt;line-height:1.9}
  .head{text-align:center;border-bottom:0.5mm solid #0B534C;padding-bottom:2mm;margin-bottom:3mm}
  .school{color:#333;font-weight:500}
  .title{font-size:16pt;font-weight:700;color:#0B534C;margin-top:1mm}
  .fields{border:0.3mm solid #000;border-radius:2mm;padding:2.5mm 3mm;margin:3mm 0;font-size:12pt}
  .line{display:inline-block;min-width:45mm;border-bottom:0.3mm dotted #000}.line.short{min-width:22mm}
  .objectives{background:#E6F2F0;border-radius:2mm;padding:2.5mm 4mm;margin-bottom:3mm}
  .objectives ul{margin-inline-start:6mm;margin-top:1mm}
  .act{margin:4mm 0;page-break-inside:avoid}
  .ah{display:flex;align-items:center;gap:3mm;font-weight:700}
  .n{display:inline-flex;align-items:center;justify-content:center;width:8mm;height:8mm;border:0.4mm solid #0B534C;border-radius:50%;color:#0B534C}
  .tp{color:#0B534C}
  .q{margin:1.5mm 0}
  .opts{display:flex;flex-wrap:wrap;gap:2mm 10mm;padding-inline-start:11mm}
  .ans{border-bottom:0.3mm dotted #666;height:10mm;margin-top:1mm}
  .draw{border:0.4mm solid #666;border-radius:2mm;height:40mm;margin-top:1mm}
  .key{background:#f0f0f0;border-radius:2mm;padding:2mm 3mm;margin-top:1mm}
  .foot{text-align:center;font-weight:700;color:#0B534C;margin-top:6mm}
`;

const html = printableHtml({ title, css, body });
const path = writeOutput(`ورقة-عمل-${scopeLabel.slice(0, 30)}-${fileDateSuffix()}.html`, html);

console.log(
  finalMessage({
    done: `جهّزت ورقة عمل بـ ${picked.length} أنشطة على «${scopeLabel}»${objectives.length ? " مع أهدافها" : ""}.`,
    howTo: `الملف «${path.split("/").pop()}» في مجلد المخرجات — افتحيه واطبعي. نسخة الإجابات في آخره.`,
    next: "تريدين نسخة دعم أبسط ونسخة إثراء؟ اطلبي «الفروق الفردية» لاحقاً.",
  })
);
