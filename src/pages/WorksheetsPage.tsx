/**
 * مولّد أوراق العمل من بنك الأسئلة: وحدة/درس/عدد → تركيب تلقائي
 * → طباعة + نسخة إجابات + Word.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileDown, NotebookPen, Printer, Wand2 } from "lucide-react";
import { db } from "@/db";
import type { Question } from "@/db/schema";
import { bankWorksheetHtml, printDoc } from "@/lib/reportPrint";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

export default function WorksheetsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [unitId, setUnitId] = useState(0);
  const [lessonId, setLessonId] = useState(0);
  const [count, setCount] = useState(6);
  const [title, setTitle] = useState("ورقة عمل");
  const [picked, setPicked] = useState<Question[]>([]);

  const units = useLiveQuery(async () => (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order));
  const lessons = useLiveQuery(
    async () => (unitId ? (await db.lessons.where("unitId").equals(unitId).toArray()).filter((l) => !l.deletedAt) : []),
    [unitId]
  );

  async function build() {
    const all = (await db.questions.toArray()).filter(
      (q) => !q.deletedAt && (!unitId || q.unitId === unitId) && (!lessonId || q.lessonId === lessonId)
    );
    if (all.length === 0) {
      show(s.worksheets.notEnough, { kind: "danger" });
      return;
    }
    // تنويع: الأقل استخداماً أولاً مع مزج المستويات
    const sorted = all.sort((a, b) => a.usageCount - b.usageCount || a.marks - b.marks);
    const chosen: Question[] = [];
    const byLevel = new Map<string, Question[]>();
    for (const q of sorted) {
      const arr = byLevel.get(q.cognitiveLevel) ?? [];
      arr.push(q);
      byLevel.set(q.cognitiveLevel, arr);
    }
    const levels = Array.from(byLevel.keys());
    let li = 0;
    while (chosen.length < count && chosen.length < all.length) {
      const arr = byLevel.get(levels[li % levels.length])!;
      const next = arr.shift();
      if (next) chosen.push(next);
      li++;
      if (levels.every((k) => (byLevel.get(k) ?? []).length === 0)) break;
    }
    setPicked(chosen);
    show(s.worksheets.built(fmtNum(chosen.length, numerals)));
  }

  async function meta() {
    const settings = await db.settings.get(1);
    const unit = units?.find((u) => u.id === unitId);
    return { schoolName: settings?.schoolName ?? "", title: title.trim() || "ورقة عمل", unitName: unit?.title ?? "" };
  }

  async function handlePrint(withAnswers: boolean) {
    printDoc(bankWorksheetHtml(picked, await meta(), withAnswers));
    show(s.worksheets.printed);
  }

  async function handleWord(withAnswers: boolean) {
    const { downloadWorksheetDocx } = await import("@/lib/kitFiles");
    const m = await meta();
    await downloadWorksheetDocx(
      {
        lessonTitle: m.title,
        unitTitle: m.unitName,
        worksheet: picked.map((q) => ({ kind: "define" as const, text: q.text, answer: String(q.answerKey ?? "") })),
      } as never,
      withAnswers
    );
    show(s.library.downloaded);
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <NotebookPen className="size-7" aria-hidden />
          {s.worksheets.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.worksheets.subtitle}</p>
      </div>

      <section className="card flex flex-wrap items-end gap-3">
        <label className="block space-y-1">
          <span className="font-medium">{s.worksheets.wsTitle}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`${selectCls} w-56`} />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">{s.worksheets.pickUnit}</span>
          <select value={unitId} onChange={(e) => { setUnitId(Number(e.target.value)); setLessonId(0); }} className={selectCls}>
            <option value={0}>{s.resources.filterAll}</option>
            {units?.map((u) => (
              <option key={u.id} value={u.id}>{u.title}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">{s.worksheets.pickLesson}</span>
          <select value={lessonId} onChange={(e) => setLessonId(Number(e.target.value))} className={selectCls}>
            <option value={0}>—</option>
            {lessons?.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium">{s.worksheets.count}</span>
          <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${selectCls} w-24 text-center`} />
        </label>
        <button type="button" onClick={() => void build()} className="btn-primary">
          <Wand2 className="size-5" aria-hidden />
          {s.worksheets.build}
        </button>
      </section>

      {picked.length > 0 && (
        <>
          <section className="card space-y-2">
            {picked.map((q, i) => (
              <p key={q.id}>
                <b>{fmtNum(i + 1, numerals)})</b> {q.text}{" "}
                <span className="text-sm text-ink-soft">({s.bank.cognitive[q.cognitiveLevel]} · {fmtNum(q.marks, numerals)})</span>
              </p>
            ))}
          </section>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handlePrint(false)} className="btn-primary">
              <Printer className="size-5" aria-hidden />
              {s.worksheets.print}
            </button>
            <button type="button" onClick={() => void handlePrint(true)} className="btn-secondary">
              <Printer className="size-5" aria-hidden />
              {s.worksheets.printAnswers}
            </button>
            <button type="button" onClick={() => void handleWord(false)} className="btn border-2 border-line bg-white text-ink hover:border-teal">
              <FileDown className="size-5" aria-hidden />
              {s.worksheets.word}
            </button>
            <button type="button" onClick={() => void handleWord(true)} className="btn border-2 border-line bg-white text-ink hover:border-teal">
              <FileDown className="size-5" aria-hidden />
              {s.worksheets.wordAnswers}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
