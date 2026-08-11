/**
 * نسخة «عرض على السبورة» — خط ضخم وألوان لعرضها بجهاز العرض:
 * أعلى عشر طالبات بنقاط الشهر مع المستويات.
 */
import { useSearchParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Trophy } from "lucide-react";
import { db } from "@/db";
import { activeStudentsOf } from "@/lib/students";
import { cumulativePoints, levelOf, monthKeyOf, monthlyPoints } from "@/lib/points";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

export default function BoardPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [params] = useSearchParams();
  const classId = Number(params.get("class")) || 0;

  const data = useLiveQuery(async () => {
    if (!classId) return { klass: undefined, rows: [] };
    const klass = await db.classes.get(classId);
    const settings = await db.settings.get(1);
    const levels = settings?.pointLevels ?? [];
    const students = await activeStudentsOf(classId);
    const mk = monthKeyOf(Date.now());
    const rows = await Promise.all(
      students.map(async (student) => {
        const monthly = await monthlyPoints(student.id!, mk);
        const cumulative = await cumulativePoints(student.id!);
        return { student, monthly, level: levelOf(cumulative, levels) };
      })
    );
    rows.sort((a, b) => b.monthly - a.monthly);
    return { klass, rows: rows.filter((r) => r.monthly > 0).slice(0, 10) };
  }, [classId]);

  const monthName = new Date().toLocaleDateString("ar", { month: "long" });

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-gradient-to-b from-maroon to-maroon-dark p-8 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-4 font-heading text-5xl font-bold">
            <Trophy className="size-14 text-gold" aria-hidden />
            {s.points.leaderboard} — {monthName}
          </h1>
          <Link
            to="/points"
            className="flex min-h-touch items-center gap-2 rounded-card bg-white/10 px-4 text-xl hover:bg-white/20"
          >
            <ArrowRight className="size-6" aria-hidden />
            {s.common.back}
          </Link>
        </div>
        {data?.klass && <p className="font-heading text-3xl text-white/90">{data.klass.name}</p>}

        {!data || data.rows.length === 0 ? (
          <p className="py-20 text-center font-heading text-4xl text-white/80">{s.points.noneYet}</p>
        ) : (
          <ol className="space-y-4">
            {data.rows.map((row, i) => (
              <li
                key={row.student.id}
                className={
                  "flex items-center gap-6 rounded-card px-8 py-5 " +
                  (i === 0
                    ? "bg-gold text-maroon-dark"
                    : i === 1
                      ? "bg-white/90 text-maroon-dark"
                      : i === 2
                        ? "bg-teal-bg text-teal-dark"
                        : "bg-white/10")
                }
              >
                <span className="w-16 text-center font-heading text-5xl font-bold tabular-nums">
                  {fmtNum(i + 1, numerals)}
                </span>
                <span className="me-auto font-heading text-4xl font-bold">{row.student.name}</span>
                {row.level && <span className="text-2xl opacity-90">{row.level.nameAr}</span>}
                <span className="font-heading text-5xl font-bold tabular-nums">{fmtNum(row.monthly, numerals)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
