/** التحضير اليومي: نموذج المدرسة، تعبئة من الحزمة، حفظ لإعادة الاستخدام، Word */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileDown, Save, Sparkles } from "lucide-react";
import { db } from "@/db";
import { kitByLessonTitle } from "@/content/lessonKits";
import { downloadPlanWord, PLAN_FIELDS } from "@/lib/planFiles";
import { useStrings } from "@/hooks/useStrings";
import { useToast } from "@/store/toast";

export default function PlanningPanel() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [lessonId, setLessonId] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});

  const lessons = useLiveQuery(async () => {
    const units = new Map((await db.units.toArray()).map((u) => [u.id!, u.title]));
    return (await db.lessons.toArray())
      .filter((l) => !l.deletedAt)
      .sort((a, b) => a.unitId - b.unitId || a.order - b.order)
      .map((l) => ({ ...l, unitTitle: units.get(l.unitId) ?? "" }));
  });
  const savedPlans = useLiveQuery(async () => (await db.lessonPlans.toArray()).filter((p) => !p.deletedAt).sort((a, b) => b.createdAt - a.createdAt));

  // حمّل خطة محفوظة إن وُجدت للدرس
  useEffect(() => {
    void (async () => {
      if (!lessonId) { setFields({}); return; }
      const existing = (await db.lessonPlans.where("lessonId").equals(lessonId).toArray()).filter((p) => !p.deletedAt)[0];
      setFields(existing?.fields ?? {});
    })();
  }, [lessonId]);

  const lesson = lessons?.find((l) => l.id === lessonId);

  function prefillFromKit() {
    if (!lesson) return;
    const kit = kitByLessonTitle(lesson.title);
    if (!kit) return;
    const p = kit.plan;
    setFields({
      objectives: p.objectives.map((x) => `• ${x}`).join("\n"),
      standards: (lesson.standards ?? []).join("\n"),
      warmup: p.warmup,
      strategies: p.strategies.map((x) => `• ${x}`).join("\n"),
      activities: p.activities.map((x) => `• ${x}`).join("\n"),
      materials: p.materials.map((x) => `• ${x}`).join("\n"),
      assessment: p.assessment,
      homework: p.homework,
      differentiation: p.differentiation,
    });
    show(s.planning.prefilled);
  }

  async function save() {
    if (!lesson) return;
    const existing = (await db.lessonPlans.where("lessonId").equals(lessonId).toArray()).filter((p) => !p.deletedAt)[0];
    const settings = await db.settings.get(1);
    if (existing) {
      await db.lessonPlans.update(existing.id!, { fields, updatedAt: Date.now() });
    } else {
      await db.lessonPlans.add({
        title: `تحضير ${lesson.title}`,
        lessonId,
        unitId: lesson.unitId,
        academicYearId: settings?.currentAcademicYearId,
        currentVersion: 1,
        versions: [{ version: 1, createdAt: Date.now(), path: `تحضير-${lesson.title}.docx`, editSummary: "النسخة الأولى" }],
        fields,
        createdAt: Date.now(),
      });
    }
    show(s.planning.saved);
  }

  async function word() {
    if (!lesson) return;
    const settings = await db.settings.get(1);
    await downloadPlanWord(
      { title: lesson.title, currentVersion: 1, versions: [], fields, createdAt: Date.now() } as never,
      { schoolName: settings?.schoolName ?? "", lessonTitle: lesson.title, unitTitle: lesson.unitTitle, dateStr: new Date().toLocaleDateString("ar") }
    );
    show(s.library.downloaded);
  }

  async function reuse(planLessonId?: number) {
    if (!planLessonId) return;
    setLessonId(planLessonId);
    show(s.planning.reused);
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="font-medium">{s.planning.pickLesson}:</span>
            <select value={lessonId} onChange={(e) => setLessonId(Number(e.target.value))} className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal">
              <option value={0}>—</option>
              {lessons?.map((l) => (
                <option key={l.id} value={l.id}>{l.unitTitle} — {l.title}</option>
              ))}
            </select>
          </label>
          {lesson && kitByLessonTitle(lesson.title) && (
            <button type="button" onClick={prefillFromKit} className="btn-secondary">
              <Sparkles className="size-5" aria-hidden />
              {s.planning.prefill}
            </button>
          )}
        </div>

        {lessonId > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAN_FIELDS.map((f) => (
              <label key={f.key} className={"block space-y-1 " + (["objectives", "activities"].includes(f.key) ? "sm:col-span-2" : "")}>
                <span className="font-medium">{s.planning.fields[f.key as keyof typeof s.planning.fields]}</span>
                <textarea
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  rows={["objectives", "activities", "strategies"].includes(f.key) ? 3 : 2}
                  className="w-full rounded-card border-2 border-line p-3 focus:border-teal"
                />
              </label>
            ))}
          </div>
        )}

        {lessonId > 0 && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} className="btn-primary">
              <Save className="size-5" aria-hidden />
              {s.planning.save}
            </button>
            <button type="button" onClick={() => void word()} className="btn-secondary">
              <FileDown className="size-5" aria-hidden />
              {s.planning.word}
            </button>
          </div>
        )}
      </section>

      {savedPlans && savedPlans.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-heading text-lg font-bold">{s.planning.reusable}</h2>
          <ul className="divide-y divide-line">
            {savedPlans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.title}</span>
                <button type="button" onClick={() => void reuse(p.lessonId)} className="btn border-2 border-line bg-white px-4 text-teal-dark hover:border-teal">
                  {s.planning.reuse}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
