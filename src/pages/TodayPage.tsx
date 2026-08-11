/**
 * شاشة اليوم — الشاشة الرئيسية (§2-ج البند ١):
 * تحية · دروس قادمة بعلامة «جاهزة» · خمسة أزرار كبيرة (التصوير الأبرز)
 * · «تحتاج انتباهك» · زر الطوارئ · حزمة الأسبوع. لا شاشة فارغة أبداً.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Camera,
  CheckCircle2,
  FolderOpen,
  LifeBuoy,
  Printer,
  RefreshCw,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { db, reseedDemo } from "@/db";
import { EMERGENCY_KIT, kitByLessonTitle } from "@/content/lessonKits";
import { printEmergency, printWeekBundle } from "@/lib/kitPrint";
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
  const show = useToast((x) => x.show);

  const data = useLiveQuery(async () => {
    const lessons = (await db.lessons.toArray())
      .filter((l) => !l.deletedAt)
      .sort((a, b) => a.unitId - b.unitId || a.order - b.order);
    const units = new Map((await db.units.toArray()).map((u) => [u.id!, u.title]));
    const allStudents = (await db.students.toArray()).filter((st) => !st.deletedAt);
    const pendingRequests = (await db.studioRequests.toArray()).filter((r) => r.status === "pending").length;
    const anyDemo = allStudents.some((st) => st.isDemo);

    // تنبيه تكرار الغياب هذا الشهر (العتبة من الإعدادات — بيانات)
    const settings = await db.settings.get(1);
    const threshold = settings?.absenceAlertThreshold ?? 4;
    const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const attendance = (await db.attendance.toArray()).filter((a) => !a.deletedAt && a.status === "absent");
    const byStudent = new Map<number, number>();
    for (const a of attendance) {
      const d = new Date(a.date);
      const amk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (amk === mk) byStudent.set(a.studentId, (byStudent.get(a.studentId) ?? 0) + 1);
    }
    const absenceAlerts: { name: string; count: number }[] = [];
    for (const [sid, count] of byStudent) {
      if (count >= threshold) {
        const st = allStudents.find((x) => x.id === sid);
        if (st) absenceAlerts.push({ name: st.name, count });
      }
    }

    return { lessons, units, studentsCount: allStudents.length, pendingRequests, anyDemo, absenceAlerts };
  });

  const upcoming = (data?.lessons ?? []).slice(0, 3).map((l) => ({
    lesson: l,
    unitTitle: data?.units.get(l.unitId) ?? "",
    kit: kitByLessonTitle(l.title),
  }));

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

  async function handleWeekBundle() {
    const kits = upcoming.map((u) => u.kit).filter((k): k is NonNullable<typeof k> => Boolean(k));
    if (kits.length === 0) return;
    printWeekBundle(kits, await headerInfo(), await classNames());
    show(s.today.weekBundlePrinted);
  }

  const greeting = new Date().getHours() < 12 ? s.today.greeting : s.today.greetingEvening;
  const empty = data !== undefined && data.studentsCount === 0;

  const bigButtons = [
    { key: "library", label: s.today.bigButtons.library, icon: BookOpen, to: "/library" },
    { key: "motivation", label: s.today.bigButtons.motivation, icon: Star, to: "/points" },
    { key: "assessment", label: s.today.bigButtons.assessment, icon: BarChart3, to: "/grades" },
    { key: "students", label: s.today.bigButtons.students, icon: Users, to: "/classes" },
  ];

  return (
    <div className="space-y-6">
      {/* التحية */}
      <section className="card bg-gradient-to-l from-teal to-teal-dark text-white">
        <h1 className="font-heading text-3xl font-bold">{greeting}</h1>
        {empty ? (
          <button type="button" onClick={() => void reseedDemo()} className="btn mt-3 bg-white text-teal-dark hover:bg-teal-bg">
            <RefreshCw className="size-5" aria-hidden />
            {s.home.emptyAction}
          </button>
        ) : (
          <p className="mt-1 text-white/90">
            {data
              ? s.home.summaryLine(fmtNum(3, numerals), fmtNum(data.studentsCount, numerals))
              : s.common.loading}
          </p>
        )}
      </section>

      {/* الأزرار الخمسة — التصوير الأكبر والأبرز */}
      <section aria-label={s.a11y.mainNav} className="space-y-3">
        <Link
          to="/grades"
          className="btn w-full bg-maroon text-white hover:bg-maroon-dark min-h-[76px] text-2xl font-bold shadow-bar"
        >
          <Camera className="size-9" aria-hidden />
          {s.today.bigButtons.scan}
        </Link>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {bigButtons.map((b) => (
            <Link
              key={b.key}
              to={b.to}
              className="card flex min-h-[64px] items-center justify-center gap-2 font-bold transition-colors hover:border-teal hover:bg-teal-bg"
            >
              <b.icon className="size-6 text-teal-dark" aria-hidden />
              {b.label}
            </Link>
          ))}
        </div>
      </section>

      {/* الدروس القادمة بعلامة جاهزة */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <BookOpen className="size-6 text-teal-dark" aria-hidden />
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

      {/* تحتاج انتباهك + الطوارئ */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <AlertTriangle className="size-6 text-gold-dark" aria-hidden />
            {s.today.attention}
          </h2>
          {data === undefined ? (
            <p className="text-ink-soft">{s.common.loading}</p>
          ) : (
            <ul className="space-y-2">
              {data.absenceAlerts.map((a) => (
                <li key={a.name} className="rounded-card bg-danger-bg px-3 py-2 font-medium text-danger">
                  {s.attendance.absenceAlertLine(a.name, fmtNum(a.count, numerals))}
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
              {data.pendingRequests === 0 && !data.anyDemo && data.absenceAlerts.length === 0 && (
                <li className="text-ink-soft">{s.today.attentionEmpty}</li>
              )}
            </ul>
          )}
        </div>

        <div className="card space-y-3 border-2 border-danger">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-danger">
            <LifeBuoy className="size-6" aria-hidden />
            {s.today.emergency}
          </h2>
          <p className="text-ink-soft">{s.today.emergencyHint}</p>
          <button type="button" onClick={() => void handleEmergency()} className="btn-danger w-full min-h-[56px] text-lg">
            <Printer className="size-6" aria-hidden />
            {s.common.print}
          </button>
        </div>
      </section>

      {/* وصول سريع ثانوي */}
      <nav className="flex flex-wrap gap-3">
        <Link to="/attendance" className="flex min-h-touch items-center gap-1 rounded-card px-3 text-teal-dark hover:bg-teal-bg">
          <CalendarCheck className="size-5" aria-hidden />
          {s.attendance.title}
        </Link>
        <Link to="/exams" className="flex min-h-touch items-center gap-1 rounded-card px-3 text-teal-dark hover:bg-teal-bg">
          <ClipboardList className="size-5" aria-hidden />
          {s.exams.title}
        </Link>
        <Link to="/resources" className="flex min-h-touch items-center gap-1 rounded-card px-3 text-teal-dark hover:bg-teal-bg">
          <FolderOpen className="size-5" aria-hidden />
          {s.resources.title}
        </Link>
        <Link to="/settings" className="flex min-h-touch items-center gap-1 rounded-card px-3 text-teal-dark hover:bg-teal-bg">
          <Settings className="size-5" aria-hidden />
          {s.common.settings}
        </Link>
      </nav>
    </div>
  );
}
