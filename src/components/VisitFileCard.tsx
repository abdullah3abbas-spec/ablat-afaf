/**
 * زر «جهّزي ملف الزيارة الصفية» (§ الأمر ٨-ب ثانياً).
 * ضغطة واحدة تجمع كل ما تحتاجه المعلّمة للزيارة في مستند واحد.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardCheck, Printer } from "lucide-react";
import { db } from "@/db";
import { genVisitFile } from "@/lib/generate";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

export default function VisitFileCard() {
  const s = useStrings();
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);
  const [classId, setClassId] = useState<number>(currentClassId ?? 0);
  const [lessonId, setLessonId] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const lessons = useLiveQuery(async () =>
    (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.unitId - b.unitId || a.order - b.order)
  );

  const effClass = classId || currentClassId || classes?.[0]?.id || 0;

  async function build() {
    if (!effClass) return show(s.visitFile.needClassLesson, { kind: "danger" });
    setBusy(true);
    try {
      const ok = await genVisitFile(effClass, lessonId || undefined);
      show(ok ? s.visitFile.done : s.visitFile.needClassLesson, { kind: ok ? "success" : "danger" });
    } finally {
      setBusy(false);
    }
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <section className="card space-y-3 border-2 border-maroon/30">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-maroon">
        <ClipboardCheck className="size-6" aria-hidden />
        {s.visitFile.title}
      </h2>
      <p className="text-ink-soft">{s.visitFile.hint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <select value={effClass} onChange={(e) => setClassId(Number(e.target.value))} aria-label={s.grades.pickClass} className={selectCls}>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={lessonId} onChange={(e) => setLessonId(Number(e.target.value))} aria-label={s.visitFile.sections.lessonPlan} className={selectCls}>
          <option value={0}>— الدرس القادم —</option>
          {lessons?.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
        <button type="button" onClick={() => void build()} disabled={busy} className="btn-primary disabled:opacity-50">
          <Printer className="size-5" aria-hidden />
          {busy ? s.visitFile.building : s.visitFile.button}
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        {Object.values(s.visitFile.sections).join(" · ")}
      </p>
    </section>
  );
}
