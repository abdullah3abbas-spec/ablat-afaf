/** قائمة الاختبارات: الحالة، فتح البناء، النتائج والتحليل، حذف بتراجع */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import type { Exam } from "@/db/schema";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

export default function ExamsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [deleting, setDeleting] = useState<Exam | null>(null);

  const exams = useLiveQuery(async () => {
    const list = (await db.exams.toArray()).filter((e) => !e.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(
      list.map(async (exam) => ({
        exam,
        klass: exam.classId ? await db.classes.get(exam.classId) : undefined,
        resultsCount: (await db.examResults.where("examId").equals(exam.id!).toArray()).filter((r) => !r.deletedAt).length,
      }))
    );
  });

  async function softDelete() {
    if (!deleting) return;
    const id = deleting.id!;
    await db.exams.update(id, { deletedAt: Date.now() });
    setDeleting(null);
    show(s.toast.done, { kind: "danger", undo: async () => db.exams.update(id, { deletedAt: undefined }).then(() => {}) });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
            <ClipboardList className="size-7" aria-hidden />
            {s.exams.title}
          </h1>
          <p className="mt-1 text-ink-soft">{s.exams.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/questions" className="btn-secondary">{s.bank.title}</Link>
          <Link to="/exams/new" className="btn-primary">
            <Plus className="size-5" aria-hidden />
            {s.exams.newExam}
          </Link>
        </div>
      </div>

      {exams === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={s.exams.empty}
          hint={s.exams.emptyHint}
          action={
            <Link to="/exams/new" className="btn-primary">
              <Plus className="size-5" aria-hidden />
              {s.exams.newExam}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {exams.map(({ exam, klass, resultsCount }) => (
            <li key={exam.id} className="card flex flex-wrap items-center gap-3">
              <span
                className={
                  "rounded-pill px-3 py-1 text-sm font-medium " +
                  (exam.status === "ready"
                    ? "bg-teal-bg text-teal-dark"
                    : exam.status === "administered"
                      ? "bg-gold-bg text-gold-dark"
                      : "bg-cream text-ink-soft")
                }
              >
                {s.exams.statuses[exam.status]}
              </span>
              <div className="me-auto">
                <p className="text-lg font-bold">{exam.title}</p>
                <p className="text-sm text-ink-soft">
                  {klass?.name ? `${klass.name} · ` : ""}
                  {fmtNum(exam.totalMarks, numerals)} درجة · {fmtNum(exam.durationMinutes, numerals)} دقيقة
                  {resultsCount > 0 ? ` · ${fmtNum(resultsCount, numerals)} نتيجة` : ""}
                </p>
              </div>
              <Link to={`/exams/${exam.id}/build`} className="btn-secondary px-4">
                <Pencil className="size-5" aria-hidden />
                {s.exams.openBuilder}
              </Link>
              <Link to={`/exams/${exam.id}/results`} className="btn bg-maroon px-4 text-white hover:bg-maroon-dark">
                <BarChart3 className="size-5" aria-hidden />
                {s.exams.results}
              </Link>
              <button
                type="button"
                onClick={() => setDeleting(exam)}
                aria-label={`${s.exams.deleteExam}: ${exam.title}`}
                className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title={s.exams.deleteExam}
          body={s.exams.confirmDelete(deleting.title)}
          confirmLabel={s.common.delete}
          onConfirm={() => void softDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
