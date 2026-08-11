/**
 * بنك الأسئلة: فلترة (وحدة/نوع/صعوبة/مستوى) + بحث نصي + إضافة/تعديل
 * + نسخ وتعديل + استيراد جماعي من Excel أو Word.
 */
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Copy, DatabaseZap, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/db";
import type { CognitiveLevel, Difficulty, Question, QuestionType } from "@/db/schema";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

const ALL_TYPES: QuestionType[] = ["mcq", "truefalse", "matching", "fillblank", "define", "order", "readchart", "drawlabel", "justify", "shortessay", "inquiry"];
const ALL_COG: CognitiveLevel[] = ["remember", "understand", "apply", "higher"];

export default function QuestionsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [query, setQuery] = useState("");
  const [unitId, setUnitId] = useState(0);
  const [type, setType] = useState<QuestionType | "">("");
  const [cog, setCog] = useState<CognitiveLevel | "">("");
  const [editing, setEditing] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const units = useLiveQuery(async () => (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order));
  const lessons = useLiveQuery(async () => (await db.lessons.toArray()).filter((l) => !l.deletedAt));
  const questions = useLiveQuery(async () => (await db.questions.toArray()).filter((q) => !q.deletedAt));

  const visible = useMemo(() => {
    if (!questions) return undefined;
    const q = query.trim();
    return questions
      .filter(
        (x) =>
          (!unitId || x.unitId === unitId) &&
          (!type || x.type === type) &&
          (!cog || x.cognitiveLevel === cog) &&
          (!q || x.text.includes(q))
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [questions, query, unitId, type, cog]);

  async function duplicate(q: Question) {
    const copy = { ...q, id: undefined, text: `${q.text} (نسخة)`, usageCount: 0, lastUsedDate: undefined, createdAt: Date.now() };
    const id = await db.questions.add(copy);
    show(s.bank.duplicated);
    setEditing((await db.questions.get(id)) ?? null);
  }

  async function softDelete() {
    if (!deleting) return;
    const id = deleting.id!;
    await db.questions.update(id, { deletedAt: Date.now() });
    setDeleting(null);
    show(s.bank.deleted, { kind: "danger", undo: async () => db.questions.update(id, { deletedAt: undefined }).then(() => {}) });
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
            <DatabaseZap className="size-7" aria-hidden />
            {s.bank.title}
          </h1>
          <p className="mt-1 text-ink-soft">
            {s.bank.subtitle} · {visible ? s.bank.count(fmtNum(visible.length, numerals)) : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setImporting(true)} className="btn-secondary">
            <FileUp className="size-5" aria-hidden />
            {s.bank.importTitle}
          </button>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary">
            <Plus className="size-5" aria-hidden />
            {s.bank.addQuestion}
          </button>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex min-h-touch flex-1 basis-64 items-center gap-2 rounded-card border-2 border-line px-3 focus-within:border-teal">
          <Search className="size-5 text-ink-soft" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={s.bank.searchPlaceholder} aria-label={s.a11y.search} className="min-h-touch w-full bg-transparent outline-none" />
        </label>
        <select value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} aria-label={s.bank.fields.unit} className={selectCls}>
          <option value={0}>{s.resources.filterAll}</option>
          {units?.map((u) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value as QuestionType | "")} aria-label={s.bank.fields.type} className={selectCls}>
          <option value="">{s.resources.filterAll}</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{s.bank.types[t]}</option>
          ))}
        </select>
        <select value={cog} onChange={(e) => setCog(e.target.value as CognitiveLevel | "")} aria-label={s.bank.fields.cognitive} className={selectCls}>
          <option value="">{s.resources.filterAll}</option>
          {ALL_COG.map((c) => (
            <option key={c} value={c}>{s.bank.cognitive[c]}</option>
          ))}
        </select>
      </div>

      {visible === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={DatabaseZap} title={s.home.emptyTitle} />
      ) : (
        <ul className="space-y-3">
          {visible.slice(0, 60).map((q) => (
            <li key={q.id} className="card flex flex-wrap items-start gap-3">
              <div className="me-auto min-w-0 flex-1 basis-72">
                <p className="font-medium">{q.text}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-pill bg-teal-bg px-2 text-teal-dark">{s.bank.types[q.type]}</span>
                  <span className="rounded-pill bg-cream px-2 text-ink-soft">{s.bank.cognitive[q.cognitiveLevel]}</span>
                  <span className="rounded-pill bg-cream px-2 text-ink-soft">{s.bank.difficulties[q.difficulty]}</span>
                  <span className="rounded-pill bg-gold-bg px-2 text-gold-dark">{fmtNum(q.marks, numerals)} {q.marks === 1 ? "درجة" : "درجات"}</span>
                  <span className="text-ink-soft">{q.usageCount > 0 ? s.bank.usage(fmtNum(q.usageCount, numerals)) : s.bank.neverUsed}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(q)} aria-label={`${s.bank.editQuestion}: ${q.text.slice(0, 20)}`} className="btn border-2 border-line bg-white px-3 text-ink hover:border-teal">
                  <Pencil className="size-5" aria-hidden />
                </button>
                <button type="button" onClick={() => void duplicate(q)} aria-label={s.bank.duplicate} className="btn border-2 border-line bg-white px-3 text-ink hover:border-teal">
                  <Copy className="size-5" aria-hidden />
                </button>
                <button type="button" onClick={() => setDeleting(q)} aria-label={s.bank.deleteQ} className="btn border-2 border-line bg-white px-3 text-danger hover:border-danger">
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <QuestionForm
          question={editing ?? undefined}
          units={units ?? []}
          lessons={lessons ?? []}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} defaultUnitId={units?.[0]?.id ?? 0} />}
      {deleting && (
        <ConfirmDialog title={s.bank.deleteQ} body={s.bank.confirmDeleteBody} confirmLabel={s.common.delete} onConfirm={() => void softDelete()} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/** نموذج إضافة/تعديل سؤال */
function QuestionForm({ question, units, lessons, onClose }: { question?: Question; units: { id?: number; title: string }[]; lessons: { id?: number; unitId: number; title: string }[]; onClose: () => void }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [f, setF] = useState<Question>(
    question ?? {
      unitId: units[0]?.id ?? 0,
      text: "",
      type: "mcq",
      marks: 1,
      difficulty: "easy",
      cognitiveLevel: "remember",
      estimatedMinutes: 2,
      usageCount: 0,
      createdAt: Date.now(),
    }
  );
  const [optionsText, setOptionsText] = useState((question?.options ?? []).map((o) => o.text).join("\n"));
  const [answerText, setAnswerText] = useState(String(question?.answerKey ?? ""));

  async function save() {
    if (!f.text.trim()) return;
    const KEYS = ["أ", "ب", "ج", "د", "هـ", "و"];
    const options =
      f.type === "mcq"
        ? optionsText.split("\n").map((t) => t.trim()).filter(Boolean).map((text, i) => ({ key: KEYS[i], text }))
        : undefined;
    const record: Question = { ...f, options, answerKey: answerText.trim() || undefined, updatedAt: Date.now() };
    if (question?.id) await db.questions.update(question.id, record as never);
    else await db.questions.add(record);
    show(s.bank.saved);
    onClose();
  }

  const unitLessons = lessons.filter((l) => l.unitId === f.unitId);
  const inputCls = "min-h-touch w-full rounded-card border-2 border-line px-3 focus:border-teal";

  return (
    <Modal title={question ? s.bank.editQuestion : s.bank.addQuestion} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.unit}</span>
            <select value={f.unitId} onChange={(e) => setF({ ...f, unitId: Number(e.target.value), lessonId: undefined })} className={inputCls}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.title}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.lesson}</span>
            <select value={f.lessonId ?? 0} onChange={(e) => setF({ ...f, lessonId: Number(e.target.value) || undefined })} className={inputCls}>
              <option value={0}>—</option>
              {unitLessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="font-medium">{s.bank.fields.text}</span>
          <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={3} className="w-full rounded-card border-2 border-line p-3 focus:border-teal" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.type}</span>
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as QuestionType })} className={inputCls}>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{s.bank.types[t]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.cognitive}</span>
            <select value={f.cognitiveLevel} onChange={(e) => setF({ ...f, cognitiveLevel: e.target.value as CognitiveLevel })} className={inputCls}>
              {ALL_COG.map((c) => (
                <option key={c} value={c}>{s.bank.cognitive[c]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.difficulty}</span>
            <select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as Difficulty })} className={inputCls}>
              {(["easy", "medium", "hard"] as const).map((d) => (
                <option key={d} value={d}>{s.bank.difficulties[d]}</option>
              ))}
            </select>
          </label>
        </div>
        {f.type === "mcq" && (
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.options}</span>
            <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} className="w-full rounded-card border-2 border-line p-3 focus:border-teal" />
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 sm:col-span-1">
            <span className="font-medium">{s.bank.fields.answer}</span>
            <input type="text" value={answerText} onChange={(e) => setAnswerText(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.marks}</span>
            <input type="number" min={1} value={f.marks} onChange={(e) => setF({ ...f, marks: Number(e.target.value) })} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{s.bank.fields.minutes}</span>
            <input type="number" min={1} value={f.estimatedMinutes ?? 2} onChange={(e) => setF({ ...f, estimatedMinutes: Number(e.target.value) })} className={inputCls} />
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          <button type="button" onClick={() => void save()} disabled={!f.text.trim()} className="btn-primary disabled:opacity-50">{s.common.save}</button>
        </div>
      </div>
    </Modal>
  );
}

