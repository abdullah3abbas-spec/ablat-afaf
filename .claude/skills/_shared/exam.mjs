/**
 * منطق بناء الاختبار — منقول من src/lib/examBuilder.ts (نفس الخوارزمية
 * المختبَرة) لكن يعمل على مصفوفة أسئلة من ملف البيانات بدل قاعدة Dexie.
 * + عرض ورقة الاختبار ونموذج الإجابة كـ HTML للطباعة (§5).
 */
import { esc } from "./format.mjs";

export const COG_ORDER = ["remember", "understand", "apply", "higher"];
export const COG_AR = { remember: "تذكّر", understand: "فهم", apply: "تطبيق", higher: "مهارات عليا" };
export const EXCLUDE_USED_WITHIN_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export const TYPE_AR = {
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

const DEFAULT_COG = { remember: 30, understand: 35, apply: 25, higher: 10 };

/** أوزان الوحدات الافتراضية بحسب عدد الحصص */
export function defaultUnitPct(units, selected) {
  const chosen = units.filter((u) => selected.includes(u.id));
  const totalSessions = chosen.reduce((s, u) => s + (u.sessionsCount ?? 1), 0) || 1;
  const pct = {};
  let acc = 0;
  chosen.forEach((u, i) => {
    if (i === chosen.length - 1) pct[u.id] = 100 - acc;
    else {
      const p = Math.round(((u.sessionsCount ?? 1) / totalSessions) * 100);
      pct[u.id] = p;
      acc += p;
    }
  });
  return pct;
}

/** مولّد عشوائي مضبوط (mulberry32) — نفس البذرة = نفس الترتيب */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith(arr, rnd) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * الاختيار التلقائي من مصفوفة أسئلة (نفس منطق autoPick):
 * يوزّع درجات المستويات على الوحدات، يلتقط الأقل استخداماً فالأحدث،
 * يستبعد المستخدم في آخر سنتين، ثم يضبط نحو الدرجة الكلية.
 */
export function autoPick(pool0, input) {
  const now = input.nowMs ?? Date.now();
  const cognitivePct = input.cognitivePct ?? DEFAULT_COG;
  const cutoff = now - EXCLUDE_USED_WITHIN_MS;
  const all = pool0.filter((q) => input.unitIds.includes(q.unitId));
  const pool = all.filter((q) => !q.lastUsedDate || q.lastUsedDate < cutoff);

  const picked = [];
  const used = new Set();
  for (const cog of COG_ORDER) {
    const cogTarget = Math.round((cognitivePct[cog] / 100) * input.totalMarks);
    if (cogTarget <= 0) continue;
    for (const unitId of input.unitIds) {
      const target = Math.round(((input.unitPct[unitId] ?? 0) / 100) * cogTarget);
      if (target <= 0) continue;
      let acc = 0;
      const candidates = pool
        .filter((q) => q.unitId === unitId && q.cognitiveLevel === cog && !used.has(q.id))
        .sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0) || b.createdAt - a.createdAt);
      for (const q of candidates) {
        if (acc >= target) break;
        if (acc + q.marks <= target + 1) {
          picked.push(q);
          used.add(q.id);
          acc += q.marks;
        }
      }
    }
  }
  let sum = picked.reduce((s, q) => s + q.marks, 0);
  if (sum < input.totalMarks) {
    const fillers = pool
      .filter((q) => !used.has(q.id))
      .sort((a, b) => a.marks - b.marks || (a.usageCount ?? 0) - (b.usageCount ?? 0));
    for (const q of fillers) {
      if (sum >= input.totalMarks) break;
      if (sum + q.marks <= input.totalMarks) {
        picked.push(q);
        used.add(q.id);
        sum += q.marks;
      }
    }
  }
  return { picked, marksSum: sum, excludedRecentlyUsed: all.length - pool.length };
}

/** توليد نسخة (أ/ب): ترتيب مختلف وخيارات مخلوطة مع تتبع الصحيحة */
export function buildVariant(questions, seed) {
  const rnd = seededRandom(seed);
  const ordered = shuffleWith(questions, rnd);
  const KEYS = ["أ", "ب", "ج", "د", "هـ", "و"];
  return ordered.map((question) => {
    if (question.type === "mcq" && question.options && question.options.length > 1) {
      const shuffled = shuffleWith(question.options, rnd);
      const relabeled = shuffled.map((opt, i) => ({ key: KEYS[i], text: opt.text }));
      const correctIdx = shuffled.findIndex((opt) => opt.key === question.answerKey);
      return { question, options: relabeled, correctKey: KEYS[correctIdx] ?? undefined };
    }
    return { question };
  });
}

/** سلّم تصحيح مشتق من نوع السؤال ودرجته */
export function rubricOf(q) {
  const m = q.marks;
  switch (q.type) {
    case "mcq":
    case "truefalse":
      return `الإجابة الصحيحة كاملة = ${m}`;
    case "fillblank":
    case "define":
      return `المصطلح/الإكمال الدقيق = ${m} · إجابة قريبة بلفظ مغاير = ${Math.max(m - 1, 0)}`;
    case "matching":
      return `توزَّع ${m} درجات بالتساوي على المفردات المصنّفة`;
    case "order":
      return `الترتيب كاملاً = ${m} · خطأ موضع واحد = ${Math.max(m - 1, 0)}`;
    case "justify":
      return `ذكر السبب العلمي = ${Math.max(m - 1, 1)} · دقة الصياغة = 1`;
    case "drawlabel":
      return `الرسم الصحيح = ${Math.max(m - 1, 1)} · التسمية = 1`;
    case "readchart":
      return `قراءة البيانات = ${Math.max(m - 1, 1)} · الاستنتاج = 1`;
    default:
      return `الفكرة العلمية = ${Math.max(m - 2, 1)} · التفسير/التصميم = ${m - 1 >= 2 ? 2 : 1}`;
  }
}

