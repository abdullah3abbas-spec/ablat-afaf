/**
 * مولّدات طباعة عناصر الحزمة — HTML بطباعة المتصفح حصراً (§5).
 * كل زر «اطبعي» يستدعي printHtml فوراً بلا حوارات وسيطة.
 */
import type { KitGame, LessonKit } from "@/content/kitTypes";
import { bookLessonByTitle } from "@/content/bookG05S1P1";
import { IDENTITY_HEADER_CSS, PRINT_FONTS_CSS, identityFooter, identityHeader } from "./printTheme";
import { KID_CSS, kidFinish, kidHeader, star8Svg } from "./kidTheme";
import { toEastern } from "./numerals";
import { printHtml } from "./sheetPrint";

/** رمز درس الحزمة من عنوانها الحرفي — لجلب رسمة الدرس المولّدة */
function kitCode(kit: LessonKit): string | undefined {
  return bookLessonByTitle(kit.lessonTitle)?.lesson.code;
}

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
  ${KID_CSS}
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
<body>${identityFooter(title)}${bodyHtml}</body>
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
  const last = kit.worksheet.length - 1;
  const items = kit.worksheet
    .map((q, i) => {
      const space = withAnswers
        ? `<div class="answer">الإجابة: ${esc(q.answer)}</div>`
        : q.kind === "draw"
          ? `<div class="k-ansline"></div><div class="k-ansline"></div><div class="k-ansline"></div>`
          : `<div class="k-ansline"></div>`;
      const treasure = i === last && !withAnswers;
      return `<div class="k-station${treasure ? " treasure" : ""}">
        <span class="k-hex">${i + 1}</span>
        ${treasure ? '<span class="k-treasure-tag">سؤال الكنز ★</span>' : ""}
        ${withAnswers ? "" : '<span class="k-pearl"></span>'}
        ${esc(q.text)}${space}
      </div>`;
    })
    .join("");
  const title = withAnswers ? "نسخة الإجابات" : "ورقة عمل";
  return wrap(`${title} — ${kit.lessonTitle}`, `
    ${kidHeader({ docTitle: title, lessonTitle: kit.lessonTitle, unitTitle: kit.unitTitle, className: info.className, lessonCode: kitCode(kit), studentFields: !withAnswers })}
    <div style="padding-inline-end:6mm">${items}</div>
    ${withAnswers ? "" : kidFinish()}`);
}

// ── بطاقات اللعبة ─────────────────────────────────────────────

