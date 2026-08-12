/**
 * مولّدات داخل التطبيق — تُنفّذ إجراءات «الصندوق الواحد» و«المطلوب منّي»
 * مباشرةً من البيانات المحلية (§ الأمر ٨-ب). كلها محلية، وتُخرج بطباعة
 * المتصفح (§5) أو ملف Excel. لا تتحدّث نيابة عن المعلّمة — تجهّز فقط.
 */
import { db } from "@/db";
import type { Question, Term } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { activePolicyOf } from "./policy";
import { leafComponents } from "./gradeComponents";
import { termTotal, percentOf, gradeLabel } from "./grades";
import type { RequestType, TeacherRequest } from "@/db/schema";
import { studentReport, classAdminReport, type StudentReport } from "./reportData";
import { parentCardHtml, adminReportHtml, bankWorksheetHtml, barChartSvg, printDoc } from "./reportPrint";
import { exportOfficialSheet } from "./officialExport";
import { remedialGroups, levelDistribution } from "./analytics";
import { kitByLessonTitle, EMERGENCY_KIT } from "@/content/lessonKits";

async function settings() {
  return db.settings.get(1);
}
async function currentTerm(): Promise<Term> {
  return ((await settings())?.currentTerm ?? 1) as Term;
}
async function schoolName(): Promise<string> {
  return (await settings())?.schoolName ?? "";
}

/** يختار أسئلة متنوّعة (الأقل استخداماً مع مزج المستويات) — نفس منطق شاشة أوراق العمل */
async function pickQuestions(opts: { unitId?: number; lessonId?: number; count: number }): Promise<Question[]> {
  const all = (await db.questions.toArray()).filter(
    (q) => !q.deletedAt && (!opts.unitId || q.unitId === opts.unitId) && (!opts.lessonId || q.lessonId === opts.lessonId)
  );
  if (all.length === 0) return [];
  const sorted = all.sort((a, b) => a.usageCount - b.usageCount || a.marks - b.marks);
  const byLevel = new Map<string, Question[]>();
  for (const q of sorted) {
    const arr = byLevel.get(q.cognitiveLevel) ?? [];
    arr.push(q);
    byLevel.set(q.cognitiveLevel, arr);
  }
  const levels = [...byLevel.keys()];
  const chosen: Question[] = [];
  let li = 0;
  while (chosen.length < opts.count && chosen.length < all.length) {
    const arr = byLevel.get(levels[li % levels.length])!;
    const next = arr.shift();
    if (next) chosen.push(next);
    li++;
    if (levels.every((k) => (byLevel.get(k) ?? []).length === 0)) break;
  }
  return chosen;
}

/** ورقة عمل (أو كويز) → طباعة فورية. يعيد عدد الأسئلة (0 = لا أسئلة). */
export async function genWorksheet(opts: {
  unitId?: number;
  lessonId?: number;
  title?: string;
  count?: number;
}): Promise<number> {
  const count = opts.count ?? 6;
  const picked = await pickQuestions({ unitId: opts.unitId, lessonId: opts.lessonId, count });
  if (picked.length === 0) return 0;
  const unit = opts.unitId ? await db.units.get(opts.unitId) : undefined;
  const lesson = opts.lessonId ? await db.lessons.get(opts.lessonId) : undefined;
  const title = opts.title ?? (lesson ? `ورقة عمل — ${lesson.title}` : "ورقة عمل");
  printDoc(bankWorksheetHtml(picked, { schoolName: await schoolName(), title, unitName: unit?.title ?? lesson?.title ?? "" }, false));
  return picked.length;
}

