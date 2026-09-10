/**
 * شاشة الفصول: بطاقة لكل فصل (الاسم، عدد الطالبات، المتوسط) +
 * إضافة/تعديل/حذف بتأكيد وتراجع. المعلّمة تسمّي فصولها بنفسها.
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { GraduationCap, Pencil, Plus, School, Trash2, Users } from "lucide-react";
import { db } from "@/db";
import type { Klass } from "@/db/schema";
import { classStats, softDeleteClass } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

interface ClassCard extends Klass {
  count: number;
  average?: number;
}

export default function ClassesPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassCard | null>(null);
  const [deleting, setDeleting] = useState<ClassCard | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const cards = useLiveQuery(async (): Promise<ClassCard[]> => {
    const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);
    classes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "ar"));
    return Promise.all(
      classes.map(async (c) => ({ ...c, ...(await classStats(c.id!)) }))
    );
  });

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    const settings = await db.settings.get(1);
    const subject = await db.subjects.toCollection().first();
    await db.classes.add({
      name: trimmed,
      academicYearId: settings?.currentAcademicYearId ?? 0,
      subjectId: subject?.id ?? 0,
      order: (cards?.length ?? 0) + 1,
      createdAt: Date.now(),
    });
    setBusy(false);
    setAdding(false);
    setName("");
    show(s.classes.added(trimmed));
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !editing) return;
    setBusy(true);
    await db.classes.update(editing.id!, { name: trimmed, updatedAt: Date.now() });
    setBusy(false);
    setEditing(null);
    setName("");
    show(s.classes.renamed);
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    const undo = await softDeleteClass(deleting.id!);
    setBusy(false);
    show(s.classes.deleted(deleting.name), { undo, kind: "danger" });
    setDeleting(null);
  }

  return (
    <div className="space-y-5">
      <section className="hero-paint hero-paint--sub relative isolate overflow-hidden rounded-[24px] border border-line/80 shadow-lift">
        <img aria-hidden src="/app-art/hero-students.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-left mix-blend-multiply" onError={(e) => e.currentTarget.remove()} />
        <div className="relative flex flex-col items-start gap-3 px-6 py-7 md:w-[64%] md:px-10 md:py-9">
          <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold text-green-dark md:text-4xl">
            <School className="size-8" aria-hidden />
            {s.classes.title}
          </h1>
          <button type="button" onClick={() => { setName(""); setAdding(true); }} className="btn-primary">
            <Plus className="size-5" aria-hidden />
            {s.classes.addClass}
          </button>
        </div>
      </section>

      {cards === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={s.classes.empty}
          hint={s.classes.emptyHint}
          action={
            <button type="button" onClick={() => { setName(""); setAdding(true); }} className="btn-primary">
              <Plus className="size-5" aria-hidden />
              {s.classes.addClass}
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.id} className="card flex flex-col gap-3 transition-colors hover:border-teal">
              <Link to={`/classes/${c.id}`} className="group space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-heading text-2xl font-bold text-teal-dark group-hover:underline">
                    {c.name}
                  </span>
                  <GraduationCap className="size-7 text-teal" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
                  <span className="flex items-center gap-1">
                    <Users className="size-5" aria-hidden />
                    {fmtNum(c.count, numerals)} {s.classes.studentsCountLabel}
                  </span>
                  <span>
                    {s.classes.avgLabel}:{" "}
                    {c.average === undefined ? s.classes.noGradesYet : fmtNum(c.average, numerals)}
                  </span>
                </div>
              </Link>
              <div className="flex gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => { setName(c.name); setEditing(c); }}
                  className="btn flex-1 border-2 border-line bg-white text-ink hover:border-teal"
                >
                  <Pencil className="size-5" aria-hidden />
                  {s.common.edit}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(c)}
                  className="btn flex-1 border-2 border-line bg-white text-danger hover:border-danger hover:bg-danger-bg"
                >
                  <Trash2 className="size-5" aria-hidden />
                  {s.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <Modal
          title={editing ? s.classes.editClass : s.classes.addClass}
          onClose={() => { setAdding(false); setEditing(null); }}
        >
          <form onSubmit={editing ? handleRename : handleAdd} className="space-y-4">
            <label className="block space-y-2">
              <span className="font-medium">{s.classes.className}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={s.classes.classNamePlaceholder}
                className="min-h-touch w-full rounded-card border-2 border-line px-4 focus:border-teal"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setAdding(false); setEditing(null); }}
                className="btn border-2 border-line bg-white text-ink"
              >
                {s.common.cancel}
              </button>
              <button type="submit" disabled={busy || !name.trim()} className="btn-primary disabled:opacity-50">
                {busy ? s.common.loading : s.common.save}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={s.classes.confirmDeleteTitle}
          body={s.classes.confirmDeleteBody(deleting.name, fmtNum(deleting.count, numerals))}
          confirmLabel={s.classes.deleteClass}
          busy={busy}
          onConfirm={() => void handleDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
