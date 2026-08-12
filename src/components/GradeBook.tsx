/**
 * سجل درجات الفصل: صفوف الطالبات × المكوّنات الورقية + عمودا
 * المجموع والتقدير المحسوبان تلقائياً.
 * التعديل هنا استثناء لتصحيح درجة واحدة (§2 الأمر ٢) — حفظ تلقائي فوري
 * مع «تم الحفظ ✓»، ورفض ما فوق حد المكوّن برسالة عربية واضحة.
 */
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, Table2 } from "lucide-react";
import { db } from "@/db";
import type { GradeComponent, Term } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { activePolicyOf } from "@/lib/policy";
import { gradeLabel, percentOf, termTotal } from "@/lib/grades";
import { activeStudentsOf } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

interface GradeBookProps {
  classId: number;
  components: GradeComponent[];
  term: Term;
}

export default function GradeBook({ classId, components, term }: GradeBookProps) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [editing, setEditing] = useState<{ studentId: number; componentId: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const data = useLiveQuery(async () => {
    const students = (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber);
    const settings = await db.settings.get(1);
    const policy = await activePolicyOf(settings?.currentAcademicYearId ?? 0);
    const rows = await Promise.all(
      students.map(async (st) => {
        const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter(
          (g) => g.term === term
        );
        const cells = new Map<number, number | undefined>();
        for (const comp of components) {
          const live = grades
            .filter((g) => !g.deletedAt && g.gradeComponentId === comp.id)
            .sort((a, b) => b.createdAt - a.createdAt);
          cells.set(comp.id!, live[0]?.mark);
        }
        const t = termTotal(grades, components);
        return { student: st, cells, total: t };
      })
    );
    return { rows, scale: policy?.gradeScale ?? DEFAULT_GRADE_SCALE };
  }, [classId, components.map((c) => c.id).join(","), term]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!data || components.length === 0) return null;

  async function saveCell(studentId: number, comp: GradeComponent, raw: string, moveNext: boolean) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setEditing(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > comp.maxMark) {
      show(s.errors.gradeOutOfRange(comp.maxMark), { kind: "danger" });
      return;
    }
    const settings = await db.settings.get(1);
    const klass = await db.classes.get(classId);
    await db.grades.add({
      studentId,
      classId,
      academicYearId: klass?.academicYearId ?? settings?.currentAcademicYearId ?? 0,
      term,
      gradeComponentId: comp.id!,
      mark: n,
      source: "manual",
      createdAt: Date.now(),
    });
    setSavedFlash(`${studentId}:${comp.id}`);
    setTimeout(() => setSavedFlash(null), 2000);

    if (moveNext) {
      const idx = data!.rows.findIndex((r) => r.student.id === studentId);
      const next = data!.rows[idx + 1];
      if (next) {
        setEditing({ studentId: next.student.id!, componentId: comp.id! });
        const current = next.cells.get(comp.id!);
        setEditValue(current !== undefined ? String(current) : "");
        return;
      }
    }
    setEditing(null);
  }

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <Table2 className="size-6 text-teal-dark" aria-hidden />
        {s.gradebook.title}
      </h2>
      <p className="text-sm text-ink-soft">
        {s.gradebook.subtitle} · {s.gradebook.keyboardHint}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-start">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="p-2 text-start">{s.students.nameLabel}</th>
              {components.map((c) => (
                <th key={c.id} className="p-2 text-center">
                  {c.nameAr}
                  <span className="block text-xs font-normal text-ink-soft">({fmtNum(c.maxMark, numerals)})</span>
                </th>
              ))}
              <th className="p-2 text-center">{s.gradebook.totalCol}</th>
              <th className="p-2 text-center">{s.gradebook.gradeCol}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(({ student, cells, total }) => {
              // التقدير على المرصود فقط — عادل قبل اكتمال المكوّنات
              const pct = percentOf(total.total, total.countedOutOf);
              const complete = total.counted === components.length;
              return (
                <tr key={student.id} className="border-b border-line hover:bg-cream/60">
                  <td className="max-w-44 truncate p-2 font-medium">
                    <span className="me-2 inline-flex size-7 items-center justify-center rounded-pill bg-cream text-xs font-bold tabular-nums text-ink-soft">
                      {fmtNum(student.rollNumber, numerals)}
                    </span>
                    {student.name}
                  </td>
                  {components.map((comp) => {
                    const val = cells.get(comp.id!);
                    const isEditing = editing?.studentId === student.id && editing?.componentId === comp.id;
                    const flash = savedFlash === `${student.id}:${comp.id}`;
                    return (
                      <td key={comp.id} className="p-1 text-center">
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            aria-label={`${student.name} — ${comp.nameAr}`}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveCell(student.id!, comp, editValue, true);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            onBlur={() => void saveCell(student.id!, comp, editValue, false)}
                            className="min-h-touch w-20 rounded-card border-2 border-teal px-2 text-center text-lg font-bold tabular-nums outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing({ studentId: student.id!, componentId: comp.id! });
                              setEditValue(val !== undefined ? String(val) : "");
                            }}
                            aria-label={`${student.name} — ${comp.nameAr}: ${val ?? s.gradebook.emptyCell}`}
                            className="min-h-touch w-20 rounded-card border-2 border-transparent text-lg tabular-nums hover:border-teal"
                          >
                            {flash ? (
                              <CheckCircle2 className="mx-auto size-5 text-ok" aria-hidden />
                            ) : val !== undefined ? (
                              fmtNum(val, numerals)
                            ) : (
                              <span className="text-ink-soft">{s.gradebook.emptyCell}</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center">
                    <span className="text-lg font-bold tabular-nums">{fmtNum(total.total, numerals)}</span>
                    {!complete && total.counted > 0 && (
                      <span className="block text-xs text-gold-dark">
                        {s.gradebook.partial(fmtNum(total.counted, numerals), fmtNum(components.length, numerals))}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {total.counted > 0 ? (
                      <span className="rounded-pill bg-teal-bg px-3 py-1 font-medium text-teal-dark">
                        {gradeLabel(pct, data.scale)}
                      </span>
                    ) : (
                      <span className="text-ink-soft">{s.gradebook.emptyCell}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
