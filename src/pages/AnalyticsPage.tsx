/**
 * التحليلات والإنذار المبكر (§ الأمر ٧، §12): رسوم من الدرجات،
 * التنبيهات الأربعة، المجموعات العلاجية، سجل تواصل أولياء الأمور،
 * والمقارنة السنوية.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, BarChart3, CalendarClock, LineChart, Printer, Trash2, Users } from "lucide-react";
import { db } from "@/db";
import type { ParentContact, Term } from "@/db/schema";
import { classAverages, earlyWarnings, levelDistribution, remedialGroups, yearComparison, type Alert } from "@/lib/analytics";
import { barChartSvg } from "@/lib/reportPrint";
import { activeStudentsOf } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

type Tab = "charts" | "alerts" | "remedial" | "parents" | "years";

export default function AnalyticsPage() {
  const s = useStrings();
  const currentClassId = useUi((x) => x.currentClassId);
  const [tab, setTab] = useState<Tab>("charts");
  const [classId, setClassId] = useState(0);

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "charts", label: s.analytics.tabs.charts, icon: BarChart3 },
    { key: "alerts", label: s.analytics.tabs.alerts, icon: AlertTriangle },
    { key: "remedial", label: s.analytics.tabs.remedial, icon: Users },
    { key: "parents", label: s.analytics.tabs.parents, icon: CalendarClock },
    { key: "years", label: s.analytics.tabs.years, icon: LineChart },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <BarChart3 className="size-7" aria-hidden />
          {s.analytics.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.analytics.subtitle}</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">{s.analytics.pickClass}:</span>
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal">
            <option value={0}>—</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={"btn " + (tab === t.key ? "bg-maroon text-white" : "border-2 border-line bg-white text-ink hover:border-maroon")}>
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "charts" && <ChartsTab classId={classId} />}
      {tab === "alerts" && <AlertsTab classId={classId} />}
      {tab === "remedial" && <RemedialTab classId={classId} />}
      {tab === "parents" && <ParentsTab classId={classId} />}
      {tab === "years" && <YearsTab />}
    </div>
  );
}

function ChartsTab({ classId }: { classId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const data = useLiveQuery(async () => {
    const settings = await db.settings.get(1);
    const term = (settings?.currentTerm ?? 1) as Term;
    const averages = await classAverages(term);
    const levels = classId ? await levelDistribution(classId) : [];
    return { averages, levels };
  }, [classId]);

  if (!data) return <p className="card text-ink-soft">{s.common.loading}</p>;
  const hasAvg = data.averages.some((a) => a.average > 0);
  const hasLevels = data.levels.some((l) => l.count > 0);

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-heading text-lg font-bold">{s.analytics.classAverages}</h2>
        {hasAvg ? (
          <div dangerouslySetInnerHTML={{ __html: barChartSvg(data.averages.map((a) => ({ label: a.className, value: a.average })), { maxValue: 100, valueSuffix: "٪" }) }} />
        ) : <p className="text-ink-soft">{s.analytics.noData}</p>}
      </section>

      {classId > 0 && (
        <section className="card space-y-2">
          <h2 className="font-heading text-lg font-bold">{s.analytics.levelDist}</h2>
          {hasLevels ? (
            <div dangerouslySetInnerHTML={{ __html: barChartSvg(data.levels.map((l) => ({ label: l.level, value: l.count })), { maxValue: Math.max(...data.levels.map((l) => l.count)) }) }} />
          ) : <p className="text-ink-soft">{s.analytics.noData}</p>}
        </section>
      )}
      <p className="text-sm text-ink-soft">📊 القيم أرقام مباشرة على الأعمدة — {fmtNum(data.averages.length, numerals)} فصول</p>
    </div>
  );
}

function AlertsTab({ classId }: { classId: number }) {
  const s = useStrings();
  const alerts = useLiveQuery(async () => earlyWarnings(classId, Date.now()), [classId]);

  const kindCls = (a: Alert) => (a.severity === 3 ? "border-danger bg-danger-bg text-danger" : a.severity === 2 ? "border-gold bg-gold-bg text-gold-dark" : "border-line bg-cream text-ink-soft");
  const kindLabel = (a: Alert) => s.analytics.alerts[a.kind];

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
        <AlertTriangle className="size-5 text-gold-dark" aria-hidden />
        {s.analytics.alerts.title}
      </h2>
      {!alerts ? (
        <p className="text-ink-soft">{s.common.loading}</p>
      ) : alerts.length === 0 ? (
        <p className="text-ink-soft">{s.analytics.alerts.none}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className={"flex items-center gap-3 rounded-card border-2 p-3 " + kindCls(a)}>
              <span className="rounded-pill bg-white/60 px-2 text-sm font-bold">{kindLabel(a)}</span>
              <span className="me-auto">{a.message}</span>
              {a.studentId && <Link to={`/students/${a.studentId}`} className="font-medium underline">{s.common.open}</Link>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemedialTab({ classId }: { classId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const groups = useLiveQuery(async () => {
    const settings = await db.settings.get(1);
    return classId ? remedialGroups(classId, (settings?.currentTerm ?? 1) as Term) : [];
  }, [classId]);

  async function printPlan(g: NonNullable<typeof groups>[number]) {
    const settings = await db.settings.get(1);
    const { genRemedialPlan } = await import("@/lib/generate");
    await genRemedialPlan(classId, (settings?.currentTerm ?? 1) as Term, g.weaknessKey);
    show(s.library.printedElement);
  }

  return (
    <div className="space-y-3">
      <p className="card bg-teal-bg text-teal-dark">{s.analytics.remedial.hint}</p>
      {!groups ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : groups.length === 0 ? (
        <p className="card text-ink-soft">{s.analytics.remedial.none}</p>
      ) : (
        groups.map((g) => (
          <section key={g.weaknessKey} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-maroon">{s.analytics.remedial.weakness(g.weaknessName)}</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-gold-bg px-3 py-1 text-gold-dark">{s.analytics.remedial.studentsCount(fmtNum(g.students.length, numerals))}</span>
                <button type="button" onClick={() => void printPlan(g)} className="btn-secondary px-4"><Printer className="size-5" aria-hidden />{s.analytics.remedial.print}</button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {g.students.map((st) => (
                <li key={st.id} className="rounded-pill bg-cream px-3 py-1">{st.name} <span className="text-danger">({fmtNum(st.pct, numerals)}٪)</span></li>
              ))}
            </ul>
            <p className="rounded-card bg-teal-bg p-3 text-teal-dark"><b>{s.analytics.remedial.activity}:</b> {g.suggestedActivity}</p>
          </section>
        ))
      )}
    </div>
  );
}

function ParentsTab({ classId }: { classId: number }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [studentId, setStudentId] = useState(0);
  const [channel, setChannel] = useState<ParentContact["channel"]>("whatsapp");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("");

  const students = useLiveQuery(async () => (classId ? (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber) : []), [classId]);
  const log = useLiveQuery(async () => {
    const all = (await db.parentContacts.toArray()).filter((c) => !c.deletedAt);
    const ids = new Set((students ?? []).map((st) => st.id));
    return all.filter((c) => (classId ? ids.has(c.studentId) : true)).sort((a, b) => b.date - a.date).slice(0, 30);
  }, [classId, students]);

  async function save() {
    if (!studentId || !reason.trim()) return;
    await db.parentContacts.add({ studentId, date: Date.now(), channel, reason: reason.trim(), outcome: outcome.trim() || undefined, createdAt: Date.now() });
    setReason("");
    setOutcome("");
    show(s.analytics.parents.saved);
  }

  async function del(id: number) {
    await db.parentContacts.update(id, { deletedAt: Date.now() });
    show(s.analytics.parents.deleted, { kind: "danger", undo: async () => db.parentContacts.update(id, { deletedAt: undefined }).then(() => {}) });
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-heading text-lg font-bold">{s.analytics.parents.add}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1"><span className="font-medium">{s.analytics.parents.student}</span>
            <select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))} className={selectCls}>
              <option value={0}>—</option>
              {students?.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1"><span className="font-medium">{s.analytics.parents.channel}</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as ParentContact["channel"])} className={selectCls}>
              {(["phone", "whatsapp", "inperson", "note", "other"] as const).map((c) => <option key={c} value={c}>{s.analytics.parents.channels[c]}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1"><span className="font-medium">{s.analytics.parents.reason}</span><input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={`${selectCls} w-full`} /></label>
        <label className="block space-y-1"><span className="font-medium">{s.analytics.parents.outcome}</span><input type="text" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${selectCls} w-full`} /></label>
        <button type="button" onClick={() => void save()} disabled={!studentId || !reason.trim()} className="btn-primary disabled:opacity-50">{s.common.save}</button>
      </section>

      <section className="card space-y-2">
        <h2 className="font-heading text-lg font-bold">{s.analytics.parents.title}</h2>
        {!log || log.length === 0 ? (
          <p className="text-ink-soft">{s.analytics.parents.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {log.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="rounded-pill bg-cream px-3 py-1 text-sm">{s.analytics.parents.channels[c.channel]}</span>
                <ParentName studentId={c.studentId} />
                <span className="me-auto text-ink-soft">{c.reason}{c.outcome ? ` — ${c.outcome}` : ""}</span>
                <span className="text-sm text-ink-soft">{new Date(c.date).toLocaleDateString("ar", { day: "numeric", month: "short" })}</span>
                <button type="button" onClick={() => void del(c.id!)} aria-label={s.common.delete} className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg"><Trash2 className="size-5" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ParentName({ studentId }: { studentId: number }) {
  const st = useLiveQuery(() => db.students.get(studentId), [studentId]);
  return <span className="font-medium">{st?.name ?? ""}</span>;
}

function YearsTab() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const data = useLiveQuery(async () => yearComparison());
  if (!data) return <p className="card text-ink-soft">{s.common.loading}</p>;
  return (
    <section className="card space-y-2">
      <h2 className="font-heading text-lg font-bold">{s.analytics.years.title}</h2>
      <p className="text-sm text-ink-soft">{s.analytics.years.hint}</p>
      {data.years.length <= 1 ? (
        <p className="text-ink-soft">{s.analytics.years.empty}</p>
      ) : (
        <table className="w-full border-collapse">
          <thead><tr className="border-b-2 border-line"><th className="p-2 text-start">العام</th><th className="p-2 text-center">{s.analytics.years.avg}</th><th className="p-2 text-center">{s.analytics.years.pass}</th></tr></thead>
          <tbody>
            {data.years.map((y) => (
              <tr key={y.yearName} className="border-b border-line">
                <td className="p-2 font-medium">{y.yearName}</td>
                <td className="p-2 text-center tabular-nums">{fmtNum(y.average, numerals)}٪</td>
                <td className="p-2 text-center tabular-nums">{fmtNum(y.passRate, numerals)}٪</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.years.length > 1 && (
        <div dangerouslySetInnerHTML={{ __html: barChartSvg(data.years.map((y) => ({ label: y.yearName, value: y.average })), { maxValue: 100, valueSuffix: "٪" }) }} />
      )}
    </section>
  );
}