function questionHtml(vq, index, withAnswer) {
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

function officialHeader(meta, variantLabel, count) {
  const cells = Array.from({ length: count }, (_, i) => `<td class="c">${i + 1}</td>`).join("");
  const empty = Array.from({ length: count }, () => `<td></td>`).join("");
  return `
  <div class="state-line">دولة قطر</div>
  <div class="ministry">وزارة التربية والتعليم والتعليم العالي</div>
  <div class="school">${esc(meta.schoolName)}</div>
  <table class="meta-table">
    <tr><td>المادة: <b>${esc(meta.subjectName)}</b></td><td>الصف: <b>${esc(meta.gradeName)}</b></td><td>الفصل الدراسي: <b>${esc(meta.termName)}</b></td><td>العام: <b>${esc(meta.yearName)}</b></td></tr>
    <tr><td>نوع الاختبار: <b>${esc(meta.examTypeName)}</b> ${variantLabel ? `— النسخة <b>${variantLabel}</b>` : ""}</td><td>الزمن: <b>${meta.durationMinutes} دقيقة</b></td><td>الدرجة الكلية: <b>${meta.totalMarks}</b></td><td>التاريخ: <b>${esc(meta.dateStr)}</b></td></tr>
  </table>
  <div class="student-fields">اسم الطالبة: <span class="dots wide"></span> الرقم: <span class="dots"></span> الشعبة: <span class="dots">${meta.className ? esc(meta.className) : ""}</span></div>
  <table class="grading"><tr><th>رقم السؤال</th>${cells}<th>المجموع</th></tr><tr><th>الدرجة المستحقة</th>${empty}<td></td></tr><tr><th>الدرجة المرصودة</th>${empty}<td></td></tr></table>
  <div class="instructions">تعليمات: اقرئي كل سؤال بتمعّن · أجيبي بقلم أزرق أو أسود · الدرجة مدوّنة بجانب كل سؤال · تأكدي من إجابة جميع الأسئلة قبل التسليم.</div>`;
}

export const EXAM_CSS = `
  @page { size: A4; margin: 12mm 14mm; }
  body { font-family: "Amiri","Tajawal",serif; font-size: 12.5pt; line-height: 1.9; color:#000; }
  .state-line,.ministry,.school{text-align:center;font-weight:700}
  .state-line{font-size:13pt}.ministry{font-size:14pt}
  .school{font-size:12.5pt;margin-bottom:2mm;border-bottom:0.5mm double #000;padding-bottom:2mm}
  .meta-table{width:100%;border-collapse:collapse;margin:2mm 0;font-size:11pt}
  .meta-table td{border:0.3mm solid #000;padding:1.5mm 2.5mm}
  .student-fields{margin:2.5mm 0;font-size:12pt}
  .dots{display:inline-block;min-width:28mm;border-bottom:0.3mm dotted #000;margin-inline-end:6mm}
  .dots.wide{min-width:70mm}
  .grading{width:100%;border-collapse:collapse;font-size:10.5pt;margin-bottom:2.5mm}
  .grading th,.grading td{border:0.3mm solid #000;padding:1.2mm;text-align:center;min-width:8mm}
  .instructions{border:0.4mm solid #000;border-radius:2mm;padding:2mm 3mm;font-size:10.5pt;margin-bottom:4mm}
  .q{margin-bottom:5mm;page-break-inside:avoid}
  .q-head{display:flex;align-items:center;gap:3mm;font-weight:700}
  .q-num{display:inline-flex;align-items:center;justify-content:center;min-width:8mm;height:8mm;border:0.4mm solid #000;border-radius:50%}
  .q-marks{margin-inline-start:auto;font-size:11pt}
  .q-text{margin:1.5mm 0}
  .opts{display:flex;flex-wrap:wrap;gap:3mm 10mm;padding-inline-start:10mm}
  .ans-line{border-bottom:0.3mm dotted #555;height:9mm}
  .draw-box{border:0.4mm solid #555;border-radius:2mm;height:45mm;margin-top:2mm}
  .model-answer{background:#f0f0f0;border:0.3mm solid #999;border-radius:2mm;padding:2mm 3mm;margin-top:1.5mm}
  .rubric{font-size:10.5pt;color:#333;margin-top:1mm}
  .the-end{text-align:center;font-weight:700;font-size:13pt;margin-top:8mm}
  .signatures{display:flex;justify-content:space-between;margin-top:10mm;font-size:11pt}
  .page-break{page-break-before:always}
`;

/** جسم ورقة اختبار واحدة (أو نموذج إجابتها) */
export function examSectionHtml(variant, meta, { variantLabel = "", withAnswers = false }) {
  const questions = variant.map((vq, i) => questionHtml(vq, i, withAnswers)).join("");
  const head = withAnswers
    ? `<div class="ministry">نموذج الإجابة وسلّم التصحيح — ${esc(meta.examTypeName)} ${variantLabel ? `(نسخة ${variantLabel})` : ""}</div><div class="school">${esc(meta.subjectName)} · ${esc(meta.gradeName)} · ${esc(meta.yearName)}</div>`
    : officialHeader(meta, variantLabel, variant.length);
  return `${head}${questions}
  <div class="the-end">انتهت الأسئلة — بالتوفيق يا بناتي</div>
  <div class="signatures"><span>توقيع المعلّمة: ................</span><span>منسّقة المادة: ................</span><span>مديرة المدرسة: ................</span></div>`;
}