/** بطاقة متابعة ولي الأمر لطالبة → طباعة. يعيد true إن نجح. */
export async function genParentReport(studentId: number, term?: Term): Promise<boolean> {
  const t = term ?? (await currentTerm());
  const report = await studentReport(studentId, t);
  if (!report) return false;
  printDoc(parentCardHtml([report as StudentReport], await schoolName(), t === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني"));
  return true;
}

/** كشف الدرجات الرسمي (Excel) لفصل. */
export async function genOfficialSheet(classId: number, term?: Term): Promise<boolean> {
  const r = await exportOfficialSheet(classId, term ?? (await currentTerm()));
  return r.ok;
}

/** عتبة «تحتاج دعماً» — أقل من ٦٠٪ (نفس عتبة المجموعات العلاجية §2-ز) */
export const WEAK_THRESHOLD = 60;

export interface WeakResult {
  threshold: number;
  passGrade: number;
  unitName?: string;
  className?: string;
  students: { id: number; name: string; pct: number; label: string }[];
}

/**
 * الطالبات المتعثّرات (اللاتي يحتجن دعماً: النسبة دون ٦٠٪). محلي بالكامل.
 * إن حُدّد فصل فبفصله، وإلا فكل الفصول. الوحدة تُذكر في التسمية فقط
 * (التعثّر بالوحدة يحتاج نتائج اختبارات؛ نعتمد النسبة العامة العادلة).
 */
export async function genWeakStudents(opts: { classId?: number; unitId?: number; term?: Term }): Promise<WeakResult> {
  const t = opts.term ?? (await currentTerm());
  const yearId = (await settings())?.currentAcademicYearId ?? 0;
  const policy = await activePolicyOf(yearId);
  const scale = policy?.gradeScale ?? DEFAULT_GRADE_SCALE;
  const passGrade = policy?.passGrade ?? 50;
  const comps = leafComponents(await db.gradeComponents.where("[academicYearId+term]").equals([yearId, t]).toArray());

  let students = (await db.students.toArray()).filter((s) => !s.deletedAt);
  if (opts.classId) students = students.filter((s) => s.classId === opts.classId);

  const weak: WeakResult["students"] = [];
  for (const st of students) {
    const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter((g) => !g.deletedAt && g.term === t);
    const tot = termTotal(grades, comps);
    if (tot.counted === 0) continue;
    const pct = percentOf(tot.total, tot.countedOutOf || tot.outOf);
    if (pct < WEAK_THRESHOLD) weak.push({ id: st.id!, name: st.name, pct, label: gradeLabel(pct, scale) });
  }
  weak.sort((a, b) => a.pct - b.pct);

  const unit = opts.unitId ? await db.units.get(opts.unitId) : undefined;
  const klass = opts.classId ? await db.classes.get(opts.classId) : undefined;
  return { threshold: WEAK_THRESHOLD, passGrade, unitName: unit?.title, className: klass?.name, students: weak };
}

// ── ملف الزيارة الصفية (§ الأمر ٨-ب ثانياً) ─────────────────────

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const VISIT_CSS = `
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Cairo"; src: url("/fonts/cairo-arabic-700.woff2") format("woff2"); font-weight: 700; }
  body { font-family: "Tajawal", sans-serif; font-size: 12pt; line-height: 1.8; color: #111; }
  .cover { text-align: center; border-bottom: 0.8mm solid #8A1538; padding-bottom: 4mm; margin-bottom: 5mm; }
  .cover h1 { font-family: "Cairo"; font-size: 20pt; color: #8A1538; }
  .cover .meta { color: #555; margin-top: 1mm; }
  h2 { font-family: "Cairo"; font-size: 14pt; color: #0B534C; margin: 5mm 0 2mm; border-inline-start: 1.5mm solid #0B534C; padding-inline-start: 3mm; page-break-after: avoid; }
  .box { border: 0.3mm solid #ccc; border-radius: 2mm; padding: 3mm 4mm; margin-bottom: 3mm; }
  ul, ol { margin-inline-start: 6mm; }
  .diff { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; }
  .diff .col { border: 0.3mm solid #bbb; border-radius: 2mm; padding: 2.5mm; page-break-inside: avoid; }
  .diff h3 { font-size: 11.5pt; color: #8A1538; margin-bottom: 1.5mm; }
  .stat-row { display: flex; gap: 4mm; flex-wrap: wrap; }
  .stat { flex: 1; min-width: 40mm; text-align: center; border: 0.3mm solid #ccc; border-radius: 2mm; padding: 2.5mm; }
  .stat b { font-size: 18pt; color: #0B534C; display: block; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.3mm solid #999; padding: 1.5mm 2mm; text-align: center; }
  .sample { border: 0.4mm dashed #999; border-radius: 2mm; height: 45mm; display: flex; align-items: center; justify-content: center; color: #999; }
  .sign { display: flex; justify-content: space-between; margin-top: 8mm; }
  .muted { color: #777; }
  section { page-break-inside: avoid; }
`;

/**
 * ملف الزيارة الصفية — مستند واحد يجمع كل ما تحتاجه المعلّمة للزيارة.
 * كل المحتوى موجود في المنصّة أصلاً — نجمّعه ونطبعه (§5).
 */
export async function genVisitFile(classId: number, lessonId?: number): Promise<boolean> {
  const klass = await db.classes.get(classId);
  if (!klass) return false;
  const st = await settings();
  const term = (st?.currentTerm ?? 1) as Term;
  const school = st?.schoolName ?? "";

  // الدرس: المحدَّد، وإلا أول درس غير مُدرَّس، وإلا أول درس
  const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.unitId - b.unitId || a.order - b.order);
  const lesson = (lessonId ? lessons.find((l) => l.id === lessonId) : undefined) ?? lessons.find((l) => !l.taughtAt) ?? lessons[0];
  if (!lesson) return false;
  const unit = await db.units.get(lesson.unitId);
  const kit = kitByLessonTitle(lesson.title);

  // ١) خطة الدرس ومعاييره
  const objectives = (lesson.objectives?.length ? lesson.objectives : lesson.learningOutcomes?.map((o) => o.text)) ?? kit?.plan.objectives ?? [];
  const standards = lesson.standards ?? unit?.standards ?? [];
  const planHtml = `<div class="box">
    <p><b>الدرس:</b> ${esc(lesson.title)} — <b>الوحدة:</b> ${esc(unit?.title ?? "")}</p>
    <p><b>الأهداف:</b></p><ol>${(objectives.length ? objectives : ["أن تكون الطالبة قادرة على …"]).map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
    ${standards.length ? `<p><b>المعايير:</b> ${standards.map(esc).join(" · ")}</p>` : ""}
    ${kit ? `<p><b>الاستراتيجيات:</b> ${kit.plan.strategies.map(esc).join(" · ")}</p><p><b>الأنشطة:</b> ${kit.plan.activities.map(esc).join(" · ")}</p>` : ""}
  </div>`;

  // ٢) أوراق العمل الثلاث المتمايزة (دعم/أساسي/إثراء) من بنك الأسئلة
  const qs = (await db.questions.toArray()).filter((q) => !q.deletedAt && (q.lessonId === lesson.id || q.unitId === lesson.unitId));
  const pickBy = (d: string, n: number) => qs.filter((q) => q.difficulty === d).slice(0, n);
  const diffCol = (title: string, list: Question[]) =>
    `<div class="col"><h3>${title}</h3>${list.length ? `<ol>${list.map((q) => `<li>${esc(q.text)}</li>`).join("")}</ol>` : '<p class="muted">—</p>'}</div>`;
  const diffHtml = `<div class="diff">
    ${diffCol("دعم", pickBy("easy", 4))}
    ${diffCol("أساسي", pickBy("medium", 4))}
    ${diffCol("إثراء", pickBy("hard", 3))}
  </div>`;

  // ٣) أدلة التقويم: كرت الخروج + آخر كويز
  const assessHtml = `<div class="box">
    <p><b>كرت الخروج:</b></p>
    <ol>${(kit?.exitCard ?? ["سؤال ختامي قصير…"]).map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
    <p class="muted">يُرفق آخر كويز صفي ونتائجه إن وُجد.</p>
  </div>`;

  // ٤) إحصائيات الفصل ورسومها
  const comps = leafComponents(await db.gradeComponents.where("[academicYearId+term]").equals([klass.academicYearId, term]).toArray());
  const students = (await db.students.where("classId").equals(classId).toArray()).filter((sst) => !sst.deletedAt);
  const pcts: number[] = [];
  const policy = await activePolicyOf(klass.academicYearId);
  const pass = policy?.passGrade ?? 50;
  for (const sst of students) {
    const grades = (await db.grades.where("studentId").equals(sst.id!).toArray()).filter((g) => !g.deletedAt && g.term === term);
    const tot = termTotal(grades, comps);
    if (tot.counted > 0) pcts.push(percentOf(tot.total, tot.countedOutOf || tot.outOf));
  }
  const avg = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
  const passRate = pcts.length ? Math.round((pcts.filter((p) => p >= pass).length / pcts.length) * 100) : 0;
  const dist = await levelDistribution(classId);
  const chart = dist.some((d) => d.count > 0)
    ? barChartSvg(dist.map((d) => ({ label: d.level, value: d.count })), { maxValue: Math.max(...dist.map((d) => d.count), 1), valueSuffix: "" })
    : '<p class="muted">لا بيانات كافية للرسم بعد.</p>';
  const statsHtml = `<div class="stat-row">
      <div class="stat"><b>${avg}٪</b>متوسط الفصل</div>
      <div class="stat"><b>${passRate}٪</b>نسبة النجاح</div>
      <div class="stat"><b>${students.length}</b>عدد الطالبات</div>
    </div>
    <div class="box" style="margin-top:3mm">${chart}</div>`;

  // ٥) الخطة العلاجية للمتعثّرات
  const groups = await remedialGroups(classId, term);
  const remedialHtml = groups.length
    ? groups
        .map(
          (g) =>
            `<div class="box"><p><b>نقطة الضعف:</b> ${esc(g.weaknessName)} — <b>${g.students.length} طالبات</b></p>
             <p>${esc(g.students.map((s2) => s2.name).join(" · "))}</p>
             <p class="muted">${esc(g.suggestedActivity)}</p></div>`
        )
        .join("")
    : '<p class="muted box">لا مجموعات علاجية — المستوى مطمئن أو لم تُرصد درجات كافية.</p>';

  // ٦) سجل الأنشطة والتجارب
  const activitiesHtml = kit
    ? `<div class="box"><p><b>اللعبة:</b> ${esc(kit.game.name)} (${kit.game.minutes} دقيقة)</p>
       <p><b>التجربة:</b> ${esc(kit.experiment.title)}</p>
       <p class="muted"><b>الأدوات:</b> ${kit.experiment.tools.map(esc).join(" · ")}</p></div>`
    : '<p class="muted box">لا حزمة درس مرتبطة — يُضاف سجل الأنشطة يدوياً.</p>';

  const dateStr = new Date().toLocaleDateString("en-GB");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>ملف الزيارة الصفية — ${esc(klass.name)}</title><style>${VISIT_CSS}</style></head><body>
    <div class="cover">
      <h1>ملف الزيارة الصفية</h1>
      <div class="meta">${esc(school)} · العلوم · ${esc(klass.name)} · درس «${esc(lesson.title)}» · ${dateStr}</div>
    </div>
    <section><h2>١) خطة الدرس ومعاييره</h2>${planHtml}</section>
    <section><h2>٢) أوراق العمل المتمايزة</h2>${diffHtml}</section>
    <section><h2>٣) أدلة التقويم</h2>${assessHtml}</section>
    <section><h2>٤) إحصائيات الفصل</h2>${statsHtml}</section>
    <section><h2>٥) الخطة العلاجية للمتعثّرات</h2>${remedialHtml}</section>
    <section><h2>٦) سجل الأنشطة والتجارب</h2>${activitiesHtml}</section>
    <section><h2>٧) عيّنات من أعمال الطالبات</h2>
      <div class="stat-row"><div class="sample">تُلصق هنا عيّنة (١)</div><div class="sample">تُلصق هنا عيّنة (٢)</div></div>
    </section>
    <div class="sign"><span>توقيع المعلّمة: ................</span><span>ملاحظات الزائرة: ................</span></div>
  </body></html>`;

  printDoc(html);
  return true;
}

// ── صندوق الطلبات «المطلوب منّي» (§ الأمر ٨-ب ثالثاً) ────────────

/** تعرّف محلي على نوع الطلب من نصّه (لا إرسال خارجي §2-هـ) */
export function detectRequestType(text: string): RequestType {
  const t = (text || "").replace(/[ًٌٍَُِّْـ]/g, "");
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("متعثر", "الضعيف", "الضعاف", "المتأخر")) return "struggling";
  if (has("علاجي", "خطة الدعم", "خطه الدعم") && !has("اثراء")) return "remedial_plan";
  if (has("دعم", "اثراء", "إثراء")) return "support_enrichment";
  if (has("انشطة", "أنشطة", "نشاط")) return "activities";
  if (has("احصائ", "إحصائ", "نتائج", "معدل الفصل")) return "results_stats";
  if (has("ولي امر", "ولي الامر", "وليه", "بطاقة متابعة", "بطاقه متابعه")) return "parent_report";
  if (has("زيارة", "زياره", "الزيارة الصفية")) return "visit_file";
  if (has("رسالة", "رساله", "اسبوعية", "أسبوعية")) return "weekly_message";
  if (has("تجربة", "تجارب", "المختبر", "معمل")) return "experiments";
  if (has("احتياج", "حصر", "مشتريات", "نواقص")) return "needs_inventory";
  return "other";
}

function printSimpleDoc(title: string, school: string, bodyHtml: string): void {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${VISIT_CSS}</style></head><body>
    <div class="cover"><h1>${esc(title)}</h1><div class="meta">${esc(school)} · العلوم · ${new Date().toLocaleDateString("en-GB")}</div></div>
    ${bodyHtml}
    <div class="sign"><span>توقيع المعلّمة: ................</span><span>الاعتماد: ................</span></div>
  </body></html>`;
  printDoc(html);
}

