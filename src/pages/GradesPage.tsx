/**
 * شاشة الدرجات — المسار الأساسي هو التصوير (§0، §2-ب):
 * ١) اختاري الفصل والتقييم ← ٢) اطبعي الورقة ← ٣) صوّريها ←
 * ٤) شاشة المراجعة الإلزامية ← ٥) «اعتمدي الدرجات» (دفعة واحدة قابلة للتراجع).
 */
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BarChart3,
  Camera,
  CheckCircle2,
  History,
  Image as ImageIcon,
  Keyboard,
  Printer,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import type { GradeBatch, GradeComponent, Student, Term } from "@/db/schema";
import { ensureGradeComponents } from "@/lib/gradeComponents";
import { activeStudentsOf } from "@/lib/students";
import { buildSheetHtml, printHtml } from "@/lib/sheetPrint";
import { sheetCode } from "@/lib/sheetLayout";
import type { CellReading } from "@/lib/scanPipeline";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

type Step = "pick" | "scan" | "review";

interface ReviewRow {
  student: Student;
  value: string;
  confidence: number | null;
  cellImage?: string;
}

export default function GradesPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);

  const [step, setStep] = useState<Step>("pick");
  const [classId, setClassId] = useState<number>(0);
  const [componentId, setComponentId] = useState<number>(0);
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [warpedPreview, setWarpedPreview] = useState<string>();
  const [scanImage, setScanImage] = useState<Blob | null>(null);
  const [source, setSource] = useState<"photo" | "manual">("photo");
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  const classes = useLiveQuery(async () =>
    (await db.classes.toArray()).filter((c) => !c.deletedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  // تذكّر آخر فصل
  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  // تجسيد المكوّنات عند اختيار الفصل
  useEffect(() => {
    void (async () => {
      if (!classId) return;
      const klass = await db.classes.get(classId);
      if (!klass) return;
      const settings = await db.settings.get(1);
      const term = (settings?.currentTerm ?? 1) as Term;
      const comps = await ensureGradeComponents(klass.academicYearId, term);
      setComponents(comps);
      if (comps.length > 0 && !comps.some((c) => c.id === componentId)) {
        setComponentId(comps[0].id!);
      }
      setStudents((await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber));
    })();
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const component = components.find((c) => c.id === componentId);
  const klass = classes?.find((c) => c.id === classId);

  async function handlePrint() {
    if (!klass || !component) return;
    const settings = await db.settings.get(1);
    const subject = await db.subjects.toCollection().first();
    const html = await buildSheetHtml({
      klass,
      component,
      students,
      subjectName: subject?.nameAr ?? s.subject,
      schoolName: settings?.schoolName ?? "",
      dateMs: Date.now(),
    });
    printHtml(html);
    show(s.grades.printed);
  }

  async function handleImage(file: File | undefined) {
    if (!file || !component) return;
    setBusy(true);
    setScanError("");
    try {
      const { scanSheet } = await import("@/lib/scanPipeline");
      const result = await scanSheet(file, students.length);
      if (!result.ok) {
        setScanError(s.grades.marksNotFound);
        return;
      }
      setScanImage(file);
      setWarpedPreview(result.warpedPreview);
      setSource("photo");
      setRows(buildRows(result.readings));
      setStep("review");
    } catch {
      setScanError(s.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  function buildRows(readings: CellReading[]): ReviewRow[] {
    return students.map((student, i) => {
      const r = readings.find((x) => x.index === i);
      const max = component?.maxMark ?? 100;
      let value = "";
      let confidence: number | null = null;
      if (r && r.value !== null) {
        // رفض ما فوق العظمى: يُعرض فارغاً مع تنبيه (§2-ب)
        if (r.value > max) {
          value = "";
          confidence = -1; // إشارة «فوق الحد»
        } else {
          value = String(r.value);
          confidence = r.confidence;
        }
      }
      return { student, value, confidence, cellImage: r?.cellImage };
    });
  }

  function startManual() {
    setSource("manual");
    setScanImage(null);
    setWarpedPreview(undefined);
    setRows(students.map((student) => ({ student, value: "", confidence: null })));
    setStep("review");
  }

  async function approve() {
    if (!klass || !component) return;
    const max = component.maxMark;
    const valid = rows.filter((r) => {
      const n = Number(r.value);
      return r.value !== "" && Number.isFinite(n) && n >= 0 && n <= max;
    });
    if (valid.length === 0) return;

    setBusy(true);
    const now = Date.now();
    const settings = await db.settings.get(1);
    const term = (settings?.currentTerm ?? 1) as Term;

    await db.transaction("rw", [db.gradeBatches, db.grades], async () => {
      const batchId = await db.gradeBatches.add({
        classId: klass.id!,
        gradeComponentId: component.id!,
        academicYearId: klass.academicYearId,
        term,
        source,
        image: scanImage ?? undefined,
        sheetCode: sheetCode(klass.id!, component.id!, now),
        savedCount: valid.length,
        createdAt: now,
      });
      for (const r of valid) {
        await db.grades.add({
          studentId: r.student.id!,
          classId: klass.id!,
          academicYearId: klass.academicYearId,
          term,
          gradeComponentId: component.id!,
          mark: Number(r.value),
          source: source === "photo" ? "photo" : "manual",
          sourceImageRef: `batch:${batchId}`,
          batchId,
          createdAt: now,
        });
      }
    });

    setBusy(false);
    show(s.grades.review.approved(fmtNum(valid.length, numerals)));
    setStep("pick");
    setRows([]);
    setScanImage(null);
    setWarpedPreview(undefined);
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <BarChart3 className="size-7" aria-hidden />
          {s.grades.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.grades.subtitle}</p>
      </div>

      {step === "pick" && (
        <>
          <section className="card space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="font-medium">{s.grades.pickClass}:</span>
                <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className={selectCls}>
                  <option value={0}>—</option>
                  {classes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="font-medium">{s.grades.pickComponent}:</span>
                <select
                  value={componentId}
                  onChange={(e) => setComponentId(Number(e.target.value))}
                  className={selectCls}
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr} ({c.maxMark})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {klass && component && students.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {/* الزر الأبرز: التصوير (§2) */}
                <button
                  type="button"
                  onClick={() => setStep("scan")}
                  className="btn-primary min-h-[64px] text-xl sm:col-span-2"
                >
                  <Camera className="size-7" aria-hidden />
                  {s.grades.scanSheet}
                </button>
                <button type="button" onClick={() => void handlePrint()} className="btn-secondary min-h-[64px]">
                  <Printer className="size-6" aria-hidden />
                  {s.grades.printSheet}
                </button>
              </div>
            )}
            {klass && students.length > 0 && (
              <button type="button" onClick={startManual} className="text-teal-dark hover:underline">
                <Keyboard className="me-1 inline size-5" aria-hidden />
                {s.grades.manualEntry}
              </button>
            )}
          </section>

          <BatchHistory />

          <p className="card flex items-start gap-3 bg-teal-bg text-teal-dark">
            <ShieldCheck className="mt-1 size-6 shrink-0" aria-hidden />
            <span>{s.grades.privacyNote}</span>
          </p>
        </>
      )}

      {step === "scan" && klass && component && (
        <section className="card space-y-4 text-center">
          <p className="text-lg">{s.grades.scanHint}</p>
          {scanError && <p className="rounded-card bg-danger-bg p-3 font-medium text-danger">{scanError}</p>}
          {busy ? (
            <p className="animate-pulse text-xl font-bold text-teal-dark">{s.grades.processing}</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => cameraInput.current?.click()} className="btn-primary min-h-[64px] text-xl">
                <Camera className="size-7" aria-hidden />
                {s.grades.takePhoto}
              </button>
              <button type="button" onClick={() => uploadInput.current?.click()} className="btn-secondary min-h-[64px]">
                <ImageIcon className="size-6" aria-hidden />
                {s.grades.uploadPhoto}
              </button>
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="btn border-2 border-line bg-white text-ink"
              >
                {s.common.back}
              </button>
            </div>
          )}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label={s.grades.takePhoto}
            className="sr-only"
            onChange={(e) => void handleImage(e.target.files?.[0])}
          />
          <input
            ref={uploadInput}
            type="file"
            accept="image/*,.pdf"
            aria-label={s.grades.uploadPhoto}
            className="sr-only"
            onChange={(e) => void handleImage(e.target.files?.[0])}
          />
        </section>
      )}

      {step === "review" && component && (
        <section className="space-y-4">
          <div className="card space-y-1">
            <h2 className="font-heading text-xl font-bold">{s.grades.review.title}</h2>
            <p className="text-ink-soft">{s.grades.review.subtitle}</p>
            <p className="text-ink-soft">
              {klass?.name} · {component.nameAr} · {s.grades.maxMark}: {fmtNum(component.maxMark, numerals)}
            </p>
          </div>

          {warpedPreview && (
            <details className="card">
              <summary className="cursor-pointer font-medium text-teal-dark">{s.grades.review.original}</summary>
              <img src={warpedPreview} alt={s.grades.review.original} className="mt-3 w-full rounded-card" />
            </details>
          )}

          <ul className="card divide-y divide-line p-0">
            {rows.map((r, i) => {
              const n = Number(r.value);
              const overMax = r.value !== "" && (!Number.isFinite(n) || n > component.maxMark);
              const lowConf = r.confidence !== null && r.confidence >= 0 && r.confidence < 85 && r.value !== "";
              const wasOverOnRead = r.confidence === -1;
              return (
                <li key={r.student.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-cream text-sm font-bold tabular-nums text-ink-soft">
                    {fmtNum(r.student.rollNumber, numerals)}
                  </span>
                  <span className="me-auto min-w-40 font-medium">{r.student.name}</span>
                  {r.cellImage && (
                    <img src={r.cellImage} alt="" aria-hidden className="h-10 rounded border border-line bg-white" />
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.value}
                      aria-label={`${r.student.name} — ${s.grades.review.readValue}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, value: v, confidence: null } : x)));
                      }}
                      onKeyDown={(e) => {
                        // الكيبورد أولاً: Enter ← الطالبة التالية (§6)
                        if (e.key === "Enter") {
                          const inputs = document.querySelectorAll<HTMLInputElement>("[data-grade-input]");
                          inputs[i + 1]?.focus();
                        }
                      }}
                      data-grade-input
                      className={
                        "min-h-touch w-24 rounded-card border-2 px-3 text-center text-lg font-bold tabular-nums focus:border-teal " +
                        (overMax || wasOverOnRead
                          ? "border-danger bg-danger-bg"
                          : lowConf
                            ? "border-gold bg-gold-bg"
                            : "border-line")
                      }
                    />
                    <span className="min-w-24 text-sm">
                      {overMax || wasOverOnRead ? (
                        <span className="font-bold text-danger">
                          {s.grades.review.outOfRange(fmtNum(component.maxMark, numerals))}
                        </span>
                      ) : lowConf ? (
                        <span className="font-bold text-gold-dark">{s.grades.review.confirmHint}</span>
                      ) : r.value === "" ? (
                        <span className="text-ink-soft">{s.grades.review.emptyCell}</span>
                      ) : (
                        <CheckCircle2 className="size-5 text-ok" aria-hidden />
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("pick");
                setRows([]);
              }}
              className="btn border-2 border-line bg-white text-ink"
            >
              {s.grades.review.cancelScan}
            </button>
            <button
              type="button"
              onClick={() => void approve()}
              disabled={busy || rows.every((r) => r.value === "")}
              className="btn-primary min-h-[64px] px-8 text-xl disabled:opacity-50"
            >
              {busy ? s.common.loading : s.grades.review.approve}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** سجل عمليات الرصد — تراجع عن الدفعة كاملة خلال ٣٠ يوماً (§2-ب) */
function BatchHistory() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const batches = useLiveQuery(async () => {
    const list = (await db.gradeBatches.toArray()).filter((b) => !b.deletedAt);
    list.sort((a, b) => b.createdAt - a.createdAt);
    const enriched = await Promise.all(
      list.slice(0, 10).map(async (b) => ({
        batch: b,
        klass: await db.classes.get(b.classId),
        component: await db.gradeComponents.get(b.gradeComponentId),
      }))
    );
    return enriched;
  });

  async function undoBatch(batch: GradeBatch) {
    const now = Date.now();
    await db.transaction("rw", [db.gradeBatches, db.grades], async () => {
      await db.gradeBatches.update(batch.id!, { deletedAt: now });
      const grades = await db.grades.where("batchId").equals(batch.id!).toArray();
      for (const g of grades) {
        await db.grades.update(g.id!, { deletedAt: now });
      }
    });
    show(s.grades.history.undone, { kind: "info" });
  }

  if (!batches || batches.length === 0) return null;

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <History className="size-6 text-teal-dark" aria-hidden />
        {s.grades.history.title}
      </h2>
      <p className="text-sm text-ink-soft">{s.grades.history.undoWindow}</p>
      <ul className="divide-y divide-line">
        {batches.map(({ batch, klass, component }) => (
          <li key={batch.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="rounded-pill bg-cream px-3 py-1 text-sm">
              {batch.source === "photo" ? s.grades.history.sourcePhoto : s.grades.history.sourceManual}
            </span>
            <div className="me-auto">
              <p className="font-medium">
                {klass?.name} — {s.grades.history.batchLine(fmtNum(batch.savedCount, numerals), component?.nameAr ?? "")}
              </p>
              <p className="text-sm text-ink-soft">
                {new Date(batch.createdAt).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            {batch.image && (
              <button
                type="button"
                onClick={() => setViewingImage(URL.createObjectURL(batch.image!))}
                className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal"
              >
                <ImageIcon className="size-5" aria-hidden />
                {s.grades.history.viewImage}
              </button>
            )}
            <button
              type="button"
              onClick={() => void undoBatch(batch)}
              className="btn border-2 border-line bg-white px-4 text-danger hover:border-danger hover:bg-danger-bg"
            >
              <RotateCcw className="size-5" aria-hidden />
              {s.grades.history.undo}
            </button>
          </li>
        ))}
      </ul>
      {viewingImage && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            URL.revokeObjectURL(viewingImage);
            setViewingImage(null);
          }}
        >
          <img src={viewingImage} alt={s.grades.history.viewImage} className="max-h-[85dvh] max-w-full rounded-card" />
        </div>
      )}
    </section>
  );
}
