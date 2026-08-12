/**
 * parent-report — بطاقة متابعة لولية/ولي أمر طالبة (HTML للطباعة، §5).
 * الأرقام والتقدير من السياسة (§4) · التوصيات من أرقامها (§2-ز) · محلي (§2-هـ).
 */
import {
  loadData,
  leafComponents,
  termTotal,
  percentOf,
  gradeLabel,
  buildRecommendations,
  monthKeyOf,
} from "../_shared/data.mjs";
import { parseArgs, esc, dateYMD, fileDateSuffix, writeOutput, finalMessage } from "../_shared/format.mjs";
import { printableHtml } from "../_shared/print.mjs";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

if (typeof args.student !== "string") {
  console.error('حدّدي الطالبة: --student "اسم الطالبة"');
  process.exit(1);
}
const student = data.resolveStudent(args.student);
if (!student) {
  console.error(`لم أجد طالبة باسم «${args.student}».`);
  process.exit(1);
}
const term = args.term === "2" ? 2 : 1;
const cls = data.activeClasses().find((c) => c.id === student.classId);
const nums = data.numeralsTable();

// الدرجات
const leaves = leafComponents(data.gradeComponents(term));
const grades = data.gradesOf(student.id, term);
const components = leaves.map((c) => {
  const live = grades.filter((g) => g.gradeComponentId === c.id).sort((a, b) => b.createdAt - a.createdAt);
  const mark = live[0]?.mark ?? null;
  return { name: c.nameAr, mark, max: c.maxMark, pct: mark === null ? null : Math.round((mark / c.maxMark) * 100) };
});
const tt = termTotal(grades, leaves);
const pct = percentOf(tt.total, tt.countedOutOf || tt.outOf);
const label = gradeLabel(pct, data.gradeScale());

// الحضور والنقاط والأوسمة
const mk = monthKeyOf(Date.now());
const att = data.attendanceSummary(student.id, mk);
const cumulative = data.cumulativePoints(student.id);
const monthly = data.monthlyPoints(student.id, mk);
const level = data.levelOf(cumulative);
const badges = data.table("badges");
const badgeById = new Map(badges.map((b) => [b.id, b]));
const earned = (student.earnedBadges ?? []).map((e) => badgeById.get(e.badgeId)).filter(Boolean);

const scored = components.filter((c) => c.pct !== null);
const weakest = scored.length ? scored.reduce((m, c) => (c.pct < m.pct ? c : m)) : undefined;
const recs = buildRecommendations({
  pct: tt.counted > 0 ? pct : null,
  absent: att.absent,
  late: att.late,
  weakest: weakest ? { name: weakest.name, pct: weakest.pct } : undefined,
  monthlyPoints: monthly,
});

const compRows = components
  .map(
    (c) =>
      `<tr><th>${esc(c.name)}</th><td>${c.mark === null ? "—" : c.mark}</td><td>${c.max}</td><td>${c.pct === null ? "—" : c.pct + "٪"}</td></tr>`
  )
  .join("");

const badgesHtml = earned.length
  ? `<div class="badges">${earned.map((b) => `<span class="badge">${b.icon} ${esc(b.nameAr)}</span>`).join("")}</div>`
  : `<p class="muted">لا أوسمة بعد</p>`;

