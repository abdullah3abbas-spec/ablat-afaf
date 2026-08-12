/**
 * create-exam — يبني اختباراً رسمياً كاملاً من بنك أسئلة المنصّة.
 * مخرجان: ورقة الاختبار (نسخ أ/ب) + نموذج الإجابة وسلّم التصحيح وجدول المواصفات.
 * كل شيء محلي (§2-هـ) · طباعة المتصفح للعربية (§5).
 */
import { loadData } from "../_shared/data.mjs";
import {
  parseArgs,
  splitList,
  esc,
  dateYMD,
  fileDateSuffix,
  writeOutput,
  finalMessage,
} from "../_shared/format.mjs";
import { printableHtml } from "../_shared/print.mjs";
import {
  autoPick,
  buildVariant,
  defaultUnitPct,
  examSectionHtml,
  EXAM_CSS,
  COG_ORDER,
  COG_AR,
} from "../_shared/exam.mjs";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);
const policy = data.policy();

// نوع الاختبار من السياسة (بيانات لا كود)
const typeArg = typeof args.type === "string" ? args.type : "final";
const examTypes = policy?.examTypes ?? [];
const examType =
  examTypes.find((t) => t.key === typeArg) ??
  examTypes.find((t) => t.nameAr === typeArg || t.nameAr.includes(typeArg)) ??
  { key: typeArg, nameAr: typeArg === "final" ? "اختبار نهاية الفصل" : typeArg === "mid" ? "اختبار منتصف الفصل" : typeArg };

// الوحدات
const units = data.resolveUnits(splitList(args.units).map((u) => (/^\d+$/.test(u) ? +u : u)));
if (units.length === 0) {
  console.error("لم أجد وحدات مطابقة. جرّبي --units \"اسم الوحدة\" أو --units all");
  process.exit(1);
}
const unitIds = units.map((u) => u.id);

// الدرجة الكلية: من المكوّن المرتبط بالنوع، وإلا الافتراضي
const term = args.term === "2" ? 2 : 1;
function marksFromType() {
  const compKey = examType.carryToComponentKey;
  if (compKey) {
    const comp = (policy?.components ?? []).find((c) => c.key === compKey);
    if (comp) return comp.max;
  }
  return examType.key === "final" ? 35 : examType.key === "mid" ? 25 : 100;
}
const totalMarks = args.marks ? +args.marks : marksFromType();
const durationMinutes = args.duration ? +args.duration : Math.min(90, Math.max(30, Math.round(totalMarks * 1.2)));

// بناء الاختبار
const pool = data.questionsOfUnits(unitIds);
if (pool.length === 0) {
  console.error("لا توجد أسئلة في هذه الوحدات ببنك المنصّة. ارفعي الملازم أو أضيفي أسئلة أولاً.");
  process.exit(1);
}
const cognitivePct = policy?.cognitiveDefault ?? { remember: 30, understand: 35, apply: 25, higher: 10 };
const unitPct = defaultUnitPct(units, unitIds);
const { picked, marksSum, excludedRecentlyUsed } = autoPick(pool, { unitIds, totalMarks, cognitivePct, unitPct });

if (picked.length === 0) {
  console.error("تعذّر اختيار أسئلة كافية. جرّبي درجة كلية أقل أو وحدات أكثر.");
  process.exit(1);
}

const cls = args.class ? data.resolveClass(args.class) : null;
const nums = data.numeralsTable();
const meta = {
  schoolName: data.schoolName(),
  subjectName: data.subject().nameAr,
  gradeName: data.gradeName(),
  termName: term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني",
  yearName: data.currentYear().name,
  examTypeName: examType.nameAr,
  className: cls?.name,
  dateStr: dateYMD(Date.now(), nums),
  durationMinutes,
  totalMarks,
};

// نسخ أ/ب
const variantKeys = splitList(args.variants).length ? splitList(args.variants) : ["A"];
const LABEL = { A: "أ", B: "ب", C: "ج" };
const seedBase = Number(fileDateSuffix().replace(/-/g, "")); // بذرة من التاريخ = ثبات لليوم
const variants = variantKeys.map((k, i) => ({
  key: k,
  label: variantKeys.length > 1 ? LABEL[k.toUpperCase()] ?? k : "",
  vq: buildVariant(picked, seedBase + i * 977),
}));