async function printStruggling(classId: number | undefined, remedial: boolean): Promise<boolean> {
  const term = (await settings())?.currentTerm ?? 1;
  if (classId) {
    const groups = await remedialGroups(classId, term as Term);
    const weak = await genWeakStudents({ classId });
    const school = await schoolName();
    const klass = await db.classes.get(classId);
    const groupsHtml = groups.length
      ? groups.map((g) => `<div class="box"><p><b>${esc(g.weaknessName)}</b> — ${g.students.length} طالبات: ${esc(g.students.map((s2) => s2.name).join(" · "))}</p>${remedial ? `<p class="muted">${esc(g.suggestedActivity)}</p>` : ""}</div>`).join("")
      : '<p class="muted box">لا مجموعات — لم تُرصد درجات كافية.</p>';
    const listHtml = weak.students.length
      ? `<table><tr><th>الطالبة</th><th>النسبة</th><th>التقدير</th></tr>${weak.students.map((st) => `<tr><td>${esc(st.name)}</td><td>${st.pct}٪</td><td>${esc(st.label)}</td></tr>`).join("")}</table>`
      : '<p class="muted">لا طالبات دون النجاح.</p>';
    printSimpleDoc(remedial ? "الخطة العلاجية" : "تقرير المتعثّرات", school, `<section><h2>الطالبات دون النجاح — ${esc(klass?.name ?? "")}</h2>${listHtml}</section><section><h2>المجموعات حسب نقطة الضعف</h2>${groupsHtml}</section>`);
    return true;
  }
  return false;
}