const body = `
  <div class="head">
    <div class="school">${esc(data.schoolName())} · ${esc(data.subject().nameAr)} · ${esc(data.gradeName())}</div>
    <div class="title">بطاقة متابعة الطالبة</div>
    <div class="sub">${term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني"} · ${esc(data.currentYear().name)} · ${dateYMD(Date.now(), nums)}</div>
  </div>

  <table class="info">
    <tr><th>اسم الطالبة</th><td>${esc(student.name)}</td><th>الفصل</th><td>${esc(cls?.name ?? "")}</td></tr>
    <tr><th>الرقم في الكشف</th><td>${student.rollNumber}</td><th>ولية/ولي الأمر</th><td>${esc(student.guardianName ?? "—")}</td></tr>
  </table>

  <h2>الدرجات</h2>
  <table class="grades">
    <tr><th>المكوّن</th><th>الدرجة</th><th>من</th><th>النسبة</th></tr>
    ${compRows}
    <tr class="total"><th>المجموع</th><td>${tt.total}</td><td>${tt.outOf}</td><td>${pct}٪</td></tr>
  </table>
  <p class="verdict">التقدير العام: <b>${esc(label)}</b>${tt.counted < leaves.length ? ` <span class="muted">(رُصد ${tt.counted} من ${leaves.length} مكوّنات حتى الآن)</span>` : ""}</p>

  <div class="two">
    <div class="box">
      <h3>الحضور هذا الشهر</h3>
      <p>حضرت: ${att.present} · غابت: ${att.absent} · تأخّرت: ${att.late} · بعذر: ${att.excused}</p>
    </div>
    <div class="box">
      <h3>النقاط والتحفيز</h3>
      <p>هذا الشهر: ${monthly} · التراكمية: ${cumulative} · المستوى: <b>${esc(level?.nameAr ?? "—")}</b></p>
    </div>
  </div>

  <h3>الأوسمة</h3>
  ${badgesHtml}

  ${recs.length ? `<h2>توصيات المعلّمة</h2><ul class="recs">${recs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}

  <div class="sign">
    <span>توقيع المعلّمة: ................</span>
    <span>توقيع ولية/ولي الأمر: ................</span>
  </div>
  <p class="note">نرجو الاطلاع على البطاقة وإعادتها موقّعة — شاكرين تعاونكم في متابعة ابنتكم.</p>
`;

const css = `
  @page{size:A4;margin:14mm}
  body{font-family:"Tajawal",sans-serif;font-size:12.5pt;line-height:1.85;color:#111}
  .head{text-align:center;border-bottom:0.6mm solid #8A1538;padding-bottom:2mm;margin-bottom:3mm}
  .school{color:#444;font-weight:500}
  .title{font-size:17pt;font-weight:700;color:#8A1538;margin-top:1mm}
  .sub{color:#555;font-size:11.5pt}
  h2{font-size:13.5pt;color:#8A1538;margin:4mm 0 1.5mm;border-inline-start:1mm solid #8A1538;padding-inline-start:2mm}
  h3{font-size:12.5pt;color:#0B534C;margin:2mm 0 1mm}
  table{width:100%;border-collapse:collapse;margin-bottom:1mm}
  .info th,.info td{border:0.3mm solid #999;padding:2mm 2.5mm;text-align:right;font-size:12pt}
  .info th{background:#f6eef0;width:22%}
  .grades th,.grades td{border:0.3mm solid #999;padding:2mm;text-align:center}
  .grades tr:first-child th{background:#8A1538;color:#fff}
  .grades .total th,.grades .total td{background:#f6eef0;font-weight:700}
  .verdict{margin:2mm 0;font-size:13pt}
  .two{display:flex;gap:4mm;margin:2mm 0}
  .box{flex:1;border:0.3mm solid #ccc;border-radius:2mm;padding:2.5mm 3mm}
  .badges{display:flex;flex-wrap:wrap;gap:2mm}
  .badge{background:#FCF3E2;color:#7A5716;border-radius:6mm;padding:1mm 3mm;font-weight:500}
  .recs{margin-inline-start:6mm;line-height:2}
  .muted{color:#777;font-size:11pt}
  .sign{display:flex;justify-content:space-between;margin-top:8mm;font-size:12pt}
  .note{text-align:center;color:#555;font-size:11pt;margin-top:3mm}
`;

const html = printableHtml({ title: `بطاقة متابعة — ${student.name}`, css, body });
const path = writeOutput(`تقرير-ولي-أمر-${student.name}-${fileDateSuffix()}.html`, html);

console.log(
  finalMessage({
    done: `جهّزت بطاقة متابعة «${student.name}» (${cls?.name ?? ""}) — التقدير: ${label}${tt.counted < leaves.length ? " حتى الآن" : ""}.`,
    howTo: `الملف «${path.split("/").pop()}» في مجلد المخرجات — راجعيه ثم افتحيه واطبعي أو احفظي PDF لإرساله.`,
    next: "تريدين بطاقة لطالبة أخرى؟ شغّلي المهارة باسمها.",
  })
);
