/**
 * ملف الطالبة — صفحة واحدة بأربعة تبويبات:
 * البيانات (تحرير بحفظ تلقائي) · الدرجات · الحضور والنقاط · الملاحظات.
 * مع نقل لفصل آخر (يسجَّل تاريخه) وحذف بتأكيد وتراجع.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  Camera,
  CheckCircle2,
  IdCard,
  NotebookPen,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { db } from "@/db";
import type { BehaviorNote, Student } from "@/db/schema";
import { softDeleteStudent, sumMarks, sumPoints, transferStudent } from "@/lib/students";
import { downscalePhoto } from "@/lib/image";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import StudentGrades from "@/components/StudentGrades";
import StudentAttendancePoints from "@/components/StudentAttendancePoints";
import StudentBadges from "@/components/StudentBadges";

type Tab = "data" | "grades" | "attendancePoints" | "notes";

export default function StudentPage() {
  const s = useStrings();
  const { studentId: idParam } = useParams();
  const studentId = Number(idParam);
  const navigate = useNavigate();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [tab, setTab] = useState<Tab>("data");
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const student = useLiveQuery(() => db.students.get(studentId), [studentId]);
  const klass = useLiveQuery(
    () => (student ? db.classes.get(student.classId) : undefined),
    [student?.classId]
  );
  const classes = useLiveQuery(async () =>
    (await db.classes.toArray()).filter((c) => !c.deletedAt)
  );

  const stats = useLiveQuery(async () => {
    if (!studentId) return undefined;
    const [grades, points] = await Promise.all([
      db.grades.where("studentId").equals(studentId).toArray(),
      db.points.where("studentId").equals(studentId).toArray(),
    ]);
    return { total: sumMarks(grades), points: sumPoints(points) };
  }, [studentId]);

  const notes = useLiveQuery(async () => {
    const list = await db.behaviorNotes.where("studentId").equals(studentId).toArray();
    return list.filter((n) => !n.deletedAt).sort((a, b) => b.date - a.date);
  }, [studentId]);

  async function handleTransfer(toClassId: number) {
    if (!student) return;
    setBusy(true);
    await transferStudent(studentId, toClassId);
    const to = classes?.find((c) => c.id === toClassId);
    setBusy(false);
    setTransferOpen(false);
    show(s.studentFile.transferDone(student.name, to?.name ?? ""));
  }

  async function handleDelete() {
    if (!student) return;
    setBusy(true);
    const undo = await softDeleteStudent(studentId);
    setBusy(false);
    setDeleteOpen(false);
    show(s.students.deleted(student.name), { undo, kind: "danger" });
    navigate(`/classes/${student.classId}`);
  }

  if (!student) {
    return <p className="card text-ink-soft">{s.common.loading}</p>;
  }

  const tabs: { key: Tab; label: string; icon: typeof IdCard }[] = [
    { key: "data", label: s.studentFile.tabs.data, icon: IdCard },
    { key: "grades", label: s.studentFile.tabs.grades, icon: BarChart3 },
    { key: "attendancePoints", label: s.studentFile.tabs.attendancePoints, icon: CalendarCheck },
    { key: "notes", label: s.studentFile.tabs.notes, icon: NotebookPen },
  ];

  return (
    <div className="space-y-5">
      {/* رأس الملف */}
      <div className="card flex flex-wrap items-center gap-4">
        <StudentPhoto student={student} />
        <div className="me-auto">
          <h1 className="font-heading text-2xl font-bold text-maroon">{student.name}</h1>
          <p className="text-ink-soft">
            {klass?.name} · {s.studentFile.rollNumber}: {fmtNum(student.rollNumber, numerals)}
          </p>
          {stats && (
            <p className="text-ink-soft">
              {s.students.sortTotal}: {stats.total ? fmtNum(stats.total, numerals) : "—"} ·{" "}
              {s.students.sortPoints}: {stats.points ? fmtNum(stats.points, numerals) : "—"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setTransferOpen(true)} className="btn-secondary">
            <ArrowLeftRight className="size-5" aria-hidden />
            {s.studentFile.transfer}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="btn border-2 border-line bg-white text-danger hover:border-danger hover:bg-danger-bg"
          >
            <Trash2 className="size-5" aria-hidden />
            {s.studentFile.deleteStudent}
          </button>
        </div>
      </div>

      {/* التبويبات */}
      <div role="tablist" aria-label={student.name} className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={
              "btn " +
              (tab === t.key
                ? "bg-maroon text-white"
                : "border-2 border-line bg-white text-ink hover:border-maroon")
            }
          >
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "data" && <DataTab student={student} />}
      {tab === "grades" && <StudentGrades studentId={studentId} />}
      {tab === "attendancePoints" && <StudentAttendancePoints studentId={studentId} />}
      {tab === "notes" && <NotesTab studentId={studentId} notes={notes ?? []} />}

      {/* الأوسمة (§ الأمر ٧) */}
      <StudentBadges studentId={studentId} />

      {/* سجل النقل إن وُجد */}
      {student.classHistory && student.classHistory.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-heading text-lg font-bold">{s.studentFile.transferHistory}</h2>
          <ul className="space-y-1 text-ink-soft">
            {student.classHistory.map((t, i) => (
              <TransferLine key={i} fromId={t.fromClassId} toId={t.toClassId} date={t.date} />
            ))}
          </ul>
        </section>
      )}

      {transferOpen && (
        <Modal title={s.studentFile.transferTitle(student.name)} onClose={() => setTransferOpen(false)}>
          <div className="space-y-4">
            <p className="text-ink-soft">{s.studentFile.transferHint}</p>
            <div className="space-y-2">
              <span className="font-medium">{s.studentFile.transferTo}</span>
              <div className="grid gap-3">
                {classes
                  ?.filter((c) => c.id !== student.classId)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleTransfer(c.id!)}
                      className="btn-secondary justify-between"
                    >
                      <span>{c.name}</span>
                      <ArrowLeftRight className="size-5" aria-hidden />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <ConfirmDialog
          title={s.students.confirmDeleteTitle}
          body={s.students.confirmDeleteBody(student.name)}
          confirmLabel={s.studentFile.deleteStudent}
          busy={busy}
          onConfirm={() => void handleDelete()}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}

/** صورة الطالبة الاختيارية مع اختيار/إزالة */
function StudentPhoto({ student }: { student: Student }) {
  const s = useStrings();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!student.photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(student.photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [student.photo]);

  async function pick(file: File | undefined) {
    if (!file) return;
    const blob = await downscalePhoto(file);
    await db.students.update(student.id!, { photo: blob, updatedAt: Date.now() });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {url ? (
        <img src={url} alt={student.name} className="size-20 rounded-pill object-cover" />
      ) : (
        <span className="flex size-20 items-center justify-center rounded-pill bg-cream">
          <User className="size-10 text-ink-soft" aria-hidden />
        </span>
      )}
      <label className="flex min-h-touch cursor-pointer items-center gap-1 rounded-card px-2 text-sm text-teal-dark hover:underline">
        <input
          type="file"
          accept="image/*"
          aria-label={s.studentFile.choosePhoto}
          className="sr-only"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Camera className="size-4" aria-hidden />
        {s.studentFile.choosePhoto}
      </label>
      {student.photo && (
        <button
          type="button"
          onClick={() => void db.students.update(student.id!, { photo: undefined })}
          className="text-sm text-ink-soft hover:underline"
        >
          {s.studentFile.removePhoto}
        </button>
      )}
    </div>
  );
}

/** تبويب البيانات — حفظ تلقائي عند كل تعديل + مؤشر «تم الحفظ ✓» (§6) */
function DataTab({ student }: { student: Student }) {
  const s = useStrings();
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function autosave(patch: Partial<Student>) {
    void db.students.update(student.id!, { ...patch, updatedAt: Date.now() }).then(() => {
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    });
  }

  const fields: {
    key: "name" | "guardianName" | "guardianRelation" | "contactNumber";
    label: string;
    type?: string;
  }[] = [
    { key: "name", label: s.students.nameLabel },
    { key: "guardianName", label: s.studentFile.guardianName },
    { key: "guardianRelation", label: s.studentFile.guardianRelation },
    { key: "contactNumber", label: s.studentFile.contactNumber, type: "tel" },
  ];

  return (
    <div className="card space-y-4">
      <div aria-live="polite" className="min-h-6 text-ok">
        {saved && (
          <span className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="size-5" aria-hidden />
            {s.toast.saved}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block space-y-2">
            <span className="font-medium">{f.label}</span>
            <input
              type={f.type ?? "text"}
              defaultValue={(student[f.key] as string | undefined) ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== ((student[f.key] as string | undefined) ?? "")) {
                  autosave({ [f.key]: v || undefined });
                }
              }}
              className="min-h-touch w-full rounded-card border-2 border-line px-4 focus:border-teal"
            />
          </label>
        ))}
      </div>
      <label className="block space-y-2">
        <span className="font-medium">{s.studentFile.healthNotes}</span>
        <textarea
          defaultValue={student.healthNotes ?? ""}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (student.healthNotes ?? "")) autosave({ healthNotes: v || undefined });
          }}
          className="w-full rounded-card border-2 border-line p-4 focus:border-teal"
        />
      </label>
    </div>
  );
}

