/**
 * «مركز اليوم» — الشاشة الرئيسية (تحويل زكريت، المرحلة ١):
 * لا يزيد عن ٥–٦ قرارات أساسية فوق الطيّة — «ابدئي حصة اليوم» أولها.
 * كل ما عداها انتقل إلى أقسامه: الإدارة، المكتبة، الأدوات (الشريط السفلي).
 * لا شاشة فارغة أبداً (§2-د) — الحالة الفارغة تعرض زرع البيانات التجريبية.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  History,
  LifeBuoy,
  Play,
  Printer,
  RefreshCw,
  Star,
  UserX,
} from "lucide-react";
import { db, reseedDemo } from "@/db";
import CommandBox from "@/components/CommandBox";
import { EMERGENCY_KIT, kitByLessonTitle } from "@/content/lessonKits";
import { printEmergency, printWeekBundle } from "@/lib/kitPrint";
import { genSubstituteFile } from "@/lib/generate";
import { activeStudentsOf } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

export default function TodayPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const schoolName = useUi((x) => x.schoolName);
  const lastLesson = useUi((x) => x.lastLesson);
  const show = useToast((x) => x.show);

  const data = useLiveQuery(async () => {
    const lessons = (await db.lessons.toArray())
      .filter((l) => !l.deletedAt)
      .sort((a, b) => a.unitId - b.unitId || a.order - b.order);
    const units = new Map((await db.units.toArray()).map((u) => [u.id!, u.title]));
    const allStudents = (await db.students.toArray()).filter((st) => !st.deletedAt);
    const pendingRequests = (await db.studioRequests.toArray()).filter((r) => r.status === "pending").length;
    const anyDemo = allStudents.some((st) => st.isDemo);

    // طلبات «المطلوب منّي» قرب موعدها (خلال يومين) وغير المسلَّمة (§ الأمر ٨-ب)
    const now = Date.now();
    const dueSoonRequests = (await db.requests.toArray()).filter(
      (r) => !r.deletedAt && r.status !== "delivered" && r.dueDate != null && r.dueDate - now <= 2 * 86400000
    );

    // تنبيهات الإنذار المبكر (§ الأمر ٧) — أهم ثلاثة فقط هنا، والبقية في التحليلات
    const { earlyWarnings } = await import("@/lib/analytics");
    const warnings = (await earlyWarnings(0, now)).slice(0, 3);

    // تذكير النسخ الاحتياطي كل ٧ أيام (§7)
    const { needsBackupReminder } = await import("@/lib/backup");
    const backupOverdue = await needsBackupReminder(now);

    return { lessons, units, studentsCount: allStudents.length, pendingRequests, anyDemo, warnings, dueSoonRequests, backupOverdue };
  });

  const upcoming = (data?.lessons ?? []).slice(0, 3).map((l) => ({
    lesson: l,
    unitTitle: data?.units.get(l.unitId) ?? "",
    kit: kitByLessonTitle(l.title),
  }));
  const todayLesson = upcoming[0];

  async function headerInfo() {
    return { schoolName: schoolName || "مدرستي" };
  }

  async function classNames(): Promise<string[]> {
    if (!currentClassId) return [];
    const list = await activeStudentsOf(currentClassId);
    return list.sort((a, b) => a.rollNumber - b.rollNumber).map((st) => st.name);
  }

  async function handleEmergency() {
    printEmergency(EMERGENCY_KIT, await headerInfo());
    show(s.today.emergencyPrinted);
  }

  async function handleAbsent() {
    await genSubstituteFile();
    show(s.substitute.done);
  }

  async function handleWeekBundle() {
    const kits = upcoming.map((u) => u.kit).filter((k): k is NonNullable<typeof k> => Boolean(k));
    if (kits.length > 0) {
      printWeekBundle(kits, await headerInfo(), await classNames());
      show(s.today.weekBundlePrinted);
      return;
    }
    // دروس الكتاب الحقيقية: الحزمة تُبنى من إثراء كل درس + ورقة عمل من بنكه
    const { enrichmentByCode } = await import("@/content/enrichment");
    const { enrichmentSheetHtml } = await import("@/lib/enrichmentPrint");
    const { bankWorksheetHtml, printDoc } = await import("@/lib/reportPrint");
    const info = await headerInfo();
    const parts: string[] = [];
    for (const { lesson, unitTitle } of upcoming) {
      if (!lesson.code || lesson.id == null) continue;
      const enrichment = enrichmentByCode(lesson.code);
      if (enrichment) {
        parts.push(enrichmentSheetHtml(enrichment, info.schoolName, lesson.title).replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, ""));
      }
      const bank = (await db.questions.where("lessonId").equals(lesson.id).toArray()).filter((q) => !q.deletedAt).slice(0, 8);
      if (bank.length > 0) {
        parts.push(
          bankWorksheetHtml(bank, { schoolName: info.schoolName, title: `ورقة عمل: ${lesson.title}`, unitName: unitTitle, lessonCode: lesson.code }, false)
            .replace(/^[\s\S]*?<body>/, "")
            .replace(/<\/body>[\s\S]*$/, "")
        );
      }
    }
    if (parts.length === 0) {
      show(s.today.weekBundleEmpty, { kind: "info" });
      return;
    }
    const { PRINT_FONTS_CSS, IDENTITY_HEADER_CSS, identityFooter } = await import("@/lib/printTheme");
    printDoc(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>حزمة الأسبوع</title>
      <style>${PRINT_FONTS_CSS}${IDENTITY_HEADER_CSS}
      @page { size: A4; margin: 12mm; } * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: "Tajawal", sans-serif; font-size: 12pt; line-height: 1.9; color: #1E2430; }
      h2 { color: #0B534C; } ul, ol { padding-inline-start: 7mm; }
      .bundle-part { page-break-after: always; } .bundle-part:last-child { page-break-after: auto; }
      </style></head><body>${identityFooter("حزمة الأسبوع")}${parts.map((p) => `<div class="bundle-part">${p}</div>`).join("")}</body></html>`);
    show(s.today.weekBundlePrinted);
  }

  const greeting = new Date().getHours() < 12 ? s.today.greeting : s.today.greetingEvening;
  const empty = data !== undefined && data.studentsCount === 0;

  const alertsCount =
    (data?.warnings.length ?? 0) +
    (data?.dueSoonRequests.length ?? 0) +
    (data?.backupOverdue ? 1 : 0) +
    ((data?.pendingRequests ?? 0) > 0 ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* التحية — رأس محتوى هادئ، الهوية يحملها الإطار لا الصناديق */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-ink md:text-4xl">{greeting}</h1>
          <p className="mt-1 text-lg text-ink-soft">
            {empty
              ? s.home.emptyTitle
              : data
                ? s.home.summaryLine(fmtNum(3, numerals), fmtNum(data.studentsCount, numerals))
                : s.common.loading}
          </p>
        </div>
        {empty && (
          <button type="button" onClick={() => void reseedDemo()} className="btn-secondary">
            <RefreshCw className="size-5" aria-hidden />
            {s.home.emptyAction}
          </button>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* العمود الرئيسي — مجرى العمل */}
        <div className="space-y-5 lg:col-span-2">
          {/* الإجراءات الرئيسية — ثلاثة قرارات لا أكثر */}
          <section aria-label={s.a11y.primaryActions} className="space-y-3">
            <Link
              to={todayLesson ? `/show?lesson=${todayLesson.lesson.id}` : "/library"}
              className="btn-primary w-full flex-col gap-1 min-h-[92px]"
            >
              <span className="flex items-center gap-2 text-2xl font-bold">
                <Play className="size-8" aria-hidden />
                {s.today.startToday}
              </span>
              <span className="text-base font-medium text-white/85">
                {todayLesson ? s.today.startTodayHint(todayLesson.lesson.title) : s.today.startTodayEmpty}
              </span>
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/library"
                className="card flex min-h-[72px] items-center justify-center gap-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg"
              >
                <span className="icon-chip bg-teal-bg">
                  <BookOpen className="size-6 text-teal-dark" aria-hidden />
                </span>
                {s.today.prepNew}
              </Link>
              <Link
                to="/grades"
                className="card flex min-h-[72px] items-center justify-center gap-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg"
              >
                <span className="icon-chip bg-teal-bg">
                  <Camera className="size-6 text-teal-dark" aria-hidden />
                </span>
                {s.today.bigButtons.scan}
              </Link>
            </div>

            {lastLesson && lastLesson.id !== todayLesson?.lesson.id && (
              <Link
                to={`/library/${lastLesson.id}`}
                className="flex min-h-touch items-center gap-2 rounded-card border border-line bg-white px-3 py-2 font-medium text-ink-soft shadow-card transition-colors hover:border-teal hover:bg-teal-bg hover:text-teal-dark"
              >
                <History className="size-5 shrink-0" aria-hidden />
                <span className="me-auto">
                  {s.today.lastLesson}: <b className="text-ink">{lastLesson.title}</b>
                </span>
                <span className="font-bold text-teal-dark">{s.today.resume}</span>
              </Link>
            )}
          </section>

          {/* الصندوق الواحد — كتابةً أو صوتاً (§ الأمر ٨-ب) */}
          <CommandBox />

          {/* الدروس القادمة بعلامة جاهزة + حزمة الأسبوع */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-3 font-heading text-xl font-bold">
                <span className="icon-chip bg-teal-bg">
                  <BookOpen className="size-6 text-teal-dark" aria-hidden />
                </span>
                {s.today.upcomingLessons}
              </h2>
              <button type="button" onClick={() => void handleWeekBundle()} className="btn-secondary">
                <Printer className="size-5" aria-hidden />
                {s.today.weekBundle}
              </button>
            </div>
            <p className="text-sm text-ink-soft">{s.today.upcomingHint} · {s.today.weekBundleHint(fmtNum(30, numerals))}</p>
            <ul className="divide-y divide-line">
              {upcoming.map(({ lesson, unitTitle, kit }) => (
                <li key={lesson.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="me-auto">
                    <Link to={`/library/${lesson.id}`} className="text-lg font-bold text-teal-dark hover:underline">
                      {lesson.title}
                    </Link>
                    <p className="text-sm text-ink-soft">{unitTitle}</p>
                  </div>
                  {kit ? (
                    <span className="flex items-center gap-1 rounded-pill bg-teal-bg px-3 py-1 font-medium text-teal-dark">
                      <CheckCircle2 className="size-5" aria-hidden />
                      {s.today.ready}
                    </span>
                  ) : (
                    <span className="rounded-pill bg-gold-bg px-3 py-1 text-gold-dark">{s.library.kitMissing}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* العمود الجانبي — انتباه ووصول سريع وطوارئ */}
        <aside className="space-y-5">
          {/* تحتاج انتباهك — أهم الأشياء فقط، والبقية في التحليلات */}
          <section className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-3 font-heading text-xl font-bold">
                <span className="icon-chip bg-gold-bg">
                  <AlertTriangle className="size-6 text-gold-dark" aria-hidden />
                </span>
                {s.today.attention}
              </h2>
              {alertsCount > 0 && (
                <Link to="/analytics" className="font-medium text-teal-dark hover:underline">
                  {s.today.allAlerts}
                </Link>
              )}
            </div>
            {data === undefined ? (
              <p className="text-ink-soft">{s.common.loading}</p>
            ) : (
              <ul className="space-y-2">
                {data.warnings.map((w, i) => (
                  <li key={i} className={"rounded-card px-3 py-2 font-medium " + (w.severity === 3 ? "bg-danger-bg text-danger" : w.severity === 2 ? "bg-gold-bg text-gold-dark" : "bg-cream text-ink-soft")}>
                    {w.studentId ? (
                      <Link to={`/students/${w.studentId}`} className="hover:underline">{w.message}</Link>
                    ) : w.message}
                  </li>
                ))}
                {data.backupOverdue && (
                  <li className="rounded-card bg-gold-bg px-3 py-2 text-gold-dark">
                    <Link to="/settings" className="hover:underline">{s.backup.reminder}</Link>
                  </li>
                )}
                {data.dueSoonRequests.map((r) => (
                  <li key={`req-${r.id}`} className="rounded-card bg-gold-bg px-3 py-2 text-gold-dark">
                    <Link to="/requests" className="hover:underline">{s.requests.dueSoon(r.title)}</Link>
                  </li>
                ))}
                {data.pendingRequests > 0 && (
                  <li className="rounded-card bg-gold-bg px-3 py-2 text-gold-dark">
                    {s.today.pendingRequests(fmtNum(data.pendingRequests, numerals))}
                  </li>
                )}
                {data.anyDemo && (
                  <li className="rounded-card bg-cream px-3 py-2 text-ink-soft">{s.today.demoNote}</li>
                )}
                {alertsCount === 0 && !data.anyDemo && (
                  <li className="text-ink-soft">{s.today.attentionEmpty}</li>
                )}
              </ul>
            )}
          </section>

          {/* الوصول السريع — المهام اليومية التي ليست في التنقّل الرئيسي */}
          <section aria-label={s.today.quickAccess} className="grid grid-cols-2 gap-3">
            <Link to="/attendance" className="card flex min-h-[60px] items-center justify-center gap-2 p-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg">
              <CalendarCheck className="size-6 text-teal-dark" aria-hidden />
              {s.attendance.title}
            </Link>
            <Link to="/points" className="card flex min-h-[60px] items-center justify-center gap-2 p-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg">
              <Star className="size-6 text-teal-dark" aria-hidden />
              {s.points.title}
            </Link>
            <Link to="/exams" className="card flex min-h-[60px] items-center justify-center gap-2 p-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg">
              <ClipboardList className="size-6 text-teal-dark" aria-hidden />
              {s.exams.title}
            </Link>
            <Link to="/reports" className="card flex min-h-[60px] items-center justify-center gap-2 p-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg">
              <FileBarChart className="size-6 text-teal-dark" aria-hidden />
              {s.reports.title}
            </Link>
          </section>

          {/* زر الطوارئ — في متناول اليد دون أن يتصدّر */}
          <section className="card space-y-3 border-2 border-danger/70">
            <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-danger">
              <span className="icon-chip bg-danger-bg">
                <LifeBuoy className="size-6" aria-hidden />
              </span>
              {s.today.emergency}
            </h2>
            <p className="text-ink-soft">{s.today.emergencyHint}</p>
            <div className="grid gap-3">
              <button type="button" onClick={() => void handleEmergency()} className="btn-danger min-h-[56px] text-lg">
                <Printer className="size-6" aria-hidden />
                {s.common.print}
              </button>
              <button type="button" onClick={() => void handleAbsent()} className="btn min-h-[56px] border-2 border-danger bg-white text-lg text-danger hover:bg-danger-bg">
                <UserX className="size-6" aria-hidden />
                {s.substitute.title}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
