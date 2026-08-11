/**
 * ما بعد الاختبار: رصد النتائج (سؤالاً بسؤال أو إجمالاً)، التحليل
 * (معامل الصعوبة والخطأ الجماعي)، تقرير إعادة الشرح، والترحيل.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, BookOpenCheck, Send } from "lucide-react";
import { db } from "@/db";
import type { Question } from "@/db/schema";
import { analyzeExam, carryResultsToGrades, saveResult } from "@/lib/examAnalysis";
import { activeStudentsOf } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

export default function ExamResultsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const { examId: idParam } = useParams();
  const examId = Number(idParam);
  const [mode, setMode] = useState<"perQuestion" | "totalOnly">("perQuestion");
  const [tick, setTick] = useState(0);

  const data = useLiveQuery(async () => {
    const exam = await db.exams.get(examId);
    if (!exam) return null;
    const eqs = (await db.examQuestions.where("[examId+order]").between([examId, 0], [examId, Infinity]).toArray()).sort(
      (a, b) => a.order - b.order
    );
    const questions = (await Promise.all(eqs.map((eq) => db.questions.get(eq.questionId)))).filter(
      (q): q is Question => Boolean(q)
    );
    const students = exam.classId ? (await activeStudentsOf(exam.classId)).sort((a, b) => a.rollNumber - b.rollNumber) : [];
    const results = (await db.examResults.where("examId").equals(examId).toArray()).filter((r) => !r.deletedAt);
    return { exam, questions, students, results };
  }, [examId, tick]);

  const analysis = useLiveQuery(async () => (data?.results.length ? analyzeExam(examId) : undefined), [examId, tick, data?.results.length]);

  if (!data) return <p className="card text-ink-soft">{s.common.loading}</p>;
  const { exam, questions, students, results } = data;

  async function saveRow(studentId: number, scores: number[], totalOverride?: number) {
    const total = totalOverride ?? scores.reduce((a, b) => a + b, 0);
    await saveResult(examId, studentId, {
      total,
      perQuestion:
        totalOverride === undefined
          ? questions.map((q, i) => ({ questionId: q.id!, score: scores[i] ?? 0 }))
          : undefined,
    });
    show(s.exams.resultsPage.saved);
    setTick((t) => t + 1);
  }

  async function handleCarry() {
    const r = await carryResultsToGrades(exam);
    if ("error" in r) show(s.exams.resultsPage.carryNoComponent, { kind: "danger" });
    else show(s.exams.resultsPage.carried(fmtNum(r.carried, numerals)));
  }

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-maroon">{s.exams.resultsPage.title(exam.title)}</h1>

      {/* الرصد */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{s.exams.resultsPage.mode}:</span>
          {(["perQuestion", "totalOnly"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={"btn px-4 " + (mode === m ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")}
            >
              {m === "perQuestion" ? s.exams.resultsPage.perQuestion : s.exams.resultsPage.totalOnly}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-line">
                <th className="p-2 text-start">{s.students.nameLabel}</th>
                {mode === "perQuestion" &&
                  questions.map((q, i) => (
                    <th key={q.id} className="p-2 text-center">
                      {s.exams.resultsPage.q(fmtNum(i + 1, numerals))}
                      <span className="block text-xs font-normal text-ink-soft">({fmtNum(q.marks, numerals)})</span>
                    </th>
                  ))}
                <th className="p-2 text-center">{s.exams.resultsPage.total}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const existing = results.find((r) => r.studentId === st.id);
                return (
                  <ResultRow
                    key={`${st.id}-${existing?.gradedAt ?? 0}`}
                    name={st.name}
                    roll={st.rollNumber}
                    questions={questions}
                    mode={mode}
                    initialScores={questions.map((q) => existing?.perQuestion?.find((p) => p.questionId === q.id)?.score ?? 0)}
                    initialTotal={existing?.totalScore ?? 0}
                    maxTotal={exam.totalMarks}
                    onSave={(scores, total) => void saveRow(st.id!, scores, total)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* التحليل */}
      {analysis && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <BarChart3 className="size-6 text-teal-dark" aria-hidden />
            {s.exams.resultsPage.analysis} · {s.exams.resultsPage.average(fmtNum(analysis.average, numerals))}
          </h2>
          <ul className="divide-y divide-line">
            {analysis.stats.map((st, i) => (
              <li key={st.question.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-pill bg-cream font-bold tabular-nums">
                  {fmtNum(i + 1, numerals)}
                </span>
                <p className="me-auto min-w-0 flex-1 basis-64 truncate">{st.question.text}</p>
                <span className="rounded-pill bg-teal-bg px-3 py-1 text-sm text-teal-dark">
                  {s.exams.resultsPage.facility}: {fmtNum(Math.round(st.facility * 100), numerals)}٪
                </span>
                <span
                  className={
                    "rounded-pill px-3 py-1 text-sm " +
                    (st.massErrorPct > 50 ? "bg-danger-bg font-bold text-danger" : "bg-cream text-ink-soft")
                  }
                >
                  {s.exams.resultsPage.massError}: {fmtNum(st.massErrorPct, numerals)}٪
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-card border-2 border-gold bg-gold-bg p-4">
            <p className="flex items-center gap-2 font-bold text-gold-dark">
              <BookOpenCheck className="size-5" aria-hidden />
              {s.exams.resultsPage.reteach}
            </p>
            {analysis.reteach.length === 0 ? (
              <p className="mt-1 text-ink-soft">{s.exams.resultsPage.reteachNone}</p>
            ) : (
              analysis.reteach.map((r) => (
                <p key={r.lessonId} className="mt-1 text-gold-dark">
                  {s.exams.resultsPage.reteachLine(r.lessonTitle, fmtNum(r.hardQuestions, numerals), fmtNum(r.avgErrorPct, numerals))}
                </p>
              ))
            )}
          </div>

          <button type="button" onClick={() => void handleCarry()} className="btn-primary">
            <Send className="size-5" aria-hidden />
            {s.exams.resultsPage.carry}
          </button>
        </section>
      )}
    </div>
  );
}

/** صف رصد لطالبة — حفظ عند مغادرة آخر حقل أو Enter */
function ResultRow({
  name,
  roll,
  questions,
  mode,
  initialScores,
  initialTotal,
  maxTotal,
  onSave,
}: {
  name: string;
  roll: number;
  questions: Question[];
  mode: "perQuestion" | "totalOnly";
  initialScores: number[];
  initialTotal: number;
  maxTotal: number;
  onSave: (scores: number[], totalOverride?: number) => void;
}) {
  const numerals = useUi((x) => x.numeralsTable);
  const [scores, setScores] = useState(initialScores);
  const [total, setTotal] = useState(initialTotal);
  const sum = scores.reduce((a, b) => a + b, 0);

  return (
    <tr className="border-b border-line hover:bg-cream/60">
      <td className="max-w-44 truncate p-2 font-medium">
        <span className="me-2 inline-flex size-7 items-center justify-center rounded-pill bg-cream text-xs font-bold tabular-nums text-ink-soft">
          {fmtNum(roll, numerals)}
        </span>
        {name}
      </td>
      {mode === "perQuestion" &&
        questions.map((q, i) => (
          <td key={q.id} className="p-1 text-center">
            <input
              type="number"
              min={0}
              max={q.marks}
              value={scores[i] ?? 0}
              aria-label={`${name} — س${i + 1}`}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), q.marks);
                setScores((prev) => prev.map((x, xi) => (xi === i ? v : x)));
              }}
              onBlur={() => onSave(scores)}
              className="min-h-touch w-16 rounded-card border-2 border-line px-1 text-center tabular-nums focus:border-teal"
            />
          </td>
        ))}
      <td className="p-1 text-center">
        {mode === "totalOnly" ? (
          <input
            type="number"
            min={0}
            max={maxTotal}
            value={total}
            aria-label={`${name} — المجموع`}
            onChange={(e) => setTotal(Math.min(Number(e.target.value), maxTotal))}
            onBlur={() => onSave([], total)}
            className="min-h-touch w-20 rounded-card border-2 border-line px-1 text-center font-bold tabular-nums focus:border-teal"
          />
        ) : (
          <span className="text-lg font-bold tabular-nums">{fmtNum(sum, numerals)}</span>
        )}
      </td>
    </tr>
  );
}
