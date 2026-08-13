/**
 * التقارير: بطاقة ولية الأمر (فردي/جماعي)، تقرير الإدارة، كشف
 * الدرجات الرسمي Excel بترتيب معتمد، وتقرير تحليل اختبار.
 */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowUp, BarChart3, FileBarChart, FileSpreadsheet, Printer, Users } from "lucide-react";
import { db } from "@/db";
import type { Term } from "@/db/schema";
import { classAdminReport, orderColumns, studentReport, type StudentReport } from "@/lib/reportData";
import { adminReportHtml, examAnalysisHtml, parentCardHtml, printDoc } from "@/lib/reportPrint";
import { exportOfficialSheet } from "@/lib/officialExport";
import { analyzeExam } from "@/lib/examAnalysis";
import { activeStudentsOf } from "@/lib/students";
import { leafComponents } from "@/lib/gradeComponents";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import WeeklyMessageCard from "@/components/WeeklyMessageCard";

export default function ReportsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);

  const [classId, setClassId] = useState(0);
  const [studentId, setStudentId] = useState(0);
  const [examId, setExamId] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const students = useLiveQuery(
    async () => (classId ? (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber) : []),
    [classId]
  );
  const exams = useLiveQuery(async () => (await db.exams.toArray()).filter((e) => !e.deletedAt));

  async function term(): Promise<Term> {
    return ((await db.settings.get(1))?.currentTerm ?? 1) as Term;
  }
  async function schoolName(): Promise<string> {
    return (await db.settings.get(1))?.schoolName ?? "";
  }

  async function printParentCards(all: boolean) {
    setBusy(true);
    const t = await term();
    const ids = all ? (students ?? []).map((st) => st.id!) : studentId ? [studentId] : [];
    const reports = (await Promise.all(ids.map((id) => studentReport(id, t)))).filter(
      (r): r is StudentReport => Boolean(r)
    );
    setBusy(false);
    if (reports.length === 0) return;
    printDoc(parentCardHtml(reports, await schoolName(), t === 1 ? s.common.term1 : s.common.term2));
    show(s.reports.printedCards(fmtNum(reports.length, numerals)));
  }

  async function printAdmin() {
    setBusy(true);
    const t = await term();
    const reports = [];
    for (const c of classes ?? []) {
      const r = await classAdminReport(c.id!, t);
      if (r) reports.push(r);
    }
    setBusy(false);
    printDoc(adminReportHtml(reports, await schoolName(), t === 1 ? s.common.term1 : s.common.term2));
  }

  async function exportOfficial() {
    if (!classId) return;
    setBusy(true);
    const r = await exportOfficialSheet(classId, await term());
    setBusy(false);
    if (r.ok) show(s.reports.exported);
  }

  async function printExamAnalysis() {
    if (!examId) return;
    const analysis = await analyzeExam(examId);
    if (analysis.resultsCount === 0) {
      show(s.reports.noResults, { kind: "danger" });
      return;
    }
    const exam = await db.exams.get(examId);
    printDoc(examAnalysisHtml(exam?.title ?? "", analysis, await schoolName()));
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <FileBarChart className="size-7" aria-hidden />
          {s.reports.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.reports.subtitle}</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">{s.grades.pickClass}:</span>
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className={selectCls}>
            <option value={0}>—</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* بطاقة ولية الأمر */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Users className="size-6 text-teal-dark" aria-hidden />
          {s.reports.parentCard}
        </h2>
        <p className="text-sm text-ink-soft">{s.reports.parentCardHint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))} aria-label={s.reports.oneStudent} className={selectCls}>
            <option value={0}>—</option>
            {students?.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => void printParentCards(false)} disabled={busy || !studentId} className="btn-primary disabled:opacity-50">
            <Printer className="size-5" aria-hidden />
            {s.reports.oneStudent}
          </button>
          <button type="button" onClick={() => void printParentCards(true)} disabled={busy || !classId} className="btn-secondary disabled:opacity-50">
            <Printer className="size-5" aria-hidden />
            {s.reports.wholeClassCards}
          </button>
        </div>
      </section>

      {/* الرسمية */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <FileSpreadsheet className="size-6 text-teal-dark" aria-hidden />
            {s.reports.officialSheet}
          </h2>
          <p className="text-sm text-ink-soft">{s.reports.officialHint}</p>
          <button type="button" onClick={() => void exportOfficial()} disabled={busy || !classId} className="btn-primary disabled:opacity-50">
            {s.reports.exportOfficial}
          </button>
          <ColumnsEditor />
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <BarChart3 className="size-6 text-maroon" aria-hidden />
              {s.reports.adminReport}
            </h2>
            <p className="text-sm text-ink-soft">{s.reports.adminReportHint}</p>
            <button type="button" onClick={() => void printAdmin()} disabled={busy} className="btn-primary disabled:opacity-50">
              <Printer className="size-5" aria-hidden />
              {s.reports.printAdmin}
            </button>
          </div>
          <div className="card space-y-3">
            <h2 className="font-heading text-xl font-bold">{s.reports.examAnalysis}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <select value={examId} onChange={(e) => setExamId(Number(e.target.value))} aria-label={s.reports.pickExam} className={selectCls}>
                <option value={0}>—</option>
                {exams?.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <button type="button" onClick={() => void printExamAnalysis()} disabled={!examId} className="btn-secondary disabled:opacity-50">
                <Printer className="size-5" aria-hidden />
                {s.reports.printAnalysis}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* الرسالة الأسبوعية لأولياء الأمور — انتقلت من الرئيسية إلى موضعها (زكريت م١) */}
      <WeeklyMessageCard />
    </div>
  );
}

