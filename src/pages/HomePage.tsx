/**
 * الصفحة الرئيسية للأمر ٠ — إثبات حي أن قاعدة البيانات تعمل:
 * ملخص مباشر عبر useLiveQuery + بطاقات الأقسام القادمة.
 * لا شاشة فارغة أبداً (§2-د).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db, reseedDemo } from "@/db";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { fmtNum } from "@/lib/numerals";

export default function HomePage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);

  const counts = useLiveQuery(async () => ({
    classes: await db.classes.filter((c) => !c.deletedAt).count(),
    students: await db.students.filter((st) => !st.deletedAt).count(),
    units: await db.units.filter((u) => !u.deletedAt).count(),
    lessons: await db.lessons.filter((l) => !l.deletedAt).count(),
  }));

  const empty = counts !== undefined && counts.students === 0;

  const sections = [
    { key: "classes", label: s.home.sections.classes, icon: "🏫" },
    { key: "grades", label: s.home.sections.grades, icon: "📊" },
    { key: "attendance", label: s.home.sections.attendance, icon: "✅" },
    { key: "points", label: s.home.sections.points, icon: "⭐" },
    { key: "exams", label: s.home.sections.exams, icon: "📝" },
    { key: "certificates", label: s.home.sections.certificates, icon: "🏅" },
    { key: "reports", label: s.home.sections.reports, icon: "📈" },
  ];

  return (
    <div className="space-y-6">
      <section className="card bg-gradient-to-l from-teal to-teal-dark text-white">
        <h1 className="font-heading text-3xl font-bold">{s.home.welcome}</h1>
        <p className="mt-2 text-lg text-white/90">{s.home.foundationReady}</p>

        {counts === undefined ? (
          <p className="mt-4 text-white/80">{s.common.loading}</p>
        ) : empty ? (
          <div className="mt-4">
            <p className="text-lg font-medium">{s.home.emptyTitle}</p>
            <button
              type="button"
              onClick={() => void reseedDemo()}
              className="btn mt-3 bg-white text-teal-dark hover:bg-teal-bg"
            >
              🔄 {s.home.emptyAction}
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-1 text-lg">
            <li>
              📚{" "}
              {s.home.summaryLine(
                fmtNum(counts.classes, numerals),
                fmtNum(counts.students, numerals)
              )}
            </li>
            <li>
              📖{" "}
              {s.home.unitsLine(fmtNum(counts.units, numerals), fmtNum(counts.lessons, numerals))}
            </li>
            <li>🎯 {s.home.policyLine}</li>
          </ul>
        )}
      </section>

      <section aria-label={s.a11y.mainNav}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sections.map((sec) => (
            <div
              key={sec.key}
              className="card flex min-h-[96px] flex-col items-center justify-center gap-1 text-center opacity-60"
            >
              <span className="text-2xl" aria-hidden>
                {sec.icon}
              </span>
              <span className="font-medium">{sec.label}</span>
              <span className="rounded-pill bg-gold-bg px-2 text-sm text-gold">
                {s.common.soon}
              </span>
            </div>
          ))}
          <Link
            to="/settings"
            className="card flex min-h-[96px] flex-col items-center justify-center gap-1 text-center transition-colors hover:border-teal hover:bg-teal-bg"
          >
            <span className="text-2xl" aria-hidden>
              ⚙️
            </span>
            <span className="font-medium">{s.home.sections.settings}</span>
          </Link>
        </div>
      </section>

      <p className="card border-gold bg-gold-bg text-ink">💡 {s.home.nextStep}</p>
    </div>
  );
}