export function gameCardsHtml(kit: LessonKit, info: HeaderInfo): string {
  const g: KitGame = kit.game;
  const how = g.howTo.map((h) => `<li>${esc(h)}</li>`).join("");
  const TEAMS = [
    { name: "فريق المها", color: "#0F6B62", text: "#0F6B62" },
    { name: "فريق الصقر", color: "#8A1538", text: "#8A1538" },
    { name: "فريق اللؤلؤ", color: "#C2456B", text: "#A93A5D" },
    { name: "فريق الشعاب", color: "#4FA3D1", text: "#1D6FA5" },
  ];
  const isBingo = g.name.includes("بينجو");
  const cards = g.cards
    .map((c, i) => {
      const team = TEAMS[i % TEAMS.length];
      const chip = isBingo
        ? `<span class="k-team" style="color:var(--zk-teal)"><i style="background:var(--zk-teal)"></i>بطاقة النداء — للمعلّمة</span>`
        : `<span class="k-team" style="color:${team.text}"><i></i>${team.name}</span>`;
      return `<div class="k-card" style="--team:${isBingo ? "#0F6B62" : team.color}">
        <div class="k-watermark">${star8Svg("", false)}</div>
        ${chip}
        <div class="k-qtext">${esc(c)}</div>
        <div class="k-cfoot"><span class="k-cnum">${toEastern(String(i + 1))}</span>${star8Svg("", true).replace('class=""', 'style="width:6mm;height:6mm"')}</div>
      </div>`;
    })
    .join("");
  // بينجو: شبكات فارغة تكتب فيها الثنائيات مصطلحاتهن من السبورة
  const bingoGrids = isBingo
    ? `<div class="page-break"></div>
       <div class="k-cut">شبكات البينجو — قُصّيها ووزّعيها، وكل ثنائية تكتب ٩ مصطلحات من السبورة</div>
       <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:4mm">${Array.from({ length: 6 },
         () => `<table class="k-bingo"><caption>شبكتنا ★</caption>${Array.from({ length: 3 }, () => `<tr>${"<td></td>".repeat(3)}</tr>`).join("")}</table>`
       ).join("")}</div>`
    : "";
  return wrap(`لعبة ${g.name} — ${kit.lessonTitle}`, `
    ${kidHeader({ docTitle: `لعبة: ${g.name}`, lessonTitle: kit.lessonTitle, unitTitle: kit.unitTitle, className: info.className, lessonCode: kitCode(kit) })}
    <h2 class="k-baloo" style="color:var(--zk-teal)">طريقة اللعب (${g.minutes} دقيقة)</h2><ul class="steps">${how}</ul>
    <div class="page-break"></div>
    <div class="k-cut">✂ بطاقات الكنز — قُصّيها على الحدود${isBingo ? " (تبقى بيدك للنداء)" : " ووزّعيها على الفرق"}</div>
    <div class="k-deck">${cards}</div>${bingoGrids}`);
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

export function exitCardsHtml(kit: LessonKit, info: HeaderInfo, copies = 6): string {
  const art = kitCode(kit) ? `<img src="/lesson-art/${kitCode(kit)!.replace(".", "-")}.jpg" alt="" onerror="this.remove()"/>` : "";
  const qs = kit.exitCard.map((q, i) => `<div class="k-tq">${toEastern(String(i + 1))}) ${esc(q)}</div><div class="k-tans"></div>`).join("");
  const one = `<div class="k-ticket">
    <div class="k-stub">${art}اسمي:<div class="k-nameline"></div>الرقم: ....</div>
    <div class="k-tbody">
      <div class="k-thead">${star8Svg("", true).replace('class=""', 'style="width:4mm;height:4mm;vertical-align:-0.5mm"')} تذكرة الخروج</div>
      ${qs}
      <div class="k-scale"><span><i class="k-dot"></i>فهمتُ</span><span><i class="k-dot"></i>تقريباً</span><span><i class="k-dot"></i>أحتاج مساعدة</span></div>
      <div class="k-stamp"><i></i>ختم «أنهيتُ!» — لوّنيه عند التسليم</div>
    </div>
  </div>`;
  return wrap(`كرت الخروج — ${kit.lessonTitle}`, `
    ${kidHeader({ docTitle: "تذاكر الخروج", lessonTitle: kit.lessonTitle, unitTitle: kit.unitTitle, className: info.className, lessonCode: kitCode(kit) })}
    <div class="k-cut">✂ تُقص التذاكر وتوزَّع آخر الحصة — كل طالبة تسلّم تذكرتها عند الباب</div>
    <div class="k-tickets">${Array.from({ length: copies }, () => one).join("")}</div>`);
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
  const headCols = kit.participationCriteria.map((c) => `<th style="width:20mm">${esc(c)}</th>`).join("");
  const blanks = Math.max(0, Math.min(25, 25 - studentNames.length));
  const rows = [
    ...studentNames.map((n, i) => `<tr><td class="c" style="width:10mm"><span class="k-roll">${i + 1}</span></td><td style="font-family:Cairo,sans-serif;font-weight:600">${esc(n)}</td>${kit.participationCriteria.map(() => `<td></td>`).join("")}</tr>`),
    ...Array.from({ length: blanks }, (_, j) => `<tr><td class="c" style="width:10mm"><span class="k-roll">${studentNames.length + j + 1}</span></td><td></td>${kit.participationCriteria.map(() => `<td></td>`).join("")}</tr>`),
  ].join("");
  return wrap(`رصد المشاركة — ${kit.lessonTitle}`, `
    ${kidHeader({ docTitle: "سجلّ بعثة الفصل", lessonTitle: kit.lessonTitle, unitTitle: kit.unitTitle, className: info.className, lessonCode: kitCode(kit) })}
    <table class="k-ptable"><tr><th class="c">م</th><th>اسم الطالبة</th>${headCols}</tr>${rows}</table>
    <div class="k-weekstar">${star8Svg("", false).replace('class=""', 'style="width:8mm;height:8mm;flex:none"')}<b>نجمة الأسبوع:</b> ........................ <span style="color:#6B5E58;font-size:9.5pt">— (✓ = تحقّق · ★ = مشاركة متميزة)</span></div>
    <div class="k-notes">ملاحظات البعثة:</div>`);
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
