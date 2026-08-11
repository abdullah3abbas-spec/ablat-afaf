/**
 * شاشة «الإعدادات ← سياسة التقييم» (§4):
 * مكوّنات قابلة للإضافة والحذف وإعادة التسمية وتغيير الدرجة،
 * وزنا الفصلين، شرائح التقدير — وتحذير أحمر إن لم يكن المجموع 100.
 * الحفظ ينشئ نسخة جديدة تلقائياً إن وُجدت درجات مرصودة.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Scale, Trash2 } from "lucide-react";
import { db } from "@/db";
import type { GradeScaleBand, PolicyComponent, Term } from "@/db/schema";
import { activePolicyOf, savePolicy } from "@/lib/policy";
import { validatePolicy } from "@/lib/grades";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function PolicyPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [yearId, setYearId] = useState<number>(0);
  const [components, setComponents] = useState<PolicyComponent[]>([]);
  const [weights, setWeights] = useState({ term1: 0, term2: 0 });
  const [passGrade, setPassGrade] = useState(0);
  const [maxGrade, setMaxGrade] = useState(100);
  const [scale, setScale] = useState<GradeScaleBand[]>([]);
  const [deleting, setDeleting] = useState<PolicyComponent | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const settings = await db.settings.get(1);
      const yid = settings?.currentAcademicYearId ?? 0;
      setYearId(yid);
      const policy = await activePolicyOf(yid);
      if (policy) {
        setComponents(policy.components.map((c) => ({ ...c })));
        setWeights({ ...policy.termWeights });
        setPassGrade(policy.passGrade);
        setMaxGrade(policy.maxGrade);
        setScale((policy.gradeScale ?? []).map((b) => ({ ...b })));
      }
      setLoaded(true);
    })();
  }, []);

  const check = validatePolicy({ components, maxGrade, termWeights: weights });
  const courseworkIssue = check.parentMismatches.find((m) => m.parentKey === "coursework");

  function upd(i: number, patch: Partial<PolicyComponent>) {
    setComponents((prev) => prev.map((c, ci) => (ci === i ? { ...c, ...patch } : c)));
  }

  function addComponent() {
    const key = `custom_${Date.now()}`;
    setComponents((prev) => [
      ...prev,
      { key, nameAr: "", max: 0, order: prev.length + 1 },
    ]);
  }

  function removeComponent() {
    if (!deleting) return;
    setComponents((prev) => prev.filter((c) => c.key !== deleting.key && c.parentKey !== deleting.key));
    setDeleting(null);
  }

  async function handleSave() {
    if (!check.ok || !yearId) return;
    setBusy(true);
    const settings = await db.settings.get(1);
    const openTerm = (settings?.currentTerm ?? 1) as Term;
    const result = await savePolicy(
      yearId,
      { components, termWeights: weights, maxGrade, passGrade, gradeScale: scale },
      openTerm
    );
    setBusy(false);
    show(result.newVersion ? s.policy.savedNewVersion(fmtNum(result.version, numerals)) : s.policy.savedInPlace);
  }

  if (!loaded) return <p className="card text-ink-soft">{s.common.loading}</p>;

  const numCls =
    "min-h-touch w-24 rounded-card border-2 border-line px-3 text-center text-lg font-bold tabular-nums focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Scale className="size-7" aria-hidden />
          {s.policy.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.policy.subtitle}</p>
      </div>

      {/* التحذير الأحمر / التأكيد الأخضر */}
      <div
        role="status"
        className={
          "card flex items-start gap-3 border-2 " +
          (check.ok ? "border-teal bg-teal-bg text-teal-dark" : "border-danger bg-danger-bg text-danger")
        }
      >
        {check.ok ? (
          <CheckCircle2 className="mt-1 size-6 shrink-0" aria-hidden />
        ) : (
          <AlertTriangle className="mt-1 size-6 shrink-0" aria-hidden />
        )}
        <div className="space-y-1 font-medium">
          <p>{check.topSum === maxGrade ? s.policy.sumOk(fmtNum(check.topSum, numerals)) : s.policy.sumBad(fmtNum(check.topSum, numerals))}</p>
          {courseworkIssue && (
            <p>{s.policy.coursworkBad(fmtNum(courseworkIssue.expected, numerals), fmtNum(courseworkIssue.actual, numerals))}</p>
          )}
          {check.weightsSum !== 100 && <p>{s.policy.weightsBad(fmtNum(check.weightsSum, numerals))}</p>}
        </div>
      </div>

      {/* المكوّنات */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold">{s.policy.components}</h2>
          <button type="button" onClick={addComponent} className="btn-secondary px-4">
            <Plus className="size-5" aria-hidden />
            {s.policy.addComponent}
          </button>
        </div>
        <ul className="space-y-2">
          {components.map((c, i) => (
            <li
              key={c.key}
              className={
                "flex flex-wrap items-center gap-3 rounded-card border border-line p-3 " +
                (c.parentKey ? "ms-8 bg-cream" : "bg-white")
              }
            >
              <input
                type="text"
                value={c.nameAr}
                aria-label={s.policy.componentName}
                placeholder={s.policy.componentName}
                onChange={(e) => upd(i, { nameAr: e.target.value })}
                className="min-h-touch flex-1 rounded-card border-2 border-line px-3 focus:border-teal"
              />
              <label className="flex items-center gap-2">
                <span className="text-ink-soft">{s.policy.componentMax}:</span>
                <input
                  type="number"
                  value={c.max}
                  min={0}
                  aria-label={`${c.nameAr} — ${s.policy.componentMax}`}
                  onChange={(e) => upd(i, { max: Number(e.target.value) })}
                  className={numCls}
                />
              </label>
              {c.parentKey && <span className="rounded-pill bg-gold-bg px-2 text-sm text-gold-dark">{s.policy.childOf}</span>}
              <button
                type="button"
                onClick={() => setDeleting(c)}
                aria-label={`${s.policy.deleteComponent}: ${c.nameAr}`}
                className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* الأوزان وحد النجاح */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.policy.termWeights}</h2>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2">
            <span>{s.policy.term1Weight}</span>
            <input type="number" value={weights.term1} min={0} max={100} onChange={(e) => setWeights((w) => ({ ...w, term1: Number(e.target.value) }))} className={numCls} />
          </label>
          <label className="flex items-center gap-2">
            <span>{s.policy.term2Weight}</span>
            <input type="number" value={weights.term2} min={0} max={100} onChange={(e) => setWeights((w) => ({ ...w, term2: Number(e.target.value) }))} className={numCls} />
          </label>
          <label className="flex items-center gap-2">
            <span>{s.policy.passGrade}</span>
            <input type="number" value={passGrade} min={0} max={100} onChange={(e) => setPassGrade(Number(e.target.value))} className={numCls} />
          </label>
        </div>
      </section>

      {/* شرائح التقدير */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.policy.gradeScaleTitle}</h2>
        <p className="text-sm text-ink-soft">{s.policy.gradeScaleHint}</p>
        <ul className="flex flex-wrap gap-3">
          {scale
            .slice()
            .sort((a, b) => b.min - a.min)
            .map((b) => (
              <li key={b.label + b.min} className="flex items-center gap-2 rounded-card border border-line p-2">
                <input
                  type="number"
                  value={b.min}
                  min={0}
                  max={100}
                  aria-label={`${b.label} — ${s.policy.bandMin}`}
                  onChange={(e) =>
                    setScale((prev) => prev.map((x) => (x === b ? { ...x, min: Number(e.target.value) } : x)))
                  }
                  className="min-h-touch w-20 rounded-card border-2 border-line px-2 text-center tabular-nums focus:border-teal"
                />
                <input
                  type="text"
                  value={b.label}
                  aria-label={s.policy.bandLabel}
                  onChange={(e) =>
                    setScale((prev) => prev.map((x) => (x === b ? { ...x, label: e.target.value } : x)))
                  }
                  className="min-h-touch w-28 rounded-card border-2 border-line px-2 focus:border-teal"
                />
              </li>
            ))}
        </ul>
      </section>

      <p className="card bg-gold-bg text-gold-dark">{s.policy.augustNote}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!check.ok || busy}
          className="btn-primary min-h-[56px] px-8 text-lg disabled:opacity-50"
        >
          {busy ? s.common.loading : s.policy.save}
        </button>
      </div>

      {deleting && (
        <ConfirmDialog
          title={s.policy.confirmDeleteTitle}
          body={s.policy.confirmDeleteBody(deleting.nameAr)}
          confirmLabel={s.policy.deleteComponent}
          onConfirm={removeComponent}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