/**
 * ينتج مستند الطلب من البيانات الموجودة (§8-ب: تُنجز العمل، ولا تتحدّث نيابةً).
 * يعيد {ok, reason?} — reason عربية إن احتاج بياناً ناقصاً.
 */
export async function produceRequest(req: TeacherRequest): Promise<{ ok: boolean; reason?: string }> {
  const cid = req.classId;
  switch (req.type) {
    case "parent_report":
      if (!req.studentId) return { ok: false, reason: "حدّدي الطالبة في الطلب أولاً." };
      return { ok: await genParentReport(req.studentId) };
    case "visit_file":
      if (!cid) return { ok: false, reason: "حدّدي الفصل في الطلب أولاً." };
      return { ok: await genVisitFile(cid) };
    case "struggling":
      if (!cid) return { ok: false, reason: "حدّدي الفصل في الطلب أولاً." };
      return { ok: await printStruggling(cid, false) };
    case "remedial_plan":
    case "support_enrichment":
      if (!cid) return { ok: false, reason: "حدّدي الفصل في الطلب أولاً." };
      return { ok: await printStruggling(cid, true) };
    case "results_stats": {
      const term = (await settings())?.currentTerm ?? 1;
      const classes = cid ? [await db.classes.get(cid)] : (await db.classes.toArray()).filter((c) => !c.deletedAt);
      const reports = [];
      for (const c of classes) if (c) { const r = await classAdminReport(c.id!, term as Term); if (r) reports.push(r); }
      if (reports.length === 0) return { ok: false, reason: "لا توجد درجات مرصودة بعد." };
      printDoc(adminReportHtml(reports, await schoolName(), term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني"));
      return { ok: true };
    }
    case "activities":
    case "experiments": {
      const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.unitId - b.unitId || a.order - b.order);
      const rows = lessons.map((l) => { const k = kitByLessonTitle(l.title); return `<tr><td>${esc(l.title)}</td><td>${esc(k?.game.name ?? "—")}</td><td>${esc(k?.experiment.title ?? "—")}</td></tr>`; }).join("");
      printSimpleDoc(req.type === "experiments" ? "تقرير التجارب" : "تقرير الأنشطة", await schoolName(), `<section><h2>سجل الدروس</h2><table><tr><th>الدرس</th><th>اللعبة</th><th>التجربة</th></tr>${rows}</table></section>`);
      return { ok: true };
    }
    default:
      printSimpleDoc(req.title || "مستند", await schoolName(), `<section><h2>${esc(req.title || "")}</h2><div class="box"><p>${esc(req.description ?? "")}</p><p class="muted">يُكمَّل هذا المستند يدوياً أو يُربط بمصدر بيانات لاحقاً.</p></div></section>`);
      return { ok: true };
  }
}

// ── الأمر ٨-ج: الرسالة الأسبوعية · الفروق الفردية · الخطة العلاجية · الغياب ──

export type StudentLevel = "support" | "basic" | "enrichment";
export const LEVEL_LABEL: Record<StudentLevel, string> = { support: "دعم", basic: "أساسي", enrichment: "إثراء" };
const DIFFICULTY_OF: Record<StudentLevel, "easy" | "medium" | "hard"> = { support: "easy", basic: "medium", enrichment: "hard" };

/** مستوى الطالبة من نسبتها: دون ٦٠٪ دعم · ٦٠–٨٠ أساسي · ٨٠+ إثراء */
export function studentLevel(pct: number | null): StudentLevel {
  if (pct == null) return "basic";
  if (pct < 60) return "support";
  if (pct < 80) return "basic";
  return "enrichment";
}

/** نسبة الطالبة في فصل دراسي (على المرصود) — أو null إن لم تُرصد */
async function studentPct(studentId: number, term: Term, comps: Awaited<ReturnType<typeof leafComponents>>): Promise<number | null> {
  const grades = (await db.grades.where("studentId").equals(studentId).toArray()).filter((g) => !g.deletedAt && g.term === term);
  const tot = termTotal(grades, comps);
  return tot.counted === 0 ? null : percentOf(tot.total, tot.countedOutOf || tot.outOf);
}

/** ثلاثة أنشطة علاجية محدّدة لنقطة ضعف بعينها (لا عامة §2-ز) */
function threeActivitiesFor(weakness: string): string[] {
  return [
    `مراجعة مركّزة (١٠ دقائق) على مفاهيم «${weakness}» بأمثلة محسوسة قبل الحصة.`,
    `ورقة عمل قصيرة (٥ أسئلة) من المستوى الأساسي على «${weakness}»، ثم تصحيح فوري.`,
    `نشاط تعاوني: لعبة «سباق التصنيف» لترسيخ «${weakness}»، ثم كرت خروج من سؤالين.`,
  ];
}

/** يحدّد دروس الأسبوع القادم: من أول درس غير مُدرَّس، بعدد حصص الأسبوع */
async function nextWeekLessons(): Promise<{ title: string; unitTitle: string }[]> {
  const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.unitId - b.unitId || a.order - b.order);
  const units = new Map((await db.units.toArray()).map((u) => [u.id!, u.title]));
  const year = (await db.academicYears.toArray()).find((y) => y.isCurrent);
  const perWeek = year?.weeklySessions ?? 4;
  const startIdx = Math.max(0, lessons.findIndex((l) => !l.taughtAt));
  return lessons.slice(startIdx, startIdx + perWeek).map((l) => ({ title: l.title, unitTitle: units.get(l.unitId) ?? "" }));
}