/** استيراد جماعي: Excel (أعمدة نص/إجابة/درجة) أو Word (فقرات) */
function ImportDialog({ onClose, defaultUnitId }: { onClose: () => void; defaultUnitId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [busy, setBusy] = useState(false);

  async function importRows(rows: { text: string; answer?: string; marks?: number }[]) {
    const now = Date.now();
    const clean = rows.filter((r) => r.text.trim().length > 3);
    await db.questions.bulkAdd(
      clean.map((r) => ({
        unitId: defaultUnitId,
        text: r.text.trim(),
        type: "shortessay" as const,
        answerKey: r.answer?.trim() || undefined,
        marks: r.marks && r.marks > 0 ? r.marks : 2,
        difficulty: "medium" as const,
        cognitiveLevel: "understand" as const,
        estimatedMinutes: 3,
        usageCount: 0,
        createdAt: now,
      }))
    );
    show(s.bank.importedN(fmtNum(clean.length, numerals)));
    onClose();
  }

  async function fromExcel(file: File) {
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      const rows: { text: string; answer?: string; marks?: number }[] = [];
      sheet?.eachRow((row, i) => {
        const text = String(row.getCell(1).text ?? "").trim();
        if (i === 1 && (text === "نص السؤال" || text === "السؤال")) return;
        rows.push({ text, answer: String(row.getCell(2).text ?? ""), marks: Number(row.getCell(3).text) || undefined });
      });
      await importRows(rows);
    } catch {
      show(s.errors.excelReadFailed, { kind: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function fromWord(file: File) {
    setBusy(true);
    try {
      const { extractDocx } = await import("@/lib/extract");
      const { searchText } = await extractDocx(file);
      const rows = searchText
        .split(/[؟?]\s*/)
        .map((t) => t.trim())
        .filter((t) => t.length > 5)
        .map((t) => ({ text: `${t}؟` }));
      await importRows(rows);
    } catch {
      show(s.errors.generic, { kind: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={s.bank.importTitle} onClose={onClose}>
      <div className="space-y-4">
        <label className="btn-secondary block cursor-pointer text-center">
          <input type="file" accept=".xlsx" className="sr-only" aria-label="Excel" onChange={(e) => e.target.files?.[0] && void fromExcel(e.target.files[0])} />
          {busy ? s.common.loading : "Excel"} — <span className="text-sm font-normal">{s.bank.importExcelHint}</span>
        </label>
        <label className="btn-secondary block cursor-pointer text-center">
          <input type="file" accept=".docx" className="sr-only" aria-label="Word" onChange={(e) => e.target.files?.[0] && void fromWord(e.target.files[0])} />
          {busy ? s.common.loading : "Word"} — <span className="text-sm font-normal">{s.bank.importWordHint}</span>
        </label>
      </div>
    </Modal>
  );
}