/** تبويب الملاحظات — إضافة وحذف (ناعم) للملاحظات السلوكية */
function NotesTab({ studentId, notes }: { studentId: number; notes: BehaviorNote[] }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [text, setText] = useState("");
  const [tone, setTone] = useState<BehaviorNote["tone"]>("neutral");
  const [deleting, setDeleting] = useState<BehaviorNote | null>(null);

  async function addNote() {
    const t = text.trim();
    if (!t) return;
    await db.behaviorNotes.add({
      studentId,
      date: Date.now(),
      text: t,
      tone,
      createdAt: Date.now(),
    });
    setText("");
    show(s.studentFile.noteAdded);
  }

  async function deleteNote() {
    if (!deleting) return;
    const id = deleting.id!;
    await db.behaviorNotes.update(id, { deletedAt: Date.now() });
    setDeleting(null);
    show(s.studentFile.noteDeleted, {
      kind: "danger",
      undo: async () => {
        await db.behaviorNotes.update(id, { deletedAt: undefined });
      },
    });
  }

  const tones: { key: NonNullable<BehaviorNote["tone"]>; label: string }[] = [
    { key: "positive", label: s.studentFile.noteTone.positive },
    { key: "neutral", label: s.studentFile.noteTone.neutral },
    { key: "concern", label: s.studentFile.noteTone.concern },
  ];

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <label className="block space-y-2">
          <span className="font-medium">{s.studentFile.addNote}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={s.studentFile.notePlaceholder}
            rows={3}
            className="w-full rounded-card border-2 border-line p-4 focus:border-teal"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={s.studentFile.addNote}>
            {tones.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTone(t.key)}
                aria-pressed={tone === t.key}
                className={
                  "btn px-4 " +
                  (tone === t.key
                    ? "bg-teal text-white"
                    : "border-2 border-line bg-white text-ink hover:border-teal")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void addNote()} disabled={!text.trim()} className="btn-primary disabled:opacity-50">
            <Plus className="size-5" aria-hidden />
            {s.common.save}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={NotebookPen} title={s.studentFile.notesEmpty} />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="card flex items-start gap-3">
              <span
                className={
                  "mt-1 rounded-pill px-3 py-1 text-sm font-medium " +
                  (n.tone === "positive"
                    ? "bg-teal-bg text-teal-dark"
                    : n.tone === "concern"
                      ? "bg-gold-bg text-gold-dark"
                      : "bg-cream text-ink-soft")
                }
              >
                {n.tone === "positive"
                  ? s.studentFile.noteTone.positive
                  : n.tone === "concern"
                    ? s.studentFile.noteTone.concern
                    : s.studentFile.noteTone.neutral}
              </span>
              <div className="me-auto">
                <p>{n.text}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {new Date(n.date).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(n)}
                aria-label={s.common.delete}
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
          title={s.studentFile.deleteNoteTitle}
          body={s.studentFile.deleteNoteBody}
          confirmLabel={s.common.delete}
          onConfirm={() => void deleteNote()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** سطر في سجل النقل — يحوّل المعرّفات لأسماء */
function TransferLine({ fromId, toId, date }: { fromId: number; toId: number; date: number }) {
  const s = useStrings();
  const from = useLiveQuery(() => db.classes.get(fromId), [fromId]);
  const to = useLiveQuery(() => db.classes.get(toId), [toId]);
  return (
    <li>
      {s.studentFile.transferRecord(
        from?.name ?? "",
        to?.name ?? "",
        new Date(date).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })
      )}
    </li>
  );
}
