/**
 * شاشة الحضور اليومية: الفصل كله أمام المعلّمة، نقرة على الطالبة
 * تبدّل حالتها (حاضرة ← غائبة ← متأخّرة ← بعذر)، مع «الكل حاضرات»،
 * واحتساب أسبوع الحضور، وتقرير شهري مطبوع، وتنبيه تكرار الغياب.
 */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileText, ShieldQuestion, Sparkles, XCircle } from "lucide-react";
import { db } from "@/db";
import type { AttendanceStatus } from "@/db/schema";
import { activeStudentsOf } from "@/lib/students";
import { awardFullWeek, monthKeyOf } from "@/lib/points";
import { printHtml } from "@/lib/sheetPrint";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

const CYCLE: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function statusIcon(status: AttendanceStatus) {
  switch (status) {
    case "present":
      return CheckCircle2;
    case "absent":
      return XCircle;
    case "late":
      return Clock;
    case "excused":
      return ShieldQuestion;
  }
}

function statusCls(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "border-teal bg-teal-bg text-teal-dark";
    case "absent":
      return "border-danger bg-danger-bg text-danger";
    case "late":
      return "border-gold bg-gold-bg text-gold-dark";
    case "excused":
      return "border-line bg-cream text-ink-soft";
  }
}

/** منتصف ليل اليوم محلياً */
function todayMidnight(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export default function AttendancePage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const setCurrentClass = useUi((x) => x.setCurrentClass);
  const show = useToast((x) => x.show);

  const [classId, setClassId] = useState(0);
  const [date] = useState(todayMidnight());

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  const classes = useLiveQuery(async () =>
    (await db.classes.toArray()).filter((c) => !c.deletedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  const roster = useLiveQuery(async () => {
    if (!classId) return [];
    setCurrentClass(classId);
    const students = (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber);
    return Promise.all(
      students.map(async (student) => {
        const rec = (
          await db.attendance.where("[studentId+date]").equals([student.id!, date]).toArray()
        ).find((a) => !a.deletedAt);
        return { student, status: (rec?.status ?? "present") as AttendanceStatus, recId: rec?.id };
      })
    );
  }, [classId, date]);

  /** تنبيه تكرار الغياب هذا الشهر (العتبة بيانات من الإعدادات) */
  const absenceAlerts = useLiveQuery(async () => {
    if (!classId) return [];
    const settings = await db.settings.get(1);
    const threshold = settings?.absenceAlertThreshold ?? 4;
    const mk = monthKeyOf(date);
    const students = await activeStudentsOf(classId);
    const out: { name: string; count: number }[] = [];
    for (const st of students) {
      const days = (await db.attendance.where("studentId").equals(st.id!).toArray()).filter(
        (a) => !a.deletedAt && a.status === "absent" && monthKeyOf(a.date) === mk
      );
      if (days.length >= threshold) out.push({ name: st.name, count: days.length });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [classId, date]);

  async function setStatus(studentId: number, recId: number | undefined, status: AttendanceStatus) {
    if (recId) {
      await db.attendance.update(recId, { status, updatedAt: Date.now() });
    } else {
      await db.attendance.add({ studentId, classId, date, status, createdAt: Date.now() });
    }
  }

  async function cycle(studentId: number, recId: number | undefined, current: AttendanceStatus) {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    await setStatus(studentId, recId, next);
  }

  async function markAllPresent() {
    if (!roster) return;
    for (const r of roster) await setStatus(r.student.id!, r.recId, "present");
    show(s.attendance.allPresentDone);
  }

  async function handleWeekAward() {
    const r = await awardFullWeek(classId, date);
    show(r.awarded > 0 ? s.attendance.weekAwardDone(fmtNum(r.awarded, numerals)) : s.attendance.weekAwardNone, {
      kind: r.awarded > 0 ? "success" : "info",
    });
  }

  async function printMonthReport() {
    const klass = classes?.find((c) => c.id === classId);
    if (!klass) return;
    const mk = monthKeyOf(date);
    const students = (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber);
    const rows = await Promise.all(
      students.map(async (st) => {
        const days = (await db.attendance.where("studentId").equals(st.id!).toArray()).filter(
          (a) => !a.deletedAt && monthKeyOf(a.date) === mk
        );
        const count = (x: AttendanceStatus) => days.filter((a) => a.status === x).length;
        return { name: st.name, roll: st.rollNumber, present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused") };
      })
    );
    const monthName = new Date(date).toLocaleDateString("ar", { month: "long", year: "numeric" });
    const settings = await db.settings.get(1);
    const body = `
      <div class="doc-header"><h1>${settings?.schoolName ?? ""} — ${s.attendance.monthReport}</h1>
      <div class="meta">الفصل: ${klass.name} · الشهر: ${monthName}</div></div>
      <table><tr><th class="c">م</th><th>اسم الطالبة</th><th class="c">حضور</th><th class="c">غياب</th><th class="c">تأخّر</th><th class="c">بعذر</th></tr>
      ${rows.map((r) => `<tr><td class="c">${r.roll}</td><td>${r.name}</td><td class="c">${r.present}</td><td class="c">${r.absent}</td><td class="c">${r.late}</td><td class="c">${r.excused}</td></tr>`).join("")}
      </table>`;
    printHtml(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${s.attendance.monthReport}</title>
      <style>@page{size:A4;margin:14mm}body{font-family:Tajawal,sans-serif;font-size:12pt}
      .doc-header{text-align:center;border-bottom:.5mm solid #8A1538;padding-bottom:3mm;margin-bottom:5mm}
      .doc-header h1{font-size:15pt;color:#8A1538;margin:0}.meta{font-size:10.5pt;color:#333}
      table{width:100%;border-collapse:collapse}th,td{border:.3mm solid #333;padding:1.5mm 2.5mm;text-align:right}
      th{background:#F5EFE4}.c{text-align:center}</style></head><body>${body}</body></html>`);
    show(s.attendance.monthReportPrinted);
  }

  const dateStr = new Date(date).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <CalendarCheck className="size-7" aria-hidden />
          {s.attendance.title}
        </h1>
        <p className="mt-1 text-ink-soft">
          {s.attendance.subtitle} · {s.attendance.date}: {dateStr}
        </p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">{s.grades.pickClass}:</span>
          <select
            value={classId}
            onChange={(e) => setClassId(Number(e.target.value))}
            className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal"
          >
            <option value={0}>—</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void markAllPresent()} disabled={!roster?.length} className="btn-primary disabled:opacity-50">
          <CheckCircle2 className="size-5" aria-hidden />
          {s.attendance.allPresent}
        </button>
        <button type="button" onClick={() => void handleWeekAward()} disabled={!classId} className="btn-secondary disabled:opacity-50">
          <Sparkles className="size-5" aria-hidden />
          {s.attendance.weekAward}
        </button>
        <button
          type="button"
          onClick={() => void printMonthReport()}
          disabled={!classId}
          className="btn border-2 border-line bg-white text-ink hover:border-teal disabled:opacity-50"
        >
          <FileText className="size-5" aria-hidden />
          {s.attendance.monthReport}
        </button>
      </div>

      {absenceAlerts && absenceAlerts.length > 0 && (
        <div className="card space-y-1 border-2 border-gold bg-gold-bg">
          <p className="flex items-center gap-2 font-bold text-gold-dark">
            <AlertTriangle className="size-5" aria-hidden />
            {s.attendance.absenceAlertTitle}
          </p>
          {absenceAlerts.map((a) => (
            <p key={a.name} className="text-gold-dark">
              {s.attendance.absenceAlertLine(a.name, fmtNum(a.count, numerals))}
            </p>
          ))}
        </div>
      )}

      <p className="text-sm text-ink-soft">{s.attendance.cycleHint}</p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roster?.map(({ student, status, recId }) => {
          const Icon = statusIcon(status);
          return (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => void cycle(student.id!, recId, status)}
                aria-label={`${student.name}: ${s.attendance.statuses[status]}`}
                className={`flex min-h-[60px] w-full items-center gap-3 rounded-card border-2 px-4 font-medium transition-colors ${statusCls(status)}`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-white/70 text-sm font-bold tabular-nums">
                  {fmtNum(student.rollNumber, numerals)}
                </span>
                <span className="me-auto truncate text-start">{student.name}</span>
                <Icon className="size-6 shrink-0" aria-hidden />
                <span className="min-w-16 text-sm">{s.attendance.statuses[status]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