/**
 * ١) الرسالة الأسبوعية — صفحة واحدة أنيقة بترويسة المدرسة، للطباعة أو
 * الإرسال صورةً في الواتساب. تُراجعها المعلّمة وتضيف سطراً إن أرادت.
 */
export async function genWeeklyMessage(extraNote?: string): Promise<boolean> {
  const st = await settings();
  const school = st?.schoolName ?? "";
  const lessons = await nextWeekLessons();
  const now = Date.now();
  const upcoming = (await db.exams.toArray())
    .filter((e) => !e.deletedAt && e.scheduledFor != null && e.scheduledFor >= now && e.scheduledFor <= now + 10 * 86400000)
    .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));

  const dateStr = new Date().toLocaleDateString("en-GB");
  const lessonsHtml = lessons.length
    ? `<ol>${lessons.map((l) => `<li>${esc(l.title)} <span class="muted">— ${esc(l.unitTitle)}</span></li>`).join("")}</ol>`
    : '<p class="muted">تُحدَّد دروس الأسبوع القادم قريباً.</p>';
  const examsHtml = upcoming.length
    ? `<ul>${upcoming.map((e) => `<li>${esc(e.title)} — ${new Date(e.scheduledFor!).toLocaleDateString("en-GB")}</li>`).join("")}</ul>`
    : '<p class="muted">لا تقييمات مجدولة هذا الأسبوع.</p>';
  const homework = lessons[0] ? `مراجعة درس «${esc(lessons[0].title)}» وحلّ أنشطته.` : "—";

  const body = `
    <section><h2>📚 دروس الأسبوع القادم</h2><div class="box">${lessonsHtml}</div></section>
    <section><h2>📝 الواجبات</h2><div class="box"><p>${homework}</p></div></section>
    <section><h2>🗓️ التقييمات القادمة</h2><div class="box">${examsHtml}</div></section>
    ${extraNote?.trim() ? `<section><h2>✍️ رسالة المعلّمة</h2><div class="box"><p>${esc(extraNote.trim())}</p></div></section>` : ""}
    <p class="muted" style="text-align:center;margin-top:5mm">نتمنى لبناتنا أسبوعاً موفّقاً · معلّمة العلوم</p>`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>الرسالة الأسبوعية</title><style>${VISIT_CSS}
    .cover h1{font-size:22pt}</style></head><body>
    <div class="cover"><h1>الرسالة الأسبوعية لأولياء الأمور</h1><div class="meta">${esc(school)} · مادة العلوم · ${dateStr}</div></div>
    ${body}</body></html>`;
  printDoc(html);
  return true;
}

/**
 * ٢-أ) ورقة عمل بثلاث نسخ متمايزة (دعم/أساسي/إثراء) في مستند واحد.
 */
export async function genDifferentiatedWorksheet(opts: { unitId?: number; lessonId?: number; title?: string }): Promise<number> {
  const all = (await db.questions.toArray()).filter(
    (q) => !q.deletedAt && (!opts.unitId || q.unitId === opts.unitId) && (!opts.lessonId || q.lessonId === opts.lessonId)
  );
  if (all.length === 0) return 0;
  const lesson = opts.lessonId ? await db.lessons.get(opts.lessonId) : undefined;
  const unit = opts.unitId ? await db.units.get(opts.unitId) : undefined;
  const topic = opts.title ?? lesson?.title ?? unit?.title ?? "ورقة عمل";
  const school = await schoolName();

  const section = (level: StudentLevel) => {
    const list = all.filter((q) => q.difficulty === DIFFICULTY_OF[level]).slice(0, 6);
    const items = list.length
      ? list.map((q, i) => `<div style="margin-bottom:4mm"><b>${i + 1})</b> ${esc(q.text)} <span class="muted">(${q.marks})</span>${q.type !== "mcq" ? '<div style="border-bottom:.3mm dotted #888;height:9mm;margin-top:1mm"></div>' : q.options ? `<div style="padding-inline-start:8mm">${q.options.map((o) => `<span style="margin-inline-end:9mm">${o.key}) ${esc(o.text)}</span>`).join("")}</div>` : ""}</div>`).join("")
      : '<p class="muted">لا أسئلة بهذا المستوى — أضيفي أسئلة للبنك.</p>';
    return `<section class="page-break"><h2>النسخة: ${LEVEL_LABEL[level]}</h2>
      <div style="font-size:11pt;margin-bottom:2mm">اسم الطالبة: .............................. · التاريخ: ..........</div>
      ${items}</section>`;
  };

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(topic)} — ٣ نسخ</title><style>${VISIT_CSS}
    .page-break{page-break-before:always}section:first-of-type{page-break-before:auto}</style></head><body>
    <div class="cover"><h1>${esc(topic)}</h1><div class="meta">${esc(school)} · العلوم · ثلاث نسخ متمايزة</div></div>
    ${section("support")}${section("basic")}${section("enrichment")}</body></html>`;
  printDoc(html);
  return all.length;
}

