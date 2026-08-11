/**
 * معالج بناء الاختبار — ٤ خطوات فقط (§ الأمر ٤ ثالثاً)،
 * وفي كل خطوة: مجموع الدرجات والزمن المقدّر وتحذيرات الاختلال.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileOutput, Printer, RefreshCw, Wand2 } from "lucide-react";
import { db } from "@/db";
import type { CognitiveLevel, Exam, ExamTypeDef, Question, Term, Unit } from "@/db/schema";
import { activePolicyOf } from "@/lib/policy";
import { autoPick, checkBudgets, COG_AR, COG_ORDER, defaultUnitPct } from "@/lib/examBuilder";
import { buildVariants, generateAllFiles, printExam, type ExamMeta } from "@/lib/examFiles";
import { leafComponents } from "@/lib/gradeComponents";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";

export default function ExamWizardPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const navigate = useNavigate();
  const { examId: examIdParam } = useParams();

  const [step, setStep] = useState(1);
  const [examId, setExamId] = useState<number>(Number(examIdParam) || 0);
  const [title, setTitle] = useState("");
  const [typeKey, setTypeKey] = useState("");
  const [classId, setClassId] = useState(0);
  const [unitIds, setUnitIds] = useState<number[]>([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cogPct, setCogPct] = useState<Record<CognitiveLevel, number>>({ remember: 0, understand: 0, apply: 0, higher: 0 });
  const [unitPct, setUnitPct] = useState<Record<number, number>>({});
  const [picked, setPicked] = useState<Question[]>([]);
  const [altsFor, setAltsFor] = useState<Question | null>(null);
  const [alts, setAlts] = useState<Question[]>([]);
  const [excluded, setExcluded] = useState(0);
  const [examTypes, setExamTypes] = useState<ExamTypeDef[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [classes, setClasses] = useState<{ id?: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // تحميل السياسة والوحدات والفصول + مسودة سابقة
  useEffect(() => {
    void (async () => {
      const settings = await db.settings.get(1);
      const policy = await activePolicyOf(settings?.currentAcademicYearId ?? 0);
      setExamTypes(policy?.examTypes ?? []);
      setCogPct(policy?.cognitiveDefault ?? { remember: 40, understand: 35, apply: 20, higher: 5 });
      const us = (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order);
      setUnits(us);
      setClasses((await db.classes.toArray()).filter((c) => !c.deletedAt));
      if (settings?.lastUsedClassId) setClassId(settings.lastUsedClassId);
      if (policy?.examTypes?.[0] && !typeKey) setTypeKey(policy.examTypes[0].key);

      if (examIdParam) {
        const exam = await db.exams.get(Number(examIdParam));
        if (exam) {
          setTitle(exam.title);
          setTypeKey(exam.typeKey);
          setClassId(exam.classId ?? 0);
          setUnitIds(exam.unitIds);
          setTotalMarks(exam.totalMarks);
          setDuration(exam.durationMinutes);
          setCogPct(exam.cognitiveDistribution);
          const eqs = await db.examQuestions.where("[examId+order]").between([exam.id!, 0], [exam.id!, Infinity]).toArray();
          const qs = (await Promise.all(eqs.map((eq) => db.questions.get(eq.questionId)))).filter((q): q is Question => Boolean(q));
          if (qs.length) {
            setPicked(qs);
            setStep(3);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // أوزان الوحدات الافتراضية عند تغيير الاختيار
  useEffect(() => {
    if (unitIds.length > 0) setUnitPct(defaultUnitPct(units, unitIds));
  }, [unitIds, units]);

  const budgets = useMemo(
    () => checkBudgets(picked, { totalMarks, durationMinutes: duration, cognitivePct: cogPct }),
    [picked, totalMarks, duration, cogPct]
  );

  const cogSum = COG_ORDER.reduce((sum, k) => sum + cogPct[k], 0);
  const unitSum = unitIds.reduce((sum, id) => sum + (unitPct[id] ?? 0), 0);

  async function runAutoPick() {
    setBusy(true);
    const r = await autoPick({ unitIds, totalMarks, durationMinutes: duration, cognitivePct: cogPct, unitPct });
    setPicked(r.picked);
    setExcluded(r.excludedRecentlyUsed);
    setBusy(false);
  }

  async function openAlts(q: Question) {
    const r = await autoPick({ unitIds, totalMarks, durationMinutes: duration, cognitivePct: cogPct, unitPct });
    setAltsFor(q);
    setAlts(r.alternativesFor(q).filter((a) => !picked.some((p) => p.id === a.id)));
  }

  function swap(oldQ: Question, newQ: Question) {
    setPicked((prev) => prev.map((p) => (p.id === oldQ.id ? newQ : p)));
    setAltsFor(null);
  }

  /** حفظ المسودة/الاختبار مع أسئلته */
  async function saveExam(status: Exam["status"]): Promise<number> {
    const settings = await db.settings.get(1);
    const yearId = settings?.currentAcademicYearId ?? 0;
    const term = (settings?.currentTerm ?? 1) as Term;
    const policy = await activePolicyOf(yearId);
    const typeDef = policy?.examTypes.find((t) => t.key === typeKey);
    let carryToComponentId: number | undefined;
    if (typeDef?.carryToComponentKey) {
      const comps = leafComponents(await db.gradeComponents.where("[academicYearId+term]").equals([yearId, term]).toArray());
      carryToComponentId = comps.find((c) => c.key === typeDef.carryToComponentKey)?.id;
    }
    const record: Exam = {
      title: title.trim() || `${typeDef?.nameAr ?? ""} — ${new Date().toLocaleDateString("ar")}`,
      typeKey,
      academicYearId: yearId,
      term,
      classId: classId || undefined,
      unitIds,
      totalMarks,
      durationMinutes: duration,
      cognitiveDistribution: cogPct,
      status,
      carryToComponentId,
      createdAt: Date.now(),
    };
    let id = examId;
    if (id) {
      await db.exams.update(id, { ...record, createdAt: undefined } as never);
    } else {
      id = await db.exams.add(record);
      setExamId(id);
    }
    await db.examQuestions.where("[examId+order]").between([id, 0], [id, Infinity]).delete();
    await db.examQuestions.bulkAdd(picked.map((q, i) => ({ examId: id, questionId: q.id!, order: i + 1, marks: q.marks })));
    return id;
  }

  async function handleGenerate() {
    setBusy(true);
    const id = await saveExam("ready");
    const exam = (await db.exams.get(id))!;
    const meta = await buildMeta(exam);
    await generateAllFiles(exam, picked, units, meta);
    setBusy(false);
    show(s.exams.wizard.generated);
    navigate("/exams");
  }

  async function buildMeta(exam: Exam): Promise<ExamMeta> {
    const settings = await db.settings.get(1);
    const year = await db.academicYears.get(exam.academicYearId);
    const subject = await db.subjects.toCollection().first();
    const klass = exam.classId ? await db.classes.get(exam.classId) : undefined;
    const typeDef = examTypes.find((t) => t.key === exam.typeKey);
    return {
      schoolName: settings?.schoolName ?? "",
      subjectName: subject?.nameAr ?? s.subject,
      gradeName: s.gradeLevel,
      termName: exam.term === 1 ? s.common.term1 : s.common.term2,
      yearName: year?.name ?? "",
      examTypeName: typeDef?.nameAr ?? exam.title,
      className: klass?.name,
      dateStr: new Date().toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" }),
    };
  }

  async function handlePrint(variantLabel: "أ" | "ب", withAnswers: boolean) {
    const id = await saveExam("ready");
    const exam = (await db.exams.get(id))!;
    const variants = buildVariants(id, picked);
    printExam(exam, variantLabel === "أ" ? variants.A : variants.B, await buildMeta(exam), { variantLabel, withAnswers });
  }

  const inputCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";
  const numCls = "min-h-touch w-24 rounded-card border-2 border-line px-3 text-center text-lg font-bold tabular-nums focus:border-teal";

  /** شريط الموازنات الحية — يظهر في كل الخطوات (§ نص الأمر) */
  const budgetBar = (
    <div className={"card flex flex-wrap items-center gap-4 border-2 " + (budgets.warnings.length === 0 && picked.length > 0 ? "border-teal bg-teal-bg" : "border-gold bg-gold-bg")}>
      <span className="font-bold">{s.exams.wizard.budgets.marks(fmtNum(budgets.marksSum, numerals), fmtNum(totalMarks, numerals))}</span>
      <span className="font-bold">{s.exams.wizard.budgets.time(fmtNum(budgets.minutesSum, numerals), fmtNum(duration, numerals))}</span>
      {budgets.warnings.map((w) => (
        <span key={w} className="flex items-center gap-1 text-danger">
          <AlertTriangle className="size-4" aria-hidden />
          {w}
        </span>
      ))}
      {budgets.warnings.length === 0 && picked.length > 0 && (
        <span className="flex items-center gap-1 font-bold text-teal-dark">
          <CheckCircle2 className="size-5" aria-hidden />✓
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-maroon">
        {s.exams.newExam} — {s.exams.wizard.step(fmtNum(step, numerals))}:{" "}
        {step === 1 ? s.exams.wizard.s1 : step === 2 ? s.exams.wizard.s2 : step === 3 ? s.exams.wizard.s3 : s.exams.wizard.s4}
      </h1>

      {picked.length > 0 && budgetBar}

      {step === 1 && (
        <section className="card space-y-4">
          <label className="block space-y-1">
            <span className="font-medium">{s.exams.wizard.examTitle}</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} w-full`} />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="font-medium">{s.exams.wizard.type}:</span>
              <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)} className={inputCls}>
                {examTypes.map((t) => (
                  <option key={t.key} value={t.key}>{t.nameAr}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">{s.exams.wizard.classLabel}:</span>
              <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className={inputCls}>
                <option value={0}>—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">{s.exams.wizard.totalMarks}:</span>
              <input type="number" min={1} value={totalMarks || ""} onChange={(e) => setTotalMarks(Number(e.target.value))} className={numCls} />
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">{s.exams.wizard.duration}:</span>
              <input type="number" min={5} value={duration || ""} onChange={(e) => setDuration(Number(e.target.value))} className={numCls} />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-medium">{s.exams.wizard.units}</legend>
            <div className="flex flex-wrap gap-2">
              {units.map((u) => (
                <label key={u.id} className={"btn cursor-pointer px-4 " + (unitIds.includes(u.id!) ? "bg-teal text-white" : "border-2 border-line bg-white text-ink")}>
                  <input
                    type="checkbox"
                    checked={unitIds.includes(u.id!)}
                    onChange={(e) =>
                      setUnitIds((prev) => (e.target.checked ? [...prev, u.id!] : prev.filter((x) => x !== u.id)))
                    }
                    className="sr-only"
                  />
                  {u.title}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold">{s.exams.wizard.cogDist}</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {COG_ORDER.map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <span>{COG_AR[k]}:</span>
                  <input type="number" min={0} max={100} value={cogPct[k]} onChange={(e) => setCogPct({ ...cogPct, [k]: Number(e.target.value) })} className={numCls} />
                </label>
              ))}
              <span className={"self-center font-bold " + (cogSum === 100 ? "text-teal-dark" : "text-danger")}>
                {s.exams.wizard.pctSum(fmtNum(cogSum, numerals))}
              </span>
            </div>
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold">{s.exams.wizard.unitDist}</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {unitIds.map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <span>{units.find((u) => u.id === id)?.title}:</span>
                  <input type="number" min={0} max={100} value={unitPct[id] ?? 0} onChange={(e) => setUnitPct({ ...unitPct, [id]: Number(e.target.value) })} className={numCls} />
                </label>
              ))}
              <span className={"self-center font-bold " + (unitSum === 100 ? "text-teal-dark" : "text-danger")}>
                {s.exams.wizard.pctSum(fmtNum(unitSum, numerals))}
              </span>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void runAutoPick()} disabled={busy} className="btn-primary disabled:opacity-50">
              <Wand2 className="size-5" aria-hidden />
              {busy ? s.common.loading : s.exams.wizard.autoPickBtn}
            </button>
            {excluded > 0 && <span className="rounded-pill bg-gold-bg px-3 py-1 text-gold-dark">{s.exams.wizard.excluded(fmtNum(excluded, numerals))}</span>}
          </div>
          <ol className="card divide-y divide-line p-0">
            {picked.map((q, i) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-cream font-bold tabular-nums">{fmtNum(i + 1, numerals)}</span>
                <p className="me-auto min-w-0 flex-1 basis-64 truncate">{q.text}</p>
                <span className="rounded-pill bg-cream px-2 text-sm text-ink-soft">{s.bank.cognitive[q.cognitiveLevel]}</span>
                <span className="rounded-pill bg-gold-bg px-2 text-sm text-gold-dark">{fmtNum(q.marks, numerals)}</span>
                <button type="button" onClick={() => void openAlts(q)} className="btn border-2 border-line bg-white px-3 text-ink hover:border-teal">
                  <RefreshCw className="size-4" aria-hidden />
                  {s.exams.wizard.swap}
                </button>
                <button type="button" onClick={() => setPicked((prev) => prev.filter((p) => p.id !== q.id))} className="btn border-2 border-line bg-white px-3 text-danger hover:border-danger">
                  {s.exams.wizard.remove}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3">
          <div className="card space-y-2">
            {picked.map((q, i) => (
              <p key={q.id}>
                <b>س{fmtNum(i + 1, numerals)})</b> {q.text} <span className="text-ink-soft">({fmtNum(q.marks, numerals)})</span>
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleGenerate()} disabled={busy || !budgets.marksOk} className="btn-primary min-h-[60px] text-lg disabled:opacity-50">
              <FileOutput className="size-6" aria-hidden />
              {busy ? s.common.loading : s.exams.wizard.generate}
            </button>
            <button type="button" onClick={() => void handlePrint("أ", false)} className="btn-secondary">
              <Printer className="size-5" aria-hidden />
              {s.exams.wizard.printA}
            </button>
            <button type="button" onClick={() => void handlePrint("ب", false)} className="btn-secondary">
              <Printer className="size-5" aria-hidden />
              {s.exams.wizard.printB}
            </button>
            <button type="button" onClick={() => void handlePrint("أ", true)} className="btn border-2 border-line bg-white text-ink hover:border-teal">
              {s.exams.wizard.printKeyA}
            </button>
            <button type="button" onClick={() => void handlePrint("ب", true)} className="btn border-2 border-line bg-white text-ink hover:border-teal">
              {s.exams.wizard.printKeyB}
            </button>
          </div>
        </section>
      )}

      {/* التنقّل */}
      <div className="flex justify-between">
        <button type="button" onClick={() => setStep((x) => Math.max(1, x - 1))} disabled={step === 1} className="btn border-2 border-line bg-white text-ink disabled:opacity-40">
          <ArrowRight className="size-5" aria-hidden />
          {s.exams.wizard.back}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void saveExam("draft").then(() => show(s.exams.wizard.draftSaved));
            }}
            disabled={unitIds.length === 0}
            className="btn border-2 border-line bg-white text-ink disabled:opacity-40"
          >
            {s.exams.wizard.saveDraft}
          </button>
          {step < 4 && (
            <button
              type="button"
              onClick={() => {
                if (step === 2 && picked.length === 0) void runAutoPick();
                setStep((x) => Math.min(4, x + 1));
              }}
              disabled={
                (step === 1 && (unitIds.length === 0 || !totalMarks || !duration)) ||
                (step === 2 && (cogSum !== 100 || unitSum !== 100)) ||
                (step === 3 && picked.length === 0)
              }
              className="btn-primary disabled:opacity-40"
            >
              {s.exams.wizard.next}
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {altsFor && (
        <Modal title={s.exams.wizard.swapTitle} onClose={() => setAltsFor(null)}>
          {alts.length === 0 ? (
            <p className="text-ink-soft">{s.exams.wizard.noAlts}</p>
          ) : (
            <ul className="space-y-2">
              {alts.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => swap(altsFor, a)} className="btn w-full justify-between border-2 border-line bg-white text-start text-ink hover:border-teal">
                    <span className="me-auto truncate">{a.text}</span>
                    <span className="rounded-pill bg-gold-bg px-2 text-sm text-gold-dark">{fmtNum(a.marks, numerals)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
