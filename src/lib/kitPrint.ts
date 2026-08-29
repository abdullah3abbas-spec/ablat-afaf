/**
 * مولّدات طباعة عناصر الحزمة — HTML بطباعة المتصفح حصراً (§5).
 * كل زر «اطبعي» يستدعي printHtml فوراً بلا حوارات وسيطة.
 */
import type { KitGame, LessonKit } from "@/content/kitTypes";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityHeader } from "./printTheme";
import { printHtml } from "./sheetPrint";

/** غلاف صفحة الطباعة المشترك: خطوط محلية + RTL + ترويسة */
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
  .fields { display: flex; gap: 8mm; justify-content: center; font-size: 11pt; margin-top: 2mm; }
  .fields span { border-bottom: 0.3mm dotted #666; min-width: 38mm; display: inline-block; }
  h2 { font-size: 13.5pt; color: #0B534C; margin: 5mm 0 2mm; }
  ol.qs { padding-inline-start: 7mm; }
  ol.qs li { margin-bottom: 4mm; }
  .ans-line { border-bottom: 0.3mm dotted #888; height: 8mm; margin-top: 2mm; }
  .answer { color: #0B534C; font-weight: 700; background: #E6F2F0; padding: 1mm 3mm; border-radius: 2mm; display: inline-block; margin-top: 1mm; }
  .cards { display: flex; flex-wrap: wrap; gap: 5mm; }
  .card { width: 85mm; min-height: 42mm; border: 0.5mm dashed #8A1538; border-radius: 3mm; padding: 4mm;
          display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13.5pt; font-weight: 700; }
  .small-card { width: 85mm; border: 0.5mm dashed #0B534C; border-radius: 3mm; padding: 4mm; font-size: 11pt; }
  ul.steps { padding-inline-start: 6mm; }
  .safety { border: 0.6mm solid #B3261E; border-radius: 3mm; padding: 3mm 5mm; background: #FDECEA; margin: 3mm 0; }
  .safety h2 { color: #B3261E; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  th, td { border: 0.3mm solid #333; padding: 2mm 3mm; text-align: right; }
  th { background: #F5EFE4; }
  td.c, th.c { text-align: center; }
  .page-break { page-break-after: always; }
  .footer-line { margin-top: 6mm; font-size: 10pt; color: #444; text-align: left; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

interface HeaderInfo {
  schoolName: string;
  className?: string;
}

function docHeader(kind: string, kit: LessonKit, info: HeaderInfo, withStudentFields: boolean): string {
  const meta = `العلوم · المستوى الخامس · الوحدة: ${kit.unitTitle} · الدرس: ${kit.lessonTitle}${info.className ? ` · الفصل: ${info.className}` : ""}`;
  return `${identityHeader(info.schoolName, kind, meta)}
    ${withStudentFields ? `<div class="fields" style="margin-bottom:4mm"><span>اسم الطالبة: </span><span>الرقم: </span><span>التاريخ: </span></div>` : ""}`;
}

// ── ورقة العمل (+ نسخة الإجابات) ──────────────────────────────

export function worksheetHtml(kit: LessonKit, info: HeaderInfo, withAnswers: boolean): string {
  const items = kit.worksheet
    .map(
      (q) => `<li>${esc(q.text)}${
        withAnswers ? `<div class="answer">الإجابة: ${esc(q.answer)}</div>` : q.kind === "draw" ? `<div class="ans-line"></div><div class="ans-line"></div><div class="ans-line"></div>` : `<div class="ans-line"></div>`
      }</li>`
    )
    .join("");
  const title = withAnswers ? "ورقة عمل — نسخة الإجابات (للمعلّمة)" : "ورقة عمل";
  return wrap(`${title} — ${kit.lessonTitle}`, `${docHeader(title, kit, info, !withAnswers)}<ol class="qs">${items}</ol><div class="footer-line">إعداد المعلّمة: ................ · منصّة أبلة عفاف</div>`);
}

// ── بطاقات اللعبة ─────────────────────────────────────────────

export function gameCardsHtml(kit: LessonKit, info: HeaderInfo): string {
  const g: KitGame = kit.game;
  const how = g.howTo.map((h) => `<li>${esc(h)}</li>`).join("");
  const cards = g.cards.map((c) => `<div class="card">${esc(c)}</div>`).join("");
  return wrap(`لعبة ${g.name} — ${kit.lessonTitle}`, `
    ${docHeader(`لعبة الحصة: ${g.name} (${g.minutes} دقيقة)`, kit, info, false)}
    <h2>طريقة اللعب</h2><ul class="steps">${how}</ul>
    <div class="page-break"></div>
    ${docHeader(`بطاقات لعبة ${g.name} — تُقص على الخط المتقطع`, kit, info, false)}
    <div class="cards">${cards}</div>`);
}

// ── التجربة العملية ───────────────────────────────────────────

export function experimentHtml(kit: LessonKit, info: HeaderInfo): string {
  const e = kit.experiment;
  return wrap(`تجربة — ${e.title}`, `
    ${docHeader(`التجربة العملية: ${e.title}`, kit, info, true)}
    <h2>الأدوات والمواد</h2><ul class="steps">${e.tools.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="safety"><h2>إرشادات السلامة — نقرؤها قبل البدء</h2><ul class="steps">${e.safety.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    <h2>الخطوات</h2><ol class="qs">${e.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <h2>سؤال الاستنتاج</h2><p>${esc(e.conclusionQuestion)}</p>
    <div class="ans-line"></div><div class="ans-line"></div>`);
}

// ── كرت الخروج ────────────────────────────────────────────────

export function exitCardsHtml(kit: LessonKit, info: HeaderInfo, copies = 8): string {
  const qs = kit.exitCard.map((q, i) => `<div>${i + 1}) ${esc(q)}</div><div class="ans-line"></div>`).join("");
  const one = `<div class="small-card"><b>كرت الخروج — ${esc(kit.lessonTitle)}</b><div style="font-size:9.5pt;color:#444">الاسم: ................ · الرقم: ....</div>${qs}</div>`;
  return wrap(`كرت الخروج — ${kit.lessonTitle}`, `
    ${docHeader("كرت الخروج — يُقص ويُوزَّع آخر الحصة", kit, info, false)}
    <div class="cards">${Array.from({ length: copies }, () => one).join("")}</div>`);
}

// ── خطة الدرس (نموذج المدرسة) ────────────────────────────────

export function planHtml(kit: LessonKit, info: HeaderInfo): string {
  const p = kit.plan;
  const row = (k: string, v: string) => `<tr><th style="width:32mm">${esc(k)}</th><td>${v}</td></tr>`;
  const list = (a: string[]) => a.map((x) => `• ${esc(x)}`).join("<br/>");
  return wrap(`خطة درس — ${kit.lessonTitle}`, `
    ${docHeader("خطة الدرس اليومية", kit, info, false)}
    <table>
      ${row("الأهداف", list(p.objectives))}
      ${row("التمهيد", esc(p.warmup))}
      ${row("الاستراتيجيات", list(p.strategies))}
      ${row("الأنشطة", list(p.activities))}
      ${row("الوسائل", list(p.materials))}
      ${row("التقويم", esc(p.assessment))}
      ${row("الواجب", esc(p.homework))}
      ${row("الفروق الفردية", esc(p.differentiation))}
    </table>
    <div class="footer-line">توقيع المعلّمة: ................ · توقيع المنسقة: ................</div>`);
}

// ── ورقة رصد المشاركة ────────────────────────────────────────

export function participationHtml(kit: LessonKit, info: HeaderInfo, studentNames: string[]): string {
  const headCols = kit.participationCriteria.map((c) => `<th class="c" style="width:22mm">${esc(c)}</th>`).join("");
  const rows = studentNames
    .map((n, i) => `<tr><td class="c" style="width:9mm">${i + 1}</td><td>${esc(n)}</td>${kit.participationCriteria.map(() => `<td class="c"></td>`).join("")}</tr>`)
    .join("");
  return wrap(`رصد المشاركة — ${kit.lessonTitle}`, `
    ${docHeader("ورقة رصد المشاركة الصفية (✓ عند التحقق)", kit, info, false)}
    <table><tr><th class="c">م</th><th>اسم الطالبة</th>${headCols}</tr>${rows}</table>`);
}

// ── مخطط العرض (نسخة ورقية) ──────────────────────────────────

export function slidesOutlineHtml(kit: LessonKit, info: HeaderInfo): string {
  const slides = kit.slides
    .map(
      (s, i) => `<h2>الشريحة ${i + 1}: ${esc(s.title)}</h2><ul class="steps">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>${s.note ? `<p style="color:#7A5716;font-size:10.5pt">✎ ملاحظة للمعلّمة: ${esc(s.note)}</p>` : ""}`
    )
    .join("");
  return wrap(`مخطط العرض — ${kit.lessonTitle}`, `${docHeader("مخطط العرض التقديمي (نسخة ورقية)", kit, info, false)}${slides}`);
}

// ── الطباعة الفورية والحِزم ──────────────────────────────────

export type KitElementKind = "slides" | "worksheet" | "answers" | "game" | "experiment" | "exit" | "plan" | "participation";

export function elementHtml(kind: KitElementKind, kit: LessonKit, info: HeaderInfo, studentNames: string[]): string {
  switch (kind) {
    case "slides":
      return slidesOutlineHtml(kit, info);
    case "worksheet":
      return worksheetHtml(kit, info, false);
    case "answers":
      return worksheetHtml(kit, info, true);
    case "game":
      return gameCardsHtml(kit, info);
    case "experiment":
      return experimentHtml(kit, info);
    case "exit":
      return exitCardsHtml(kit, info);
    case "plan":
      return planHtml(kit, info);
    case "participation":
      return participationHtml(kit, info, studentNames);
  }
}

/** طباعة عنصر واحد فوراً */
export function printElement(kind: KitElementKind, kit: LessonKit, info: HeaderInfo, studentNames: string[]): void {
  printHtml(elementHtml(kind, kit, info, studentNames));
}

/** استخراج جسد الصفحة من مستند كامل (للدمج في حزمة واحدة) */
function bodyOf(html: string): string {
  const m = html.match(/<body>([\s\S]*)<\/body>/);
  return m ? m[1] : html;
}

/**
 * حزمة الأسبوع (§2-ج): كل مواد مجموعة دروس في مستند طباعة واحد —
 * لكل درس: ورقة العمل ثم الإجابات ثم اللعبة ثم التجربة ثم كرت الخروج
 * ثم الخطة ثم رصد المشاركة.
 */
export function printWeekBundle(kits: LessonKit[], info: HeaderInfo, studentNames: string[]): void {
  const order: KitElementKind[] = ["plan", "worksheet", "answers", "game", "experiment", "exit", "participation"];
  const parts: string[] = [];
  for (const kit of kits) {
    for (const kind of order) {
      parts.push(bodyOf(elementHtml(kind, kit, info, studentNames)));
      parts.push('<div class="page-break"></div>');
    }
  }
  parts.pop();
  const first = kits[0];
  printHtml(wrap("حزمة الأسبوع", parts.join("\n")).replace("</title>", ` — ${esc(first?.unitTitle ?? "")}</title>`));
}

/** حصة الطوارئ: خطة + ورقة + لعبة + تجربة في مستند واحد فوراً (§2-د) */
export function printEmergency(kit: LessonKit, info: HeaderInfo): void {
  const order: KitElementKind[] = ["plan", "slides", "worksheet", "answers", "game", "experiment"];
  const parts = order.flatMap((kind) => [bodyOf(elementHtml(kind, kit, info, [])), '<div class="page-break"></div>']);
  parts.pop();
  printHtml(wrap(`حصة الطوارئ — ${kit.lessonTitle}`, parts.join("\n")));
}