/**
 * ٢-ب) الوضع الذكي: نسخة لكل طالبة باسمها بمستواها المناسب — بلا أي علامة
 * تكشف التصنيف للطالبات (§6). صفحة لكل طالبة.
 */
export async function genPerStudentWorksheets(classId: number, opts: { unitId?: number; lessonId?: number }): Promise<number> {
  const term = (await settings())?.currentTerm ?? 1;
  const yearId = (await settings())?.currentAcademicYearId ?? 0;
  const comps = leafComponents(await db.gradeComponents.where("[academicYearId+term]").equals([yearId, term]).toArray());
  const students = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt).sort((a, b) => a.rollNumber - b.rollNumber);
  if (students.length === 0) return 0;
  const all = (await db.questions.toArray()).filter((q) => !q.deletedAt && (!opts.unitId || q.unitId === opts.unitId) && (!opts.lessonId || q.lessonId === opts.lessonId));
  if (all.length === 0) return 0;
  const lesson = opts.lessonId ? await db.lessons.get(opts.lessonId) : undefined;
  const topic = lesson?.title ?? (opts.unitId ? (await db.units.get(opts.unitId))?.title : "") ?? "ورقة عمل";
  const school = await schoolName();

  const byDiff = (d: string) => all.filter((q) => q.difficulty === d);
  const pages: string[] = [];
  for (const stu of students) {
    const level = studentLevel(await studentPct(stu.id!, term as Term, comps));
    const pool = byDiff(DIFFICULTY_OF[level]);
    const list = (pool.length ? pool : all).slice(0, 6);
    const items = list.map((q, i) => `<div style="margin-bottom:4mm"><b>${i + 1})</b> ${esc(q.text)} <span class="muted">(${q.marks})</span>${q.type === "mcq" && q.options ? `<div style="padding-inline-start:8mm">${q.options.map((o) => `<span style="margin-inline-end:9mm">${o.key}) ${esc(o.text)}</span>`).join("")}</div>` : '<div style="border-bottom:.3mm dotted #888;height:9mm;margin-top:1mm"></div>'}</div>`).join("");
    // لا علامة على المستوى إطلاقاً — فقط اسمها
    pages.push(`<section class="page-break"><div class="cover" style="border-bottom:.6mm solid #0B534C"><h1 style="font-size:18pt">${esc(topic)}</h1><div class="meta">${esc(school)} · العلوم</div></div>
      <div style="font-size:13pt;margin:3mm 0"><b>الطالبة:</b> ${esc(stu.name)} · التاريخ: ..........</div>${items}</section>`);
  }
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(topic)} — نسخة لكل طالبة</title><style>${VISIT_CSS}
    .page-break{page-break-before:always}section:first-of-type{page-break-before:auto}</style></head><body>${pages.join("")}</body></html>`;
  printDoc(html);
  return students.length;
}

/**
 * ٣) الخطة العلاجية المحدّدة: لكل نقطة ضعف — الضعف المحدّد + ٣ أنشطة +
 * موعد إعادة القياس + سجل متابعة (قبل/بعد). onlyKey لطباعة مجموعة واحدة.
 */
export async function genRemedialPlan(classId: number, term: Term, onlyKey?: string): Promise<boolean> {
  const groups = (await remedialGroups(classId, term)).filter((g) => !onlyKey || g.weaknessKey === onlyKey);
  if (groups.length === 0) return false;
  const school = await schoolName();
  const klass = await db.classes.get(classId);
  const reMeasure = new Date(Date.now() + 14 * 86400000).toLocaleDateString("en-GB");

  const sections = groups
    .map((g) => {
      const acts = threeActivitiesFor(g.weaknessName);
      return `<section class="page-break"><h2>نقطة الضعف المحدّدة: ${esc(g.weaknessName)}</h2>
      <div class="box"><b>الأنشطة العلاجية الثلاثة:</b><ol>${acts.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
        <p><b>موعد إعادة القياس:</b> ${reMeasure}</p></div>
      <h3>سجل المتابعة (${g.students.length} طالبات)</h3>
      <table><tr><th>الطالبة</th><th>النسبة قبل</th><th>النسبة بعد</th><th>تحسّنت؟</th></tr>
      ${g.students.map((st) => `<tr><td>${esc(st.name)}</td><td>${st.pct}٪</td><td></td><td></td></tr>`).join("")}</table></section>`;
    })
    .join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>الخطة العلاجية</title><style>${VISIT_CSS}
    .page-break{page-break-before:always}section:first-of-type{page-break-before:auto}</style></head><body>
    <div class="cover"><h1>الخطة العلاجية المحدّدة</h1><div class="meta">${esc(school)} · العلوم · ${esc(klass?.name ?? "")}</div></div>
    ${sections}<div class="sign"><span>توقيع المعلّمة: ................</span><span>الاعتماد: ................</span></div></body></html>`;
  printDoc(html);
  return true;
}

