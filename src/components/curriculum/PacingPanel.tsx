/** التوزيع الزمني: حالة التقدّم + الحصص المتبقية لكل وحدة + الدرس التالي */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarRange, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { db } from "@/db";
import { nextLesson, pacingStatus, remainingInUnit } from "@/lib/pacing";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

export default function PacingPanel() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [startDate, setStartDate] = useState("");
  const [weekly, setWeekly] = useState(5);

  const year = useLiveQuery(() => db.academicYears.filter((y) => y.isCurrent).first());

  useEffect(() => {
    if (year) {
      setWeekly(year.weeklySessions ?? 5);
      if (year.startDate) setStartDate(new Date(year.startDate).toISOString().slice(0, 10));
    }
  }, [year?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useLiveQuery(async () => {
    const y = await db.academicYears.filter((yy) => yy.isCurrent).first();
    if (!y) return null;
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order);
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
    const status = pacingStatus(lessons, y, Date.now());
    const perUnit = units.map((u) => ({ unit: u, ...remainingInUnit(lessons.filter((l) => l.unitId === u.id)) }));
    const next = nextLesson(units, lessons);
    return { status, perUnit, next, hasStart: !!y.startDate };
  });

  async function saveSetup() {
    if (!year) return;
    await db.academicYears.update(year.id!, {
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      weeklySessions: weekly,
      teachingDays: year.teachingDays ?? [0, 1, 2, 3, 4],
      updatedAt: Date.now(),
    });
    show(s.curriculum.saved);
  }

  if (!data) return <p className="card text-ink-soft">{s.common.loading}</p>;

  const st = data.status;
  const StateIcon = st.state === "ahead" ? TrendingUp : st.state === "behind" ? TrendingDown : CheckCircle2;
  const stateCls = st.state === "ahead" ? "border-teal bg-teal-bg text-teal-dark" : st.state === "behind" ? "border-danger bg-danger-bg text-danger" : "border-teal bg-teal-bg text-teal-dark";
  const stateLabel = st.state === "ahead" ? s.pacing.ahead : st.state === "behind" ? s.pacing.behind : s.pacing.onTrack;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <CalendarRange className="size-5 text-teal-dark" aria-hidden />
          {s.pacing.setup}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1"><span className="font-medium">{s.pacing.startDate}</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-h-touch rounded-card border-2 border-line px-3 focus:border-teal" /></label>
          <label className="block space-y-1"><span className="font-medium">{s.pacing.weeklySessions}</span><input type="number" min={1} max={10} value={weekly} onChange={(e) => setWeekly(Number(e.target.value))} className="min-h-touch w-24 rounded-card border-2 border-line px-3 text-center focus:border-teal" /></label>
          <button type="button" onClick={() => void saveSetup()} className="btn-primary">{s.common.save}</button>
        </div>
      </section>

      {!data.hasStart ? (
        <p className="card bg-gold-bg text-gold-dark">{s.pacing.noStart}</p>
      ) : (
        <div className={"card flex flex-wrap items-center gap-4 border-2 " + stateCls}>
          <StateIcon className="size-8" aria-hidden />
          <div>
            <p className="text-xl font-bold">{stateLabel}{st.state !== "onTrack" ? ` — ${s.pacing.aheadBy(fmtNum(Math.abs(st.aheadBy), numerals))}` : ""}</p>
            <p className="text-sm">{s.pacing.taughtOf(fmtNum(st.taughtSessions, numerals), fmtNum(st.totalSessions, numerals))} · {s.pacing.expected(fmtNum(st.expectedByNow, numerals))}</p>
          </div>
        </div>
      )}

      <section className="card space-y-2">
        <h2 className="font-heading text-lg font-bold">{s.curriculum.tree}</h2>
        <ul className="divide-y divide-line">
          {data.perUnit.map(({ unit, remaining, total }) => (
            <li key={unit.id} className="flex items-center justify-between py-2">
              <span className="font-medium">{unit.title}</span>
              <span className={"tabular-nums " + (remaining === 0 ? "text-ok" : "text-ink-soft")}>
                {s.pacing.remainingUnit("", fmtNum(remaining, numerals), fmtNum(total, numerals))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.next && (
        <p className="card border-teal bg-teal-bg text-teal-dark">
          <b>{s.pacing.nextLesson}:</b> {data.next.title}
        </p>
      )}
    </div>
  );
}