// ورقة الاختبار (كل النسخ)
const paperBody = variants
  .map((v, i) => `${i > 0 ? '<div class="page-break"></div>' : ""}${examSectionHtml(v.vq, meta, { variantLabel: v.label, withAnswers: false })}`)
  .join("");
const paperHtml = printableHtml({ title: `${meta.examTypeName} — ${meta.subjectName}`, css: EXAM_CSS, body: paperBody });

// جدول المواصفات
function specTableHtml() {
  const cell = {};
  const unitTotals = {};
  const cogTotals = { remember: 0, understand: 0, apply: 0, higher: 0 };
  let grand = 0;
  for (const q of picked) {
    cell[q.unitId] = cell[q.unitId] ?? { remember: 0, understand: 0, apply: 0, higher: 0 };
    cell[q.unitId][q.cognitiveLevel] += q.marks;
    unitTotals[q.unitId] = (unitTotals[q.unitId] ?? 0) + q.marks;
    cogTotals[q.cognitiveLevel] += q.marks;
    grand += q.marks;
  }
  const rows = units
    .map(
      (u) =>
        `<tr><th>${esc(u.title)}</th>${COG_ORDER.map((c) => `<td>${cell[u.id]?.[c] ?? 0}</td>`).join("")}<td class="tot">${unitTotals[u.id] ?? 0}</td></tr>`
    )
    .join("");
  return `<h2 class="spec-title">جدول المواصفات</h2>
  <table class="spec"><tr><th>الوحدة \\ المستوى</th>${COG_ORDER.map((c) => `<th>${COG_AR[c]}</th>`).join("")}<th>المجموع</th></tr>
  ${rows}
  <tr><th>المجموع</th>${COG_ORDER.map((c) => `<td class="tot">${cogTotals[c]}</td>`).join("")}<td class="tot">${grand}</td></tr></table>
  <p class="spec-note">عدد الأسئلة: ${picked.length} · الدرجة الكلية: ${totalMarks} · زمن الاختبار: ${durationMinutes} دقيقة${excludedRecentlyUsed ? ` · استُبعد ${excludedRecentlyUsed} سؤالاً مستخدماً حديثاً` : ""}</p>`;
}

const answerBody =
  variants
    .map((v, i) => `${i > 0 ? '<div class="page-break"></div>' : ""}${examSectionHtml(v.vq, meta, { variantLabel: v.label, withAnswers: true })}`)
    .join("") + `<div class="page-break"></div>${specTableHtml()}`;
const answerCss =
  EXAM_CSS +
  `.spec-title{text-align:center;font-size:14pt;font-weight:700;margin:4mm 0}
   .spec{width:100%;border-collapse:collapse;font-size:11pt}
   .spec th,.spec td{border:0.3mm solid #000;padding:2mm;text-align:center}
   .spec .tot{font-weight:700;background:#f0f0f0}
   .spec-note{margin-top:3mm;font-size:11pt;text-align:center}`;
const answerHtml = printableHtml({ title: `نموذج الإجابة — ${meta.examTypeName}`, css: answerCss, body: answerBody });

// كتابة الملفات
const unitsLabel = units.map((u) => u.title).join("-").slice(0, 40);
const suffix = fileDateSuffix();
const paperPath = writeOutput(`اختبار-${examType.nameAr}-${unitsLabel}-${suffix}.html`, paperHtml);
const answerPath = writeOutput(`اختبار-${examType.nameAr}-${unitsLabel}-نموذج-الإجابة-${suffix}.html`, answerHtml);

const warn = marksSum !== totalMarks ? ` (ملاحظة: مجموع الأسئلة ${marksSum} من ${totalMarks} — عدّلي الوحدات أو الدرجة إن رغبتِ)` : "";
console.log(
  finalMessage({
    done: `جهّزت ${examType.nameAr} في ${data.subject().nameAr} — ${units.map((u) => u.title).join(" و ")}، ${picked.length} سؤالاً بدرجة ${totalMarks}${warn}.`,
    howTo: `في مجلد «المخرجات»: ورقة الاختبار «${paperPath.split("/").pop()}» ونموذج الإجابة. افتحيها وراجعيها ثم اطبعي.`,
    next: variants.length === 1 ? "تريدين نسخة (ب) أيضاً؟ أضيفي --variants A,B." : "النسختان أ و ب جاهزتان — اطبعي كلاً على حدة.",
  })
);
