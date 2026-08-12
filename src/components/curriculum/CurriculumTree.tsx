/** شجرة المنهج: وحدات ← دروس بالأهداف والمعايير والحصص وحالة الإنجاز */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, ChevronDown, Circle, Pencil, Plus } from "lucide-react";
import { db } from "@/db";
import type { Lesson } from "@/db/schema";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";

export default function CurriculumTree() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Lesson | null>(null);

  const tree = useLiveQuery(async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order);
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.order - b.order);
    return units.map((u) => ({ unit: u, lessons: lessons.filter((l) => l.unitId === u.id) }));
  });

  async function toggleTaught(l: Lesson) {
    await db.lessons.update(l.id!, { taughtAt: l.taughtAt ? undefined : Date.now() });
  }

  async function addLesson(unitId: number, order: number, subjectId: number) {
    await db.lessons.add({ unitId, subjectId, title: "درس جديد", order, sessionsCount: 2, createdAt: Date.now() });
  }

  return (
    <div className="space-y-4">
      {tree?.map(({ unit, lessons }) => {
        const isOpen = open.has(unit.id!) || open.size === 0;
        return (
          <section key={unit.id} className="card">
            <button
              type="button"
              onClick={() => setOpen((prev) => { const n = new Set(prev); n.has(unit.id!) ? n.delete(unit.id!) : n.add(unit.id!); return n.size === 0 ? new Set([-1]) : n; })}
              className="flex w-full items-center gap-2 text-start"
            >
              <ChevronDown className={"size-6 text-teal-dark transition-transform " + (isOpen ? "" : "-rotate-90")} aria-hidden />
              <span className="me-auto font-heading text-xl font-bold text-teal-dark">{unit.title}</span>
              <span className="text-sm text-ink-soft">{fmtNum(lessons.length, numerals)} {s.curriculum.lesson}</span>
            </button>
            {isOpen && (
              <ul className="mt-3 space-y-2">
                {lessons.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line p-3">
                    <button type="button" onClick={() => void toggleTaught(l)} aria-label={l.taughtAt ? s.curriculum.markUntaught : s.curriculum.markTaught} className="shrink-0">
                      {l.taughtAt ? <CheckCircle2 className="size-6 text-ok" aria-hidden /> : <Circle className="size-6 text-ink-soft" aria-hidden />}
                    </button>
                    <div className="me-auto">
                      <p className="font-medium">{l.title}</p>
                      <p className="text-sm text-ink-soft">
                        {fmtNum(l.sessionsCount ?? 1, numerals)} {s.curriculum.sessions}
                        {l.learningOutcomes?.length ? ` · ${fmtNum(l.learningOutcomes.length, numerals)} ${s.curriculum.outcomes}` : ""}
                        {l.taughtAt ? ` · ${s.curriculum.taught} ✓` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditing(l)} className="btn border-2 border-line bg-white px-3 text-ink hover:border-teal">
                      <Pencil className="size-5" aria-hidden />
                      {s.common.edit}
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={() => void addLesson(unit.id!, lessons.length + 1, unit.subjectId)} className="btn-secondary px-4">
                    <Plus className="size-5" aria-hidden />
                    {s.curriculum.addLesson}
                  </button>
                </li>
              </ul>
            )}
          </section>
        );
      })}

      {editing && (
        <LessonEditor lesson={editing} onClose={() => { setEditing(null); show(s.curriculum.saved); }} />
      )}
    </div>
  );
}

function LessonEditor({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const s = useStrings();
  const [title, setTitle] = useState(lesson.title);
  const [sessions, setSessions] = useState(lesson.sessionsCount ?? 2);
  const [objectives, setObjectives] = useState((lesson.objectives ?? []).join("\n"));
  const [standards, setStandards] = useState((lesson.standards ?? []).join("\n"));
  const [outcomes, setOutcomes] = useState((lesson.learningOutcomes ?? []).map((o) => `${o.code} | ${o.text}`).join("\n"));

  async function save() {
    await db.lessons.update(lesson.id!, {
      title: title.trim() || lesson.title,
      sessionsCount: sessions,
      objectives: objectives.split("\n").map((x) => x.trim()).filter(Boolean),
      standards: standards.split("\n").map((x) => x.trim()).filter(Boolean),
      learningOutcomes: outcomes.split("\n").map((x) => x.trim()).filter(Boolean).map((line) => {
        const [code, ...rest] = line.split("|");
        return rest.length ? { code: code.trim(), text: rest.join("|").trim() } : { code: "", text: code.trim() };
      }),
      updatedAt: Date.now(),
    });
    onClose();
  }

  const inputCls = "min-h-touch w-full rounded-card border-2 border-line px-3 focus:border-teal";
  return (
    <Modal title={s.curriculum.editObjectives} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="font-medium">{s.curriculum.lesson}</span><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></label>
          <label className="block space-y-1"><span className="font-medium">{s.curriculum.sessions}</span><input type="number" min={1} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} className={inputCls} /></label>
        </div>
        <label className="block space-y-1"><span className="font-medium">{s.curriculum.objectives}</span><textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={3} placeholder={s.curriculum.objectivesHint} className="w-full rounded-card border-2 border-line p-3 focus:border-teal" /></label>
        <label className="block space-y-1"><span className="font-medium">{s.curriculum.standards}</span><textarea value={standards} onChange={(e) => setStandards(e.target.value)} rows={2} className="w-full rounded-card border-2 border-line p-3 focus:border-teal" /></label>
        <label className="block space-y-1"><span className="font-medium">{s.curriculum.outcomes}</span><textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={3} placeholder="ع.٥.١.١ | نص الناتج" className="w-full rounded-card border-2 border-line p-3 focus:border-teal" /></label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          <button type="button" onClick={() => void save()} className="btn-primary">{s.common.save}</button>
        </div>
      </div>
    </Modal>
  );
}