/** محرّر ترتيب أعمدة الكشف الرسمي — يُحفظ في الإعدادات ويُعاد استخدامه */
function ColumnsEditor() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [keys, setKeys] = useState<string[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void (async () => {
      const settings = await db.settings.get(1);
      const yearId = settings?.currentAcademicYearId ?? 0;
      const t = (settings?.currentTerm ?? 1) as Term;
      const comps = leafComponents(
        await db.gradeComponents.where("[academicYearId+term]").equals([yearId, t]).toArray()
      );
      const available = ["roll", "name", ...comps.map((c) => `comp:${c.key}`), "total", "label"];
      const nameMap = new Map<string, string>([
        ["roll", "الرقم في الكشف"],
        ["name", "اسم الطالبة"],
        ["total", "المجموع"],
        ["label", "التقدير"],
        ...comps.map((c): [string, string] => [`comp:${c.key}`, c.nameAr]),
      ]);
      setNames(nameMap);
      setKeys(orderColumns(available, settings?.officialExportColumns));
    })();
  }, []);

  async function move(index: number, dir: -1 | 1) {
    const next = [...keys];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setKeys(next);
    await db.settings.update(1, { officialExportColumns: next });
    show(s.reports.columnsSaved);
  }

  return (
    <details>
      <summary className="cursor-pointer font-medium text-teal-dark">{s.reports.columnsTitle}</summary>
      <p className="mt-1 text-sm text-ink-soft">{s.reports.columnsHint}</p>
      <ol className="mt-2 space-y-1">
        {keys.map((k, i) => (
          <li key={k} className="flex items-center gap-2 rounded-card border border-line px-3 py-1">
            <span className="me-auto">{names.get(k) ?? k}</span>
            <button type="button" onClick={() => void move(i, -1)} aria-label={`${s.reports.moveUp}: ${names.get(k)}`} className="flex min-h-touch min-w-touch items-center justify-center rounded-card hover:bg-cream">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => void move(i, 1)} aria-label={`${s.reports.moveDown}: ${names.get(k)}`} className="flex min-h-touch min-w-touch items-center justify-center rounded-card hover:bg-cream">
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