/**
 * ٤) زر «أنا غائبة اليوم»: حزمة كاملة للمعلّمة البديلة — دروس اليوم بخططها
 * وأوراق عملها وكرت الخروج، ملاحظات كل فصل، ونشاط بديل احتياطي.
 */
export async function genSubstituteFile(): Promise<boolean> {
  const school = await schoolName();
  const lessons = await nextWeekLessons(); // الدروس القادمة = دروس اليوم للبديلة
  const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);

  const lessonSections = lessons.slice(0, 3).map((l) => {
    const kit = kitByLessonTitle(l.title);
    const plan = kit ? `<p><b>الأهداف:</b> ${kit.plan.objectives.map(esc).join(" · ")}</p><p><b>الأنشطة:</b> ${kit.plan.activities.map(esc).join(" · ")}</p>` : '<p class="muted">تُتبع خطة الدرس المعتادة.</p>';
    const ws = kit ? `<p><b>ورقة العمل:</b></p><ol>${kit.worksheet.slice(0, 5).map((w) => `<li>${esc(w.text)}</li>`).join("")}</ol>` : "";
    const exit = kit ? `<p><b>كرت الخروج:</b> ${kit.exitCard.map(esc).join(" · ")}</p>` : "";
    return `<section class="page-break"><h2>درس: ${esc(l.title)} <span class="muted">(${esc(l.unitTitle)})</span></h2><div class="box">${plan}${ws}${exit}</div></section>`;
  }).join("");

  const notesHtml = classes.map((c) => `<li><b>${esc(c.name)}:</b> تُتبع الخطة أعلاه؛ الطالبات متعاونات، والمتعثّرات في المقاعد الأمامية.</li>`).join("");
  const backup = `<div class="box"><p><b>${esc(EMERGENCY_KIT.game.name)}</b> (${EMERGENCY_KIT.game.minutes} دقيقة)</p><ol>${EMERGENCY_KIT.game.howTo.map(esc).map((h) => `<li>${h}</li>`).join("")}</ol></div>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>حزمة المعلّمة البديلة</title><style>${VISIT_CSS}
    .page-break{page-break-before:always}section:first-of-type{page-break-before:auto}</style></head><body>
    <div class="cover"><h1>حزمة المعلّمة البديلة</h1><div class="meta">${esc(school)} · مادة العلوم · ${new Date().toLocaleDateString("en-GB")}</div></div>
    <section><h2>تعليمات عامة</h2><div class="box"><p>شكراً لتعاونك. أدناه دروس اليوم بخططها وأوراق عملها، وملاحظات كل فصل، ونشاط بديل احتياطي إن بقي وقت.</p></div></section>
    ${lessonSections}
    <section class="page-break"><h2>ملاحظات الفصول</h2><ul>${notesHtml}</ul></section>
    <section><h2>النشاط البديل الاحتياطي</h2>${backup}</section>
    </body></html>`;
  printDoc(html);
  return true;
}
