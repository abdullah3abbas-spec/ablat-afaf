/**
 * الشاشة الرئيسية: بطاقات كبيرة لكل قسم + ملخص سريع
 * (عدد الطالبات، متوسط كل فصل، أعلى ٣ في النقاط، تنبيهات اليوم).
 * لا شاشة فارغة أبداً (§2-د).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  FileBarChart,
  RefreshCw,
  School,
  Settings,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { db, reseedDemo } from "@/db";
import { classStats, sumPoints } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

export default function HomePage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);

  const summary = useLiveQuery(async () => {
    const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);
    const students = (await db.students.toArray()).filter((st) => !st.deletedAt);

    const perClass = await Promise.all(
      classes.map(async (c) => ({ name: c.name, id: c.id!, ...(await classStats(c.id!)) }))
    );

    // أعلى ٣ في النقاط (يعمل تلقائياً حين تبدأ النقاط في الأمر ٣)
    const withPoints = await Promise.all(
      students.map(async (st) => ({
        name: st.name,
        points: sumPoints(await db.points.where("studentId").equals(st.id!).toArray()),
      }))
    );
    const top3 = withPoints
      .filter((x) => x.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);

    return { classes: perClass, studentCount: students.length, top3 };
  });

  const empty = summary !== undefined && summary.studentCount === 0 && summary.classes.length === 0;

  const sections = [
    { key: "classes", label: s.home.sections.classes, icon: School, to: "/classes" },
    { key: "grades", label: s.home.sections.grades, icon: BarChart3 },
    { key: "attendance", label: s.home.sections.attendance, icon: CalendarCheck },
    { key: "points", label: s.home.sections.points, icon: Star },
    { key: "exams", label: s.home.sections.exams, icon: ClipboardList },
    { key: "certificates", label: s.home.sections.certificates, icon: Award },
    { key: "reports", label: s.home.sections.reports, icon: FileBarChart },
    { key: "settings", label: s.home.sections.settings, icon: Settings, to: "/settings" },
  ];

  return (
    <div className="space-y-6">
      {/* الترحيب */}
      <section className="card bg-gradient-to-l from-teal to-teal-dark text-white">
        <h1 className="font-heading text-3xl font-bold">{s.home.welcome}</h1>
        {empty ? (
          <div className="mt-3">
            <p className="text-lg">{s.home.emptyTitle}</p>
            <button
              type="button"
              onClick={() => void reseedDemo()}
              className="btn mt-3 bg-white text-teal-dark hover:bg-teal-bg"
            >
              <RefreshCw className="size-5" aria-hidden />
              {s.home.emptyAction}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-lg text-white/90">
            {summary
              ? s.home.summaryLine(
                  fmtNum(summary.classes.length, numerals),
                  fmtNum(summary.studentCount, numerals)
                )
              : s.common.loading}
          </p>
        )}
      </section>

      {/* بطاقات الأقسام */}
      <section aria-label={s.a11y.mainNav}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sections.map((sec) =>
            sec.to ? (
              <Link
                key={sec.key}
                to={sec.to}
                className="card flex min-h-28 flex-col items-center justify-center gap-2 text-center transition-colors hover:border-teal hover:bg-teal-bg"
              >
                <sec.icon className="size-8 text-teal-dark" aria-hidden />
                <span className="text-lg font-bold">{sec.label}</span>
              </Link>
            ) : (
              <div
                key={sec.key}
                className="card flex min-h-28 flex-col items-center justify-center gap-2 text-center opacity-55"
              >
                <sec.icon className="size-8 text-ink-soft" aria-hidden />
                <span className="text-lg font-medium">{sec.label}</span>
                <span className="rounded-pill bg-gold-bg px-2 text-sm font-medium text-gold-dark">{s.common.soon}</span>
              </div>
            )
          )}
        </div>
      </section>

      {/* الملخص السريع */}
      {summary && !empty && (
        <section className="grid gap-4 lg:grid-cols-2">
          {/* متوسطات الفصول */}
          <div className="card space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <Users className="size-6 text-teal-dark" aria-hidden />
              {s.homeSummary.classAverages}
            </h2>
            <ul className="divide-y divide-line">
              {summary.classes.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link to={`/classes/${c.id}`} className="font-medium text-teal-dark hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-ink-soft">
                    {fmtNum(c.count, numerals)} {s.classes.studentsCountLabel} ·{" "}
                    {c.average === undefined ? s.classes.noGradesYet : fmtNum(c.average, numerals)}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/classes" className="btn-secondary w-full">
              <School className="size-5" aria-hidden />
              {s.homeSummary.goToClasses}
            </Link>
          </div>

          <div className="space-y-4">
            {/* أعلى ٣ في النقاط */}
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
                <Sparkles className="size-6 text-gold" aria-hidden />
                {s.homeSummary.topPoints}
              </h2>
              {summary.top3.length === 0 ? (
                <p className="text-ink-soft">{s.homeSummary.topPointsEmpty}</p>
              ) : (
                <ol className="space-y-1">
                  {summary.top3.map((t, i) => (
                    <li key={t.name} className="flex justify-between">
                      <span>
                        {fmtNum(i + 1, numerals)}. {t.name}
                      </span>
                      <span className="font-bold text-teal-dark">{fmtNum(t.points, numerals)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* تنبيهات اليوم */}
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
                <Bell className="size-6 text-maroon" aria-hidden />
                {s.homeSummary.alerts}
              </h2>
              <p className="text-ink-soft">{s.homeSummary.alertsEmpty}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
