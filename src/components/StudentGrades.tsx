/**
 * تبويب درجات الطالبة: مكوّنات كل فصل بدرجاتها، مجموع الفصل وتقديره،
 * والدرجة النهائية للعام = (ف١×وزن١ + ف٢×وزن٢) من السياسة (§4).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { Link } from "react-router-dom";
import type { Term } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { activePolicyOf } from "@/lib/policy";
import { finalYearGrade, gradeLabel, isPassing, percentOf, termTotal } from "@/lib/grades";
import { leafComponents } from "@/lib/gradeComponents";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import EmptyState from "./EmptyState";

export default function StudentGrades({ studentId }: { studentId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);

  const data = useLiveQuery(async () => {
    const student = await db.students.get(studentId);
    if (!student) return null;
    const klass = await db.classes.get(student.classId);
    const yearId = klass?.academicYearId ?? 0;
    const policy = await activePolicyOf(yearId);
    const grades = await db.grades.where("studentId").equals(studentId).toArray();

    const terms = await Promise.all(
      ([1, 2] as Term[]).map(async (t) => {
        const comps = leafComponents(
          await db.gradeComponents.where("[academicYearId+term]").equals([yearId, t]).toArray()
        );
        const termGrades = grades.filter((g) => g.term === t);
        const total = termTotal(termGrades, comps);
        return { term: t, comps, termGrades, total };
      })
    );
    return { policy, terms };
  }, [studentId]);

  if (!data) return null;
  const { policy, terms } = data;
  const scale = policy?.gradeScale ?? DEFAULT_GRADE_SCALE;

  const anyGrades = terms.some((t) => t.total.counted > 0);
  if (!anyGrades) {
    return (
      <EmptyState
        icon={BarChart3}
        title={s.studentFile.gradesEmpty}
        hint={s.studentFile.gradesEmptyHint}
        action={
          <Link to="/grades" className="btn-primary">
            <BarChart3 className="size-5" aria-hidden />
            {s.studentFile.gradesEmptyCta}
          </Link>
        }
      />
    );
  }

  const bothComplete = terms.every((t) => t.comps.length > 0 && t.total.counted === t.comps.length);
  const yearFinal =
    bothComplete && policy
      ? finalYearGrade(
          percentOf(terms[0].total.total, terms[0].total.outOf),
          percentOf(terms[1].total.total, terms[1].total.outOf),
          policy
        )
      : null;

  return (
    <div className="space-y-4">
      {terms.map(({ term, comps, termGrades, total }) => {
        if (comps.length === 0 || total.counted === 0) return null;
        const pct = percentOf(total.total, total.outOf);
        return (
          <section key={term} className="card space-y-2">
            <h3 className="font-heading text-lg font-bold text-teal-dark">
              {s.gradebook.studentYear.term(fmtNum(term, numerals))}
            </h3>
            <ul className="divide-y divide-line">
              {comps.map((c) => {
                const live = termGrades
                  .filter((g) => !g.deletedAt && g.gradeComponentId === c.id)
                  .sort((a, b) => b.createdAt - a.createdAt);
                return (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span>{c.nameAr}</span>
                    <span className="font-bold tabular-nums">
                      {live[0] !== undefined ? fmtNum(live[0].mark, numerals) : s.gradebook.emptyCell}
                      <span className="text-sm font-normal text-ink-soft"> / {fmtNum(c.maxMark, numerals)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="flex items-center justify-between border-t-2 border-line pt-2 font-bold">
              <span>{s.gradebook.totalCol}</span>
              <span className="tabular-nums">
                {fmtNum(total.total, numerals)} / {fmtNum(total.outOf, numerals)} ·{" "}
                <span className="rounded-pill bg-teal-bg px-3 py-1 text-teal-dark">{gradeLabel(pct, scale)}</span>
              </span>
            </p>
          </section>
        );
      })}

      <section className="card space-y-2 border-2 border-maroon">
        <h3 className="font-heading text-lg font-bold text-maroon">{s.gradebook.studentYear.title}</h3>
        {yearFinal === null || !policy ? (
          <p className="text-ink-soft">{s.gradebook.studentYear.notEnough}</p>
        ) : (
          <p className="flex flex-wrap items-center justify-between gap-2 text-lg">
            <span className="font-bold tabular-nums">
              {s.gradebook.studentYear.final}: {fmtNum(Math.round(yearFinal * 10) / 10, numerals)} / 100
            </span>
            {isPassing(yearFinal, policy) ? (
              <span className="flex items-center gap-1 rounded-pill bg-teal-bg px-3 py-1 font-bold text-teal-dark">
                <CheckCircle2 className="size-5" aria-hidden />
                {s.gradebook.studentYear.pass} · {gradeLabel(yearFinal, scale)}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-pill bg-danger-bg px-3 py-1 font-bold text-danger">
                <XCircle className="size-5" aria-hidden />
                {s.gradebook.studentYear.fail}
              </span>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
