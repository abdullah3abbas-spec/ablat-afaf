/**
 * تبويب «الحضور والنقاط» في ملف الطالبة:
 * ملخص حضور الشهر + الرصيد والمستوى وآخر قيود النقاط والمصروفات.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarCheck, Star } from "lucide-react";
import { db } from "@/db";
import { cumulativePoints, levelOf, monthKeyOf, monthlyPoints, spendableBalance } from "@/lib/points";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import EmptyState from "./EmptyState";

export default function StudentAttendancePoints({ studentId }: { studentId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);

  const data = useLiveQuery(async () => {
    const mk = monthKeyOf(Date.now());
    const attendance = (await db.attendance.where("studentId").equals(studentId).toArray()).filter(
      (a) => !a.deletedAt && monthKeyOf(a.date) === mk
    );
    const count = (x: string) => attendance.filter((a) => a.status === x).length;

    const settings = await db.settings.get(1);
    const monthly = await monthlyPoints(studentId, mk);
    const cumulative = await cumulativePoints(studentId);
    const balance = await spendableBalance(studentId);
    const level = levelOf(cumulative, settings?.pointLevels ?? []);

    const entries = (await db.points.where("studentId").equals(studentId).toArray())
      .filter((p) => !p.deletedAt)
      .sort((a, b) => b.awardedAt - a.awardedAt)
      .slice(0, 8);

    return {
      att: { present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused") },
      hasAtt: attendance.length > 0,
      monthly,
      cumulative,
      balance,
      level,
      entries,
    };
  }, [studentId]);

  if (!data) return null;
  const noData = !data.hasAtt && data.cumulative === 0;
  if (noData) {
    return <EmptyState icon={CalendarCheck} title={s.studentFile.attendanceEmpty} hint={s.studentFile.attendanceEmptyHint} />;
  }

  const attCards = [
    { label: s.attendance.statuses.present, value: data.att.present, cls: "bg-teal-bg text-teal-dark" },
    { label: s.attendance.statuses.absent, value: data.att.absent, cls: "bg-danger-bg text-danger" },
    { label: s.attendance.statuses.late, value: data.att.late, cls: "bg-gold-bg text-gold-dark" },
    { label: s.attendance.statuses.excused, value: data.att.excused, cls: "bg-cream text-ink-soft" },
  ];

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
          <CalendarCheck className="size-5 text-teal-dark" aria-hidden />
          {s.attendance.title} — {new Date().toLocaleDateString("ar", { month: "long" })}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {attCards.map((c) => (
            <div key={c.label} className={`rounded-card p-3 text-center ${c.cls}`}>
              <p className="text-2xl font-bold tabular-nums">{fmtNum(c.value, numerals)}</p>
              <p className="text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Star className="size-5 text-gold-dark" aria-hidden />
          {s.points.title}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-card bg-teal-bg p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-teal-dark">{fmtNum(data.monthly, numerals)}</p>
            <p className="text-sm">{s.points.monthly}</p>
          </div>
          <div className="rounded-card bg-cream p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{fmtNum(data.cumulative, numerals)}</p>
            <p className="text-sm">{s.points.cumulative}</p>
          </div>
          <div className="rounded-card bg-gold-bg p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-gold-dark">{fmtNum(data.balance, numerals)}</p>
            <p className="text-sm">{s.points.balance}</p>
          </div>
          <div className="rounded-card bg-maroon p-3 text-center text-white">
            <p className="truncate text-lg font-bold">{data.level?.nameAr ?? "—"}</p>
            <p className="text-sm opacity-90">{s.points.level}</p>
          </div>
        </div>
        {data.entries.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {data.entries.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-1.5">
                <span className="me-auto truncate">{p.reason?.replace(/\s*\([^)]*\)\s*$/, "")}</span>
                <span className="font-bold tabular-nums text-teal-dark">+{fmtNum(p.delta, numerals)}</span>
                <span className="ms-3 text-ink-soft">
                  {new Date(p.awardedAt).toLocaleDateString("ar", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
