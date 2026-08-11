/**
 * شاشة طالبات الفصل: قائمة واضحة + بحث + فرز (الاسم/الرقم/المجموع/النقاط)
 * وثلاث طرق للإدخال: طالبة واحدة · لصق قائمة أسماء · استيراد Excel — مع تصدير.
 */
import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { db } from "@/db";
import {
  addStudent,
  addStudentsBulk,
  compareStudents,
  parseNameList,
  sumMarks,
  sumPoints,
  type StudentSortKey,
  type StudentWithStats,
} from "@/lib/students";
// exceljs ثقيلة — تُحمَّل كسولاً عند أول استخدام فعلي للاستيراد/التصدير
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

type InputMode = null | "one" | "paste" | "excel";

export default function ClassStudentsPage() {
  const s = useStrings();
  const { classId: classIdParam } = useParams();
  const classId = Number(classIdParam);
  const numerals = useUi((x) => x.numeralsTable);
  const setCurrentClass = useUi((x) => x.setCurrentClass);
  const show = useToast((x) => x.show);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<StudentSortKey>("roll");
  const [mode, setMode] = useState<InputMode>(null);
  const [oneName, setOneName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [excelNames, setExcelNames] = useState<string[] | null>(null);
  const [excelFile, setExcelFile] = useState("");
  const [busy, setBusy] = useState(false);

  const klass = useLiveQuery(() => db.classes.get(classId), [classId]);

  const students = useLiveQuery(async (): Promise<StudentWithStats[]> => {
    const list = (await db.students.where("classId").equals(classId).toArray()).filter(
      (st) => !st.deletedAt
    );
    // تذكّر آخر فصل فُتح (§2)
    setCurrentClass(classId);
    return Promise.all(
      list.map(async (st) => {
        const [grades, points] = await Promise.all([
          db.grades.where("studentId").equals(st.id!).toArray(),
          db.points.where("studentId").equals(st.id!).toArray(),
        ]);
        return { ...st, total: sumMarks(grades), points: sumPoints(points) };
      })
    );
  }, [classId]);

  const visible = useMemo(() => {
    if (!students) return undefined;
    const q = query.trim();
    const filtered = q ? students.filter((st) => st.name.includes(q)) : [...students];
    filtered.sort((a, b) => compareStudents(a, b, sortKey));
    return filtered;
  }, [students, query, sortKey]);

  const parsed = useMemo(
    () => parseNameList(pasteText, students?.map((st) => st.name) ?? []),
    [pasteText, students]
  );

  function closeInput() {
    setMode(null);
    setOneName("");
    setPasteText("");
    setExcelNames(null);
    setExcelFile("");
  }

  async function handleAddOne(e: FormEvent) {
    e.preventDefault();
    const trimmed = oneName.trim();
    if (!trimmed) return;
    setBusy(true);
    await addStudent(classId, trimmed);
    setBusy(false);
    show(s.students.added(trimmed));
    closeInput();
  }

  async function handlePasteCreate() {
    if (parsed.names.length === 0) return;
    setBusy(true);
    await addStudentsBulk(classId, parsed.names);
    setBusy(false);
    show(s.students.pasteDone(fmtNum(parsed.names.length, numerals)));
    closeInput();
  }

  async function handleExcelPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const { readNamesFromExcel } = await import("@/lib/excel");
      const names = await readNamesFromExcel(file);
      const clean = parseNameList(names.join("\n"), students?.map((st) => st.name) ?? []);
      setExcelNames(clean.names);
      setExcelFile(file.name);
    } catch {
      show(s.errors.excelReadFailed, { kind: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleExcelImport() {
    if (!excelNames || excelNames.length === 0) return;
    setBusy(true);
    await addStudentsBulk(classId, excelNames);
    setBusy(false);
    show(s.students.pasteDone(fmtNum(excelNames.length, numerals)));
    closeInput();
  }

  async function handleExport() {
    if (!students || !klass) return;
    const { exportStudentsToExcel } = await import("@/lib/excel");
    await exportStudentsToExcel(
      [...students].sort((a, b) => a.rollNumber - b.rollNumber),
      klass.name,
      {
        roll: s.students.rollShort,
        name: s.students.nameLabel,
        guardian: s.studentFile.guardianName,
        contact: s.studentFile.contactNumber,
      }
    );
    show(s.students.exportDone);
  }

  const sortOptions: { key: StudentSortKey; label: string }[] = [
    { key: "roll", label: s.students.sortRoll },
    { key: "name", label: s.students.sortName },
    { key: "total", label: s.students.sortTotal },
    { key: "points", label: s.students.sortPoints },
  ];

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
        <Users className="size-7" aria-hidden />
        {klass ? s.students.title(klass.name) : s.common.loading}
      </h1>

      {/* أزرار الإدخال الثلاثة + التصدير */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => setMode("paste")} className="btn-primary">
          <ClipboardPaste className="size-5" aria-hidden />
          {s.students.pasteList}
        </button>
        <button type="button" onClick={() => setMode("one")} className="btn-secondary">
          <Plus className="size-5" aria-hidden />
          {s.students.addOne}
        </button>
        <button type="button" onClick={() => setMode("excel")} className="btn-secondary">
          <FileSpreadsheet className="size-5" aria-hidden />
          {s.students.importExcel}
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!students || students.length === 0}
          className="btn border-2 border-line bg-white text-ink hover:border-teal disabled:opacity-50"
        >
          <Download className="size-5" aria-hidden />
          {s.students.exportExcel}
        </button>
      </div>

      {/* البحث والفرز */}
      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-touch flex-1 items-center gap-2 rounded-card border-2 border-line px-3 focus-within:border-teal">
          <Search className="size-5 text-ink-soft" aria-hidden />
          <span className="sr-only">{s.a11y.search}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.students.searchPlaceholder}
            className="min-h-touch w-full bg-transparent outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={s.students.sortBy}>
          <span className="text-ink-soft">{s.students.sortBy}:</span>
          {sortOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSortKey(o.key)}
              aria-pressed={sortKey === o.key}
              className={
                "btn px-4 " +
                (sortKey === o.key
                  ? "bg-teal text-white"
                  : "border-2 border-line bg-white text-ink hover:border-teal")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* القائمة */}
      {visible === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : visible.length === 0 && !query ? (
        <EmptyState
          icon={Users}
          title={s.students.empty}
          hint={s.students.emptyHint}
          action={
            <button type="button" onClick={() => setMode("paste")} className="btn-primary">
              <ClipboardPaste className="size-5" aria-hidden />
              {s.students.pasteList}
            </button>
          }
        />
      ) : (
        <ul className="card divide-y divide-line p-0">
          {visible.map((st) => (
            <li key={st.id}>
              <Link
                to={`/students/${st.id}`}
                className="flex min-h-touch items-center gap-4 px-4 py-3 transition-colors hover:bg-teal-bg"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-cream font-bold tabular-nums text-ink-soft">
                  {fmtNum(st.rollNumber, numerals)}
                </span>
                <span className="me-auto text-lg font-medium">{st.name}</span>
                <span className="hidden text-ink-soft sm:block">
                  {s.students.sortTotal}: {st.total ? fmtNum(st.total, numerals) : "—"}
                </span>
                <span className="hidden text-ink-soft sm:block">
                  {s.students.sortPoints}: {st.points ? fmtNum(st.points, numerals) : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* حوار: طالبة واحدة */}
      {mode === "one" && (
        <Modal title={s.students.addOne} onClose={closeInput}>
          <form onSubmit={handleAddOne} className="space-y-4">
            <label className="block space-y-2">
              <span className="font-medium">{s.students.nameLabel}</span>
              <input
                type="text"
                value={oneName}
                onChange={(e) => setOneName(e.target.value)}
                placeholder={s.students.namePlaceholder}
                className="min-h-touch w-full rounded-card border-2 border-line px-4 focus:border-teal"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeInput} className="btn border-2 border-line bg-white text-ink">
                {s.common.cancel}
              </button>
              <button type="submit" disabled={busy || !oneName.trim()} className="btn-primary disabled:opacity-50">
                {busy ? s.common.loading : s.common.save}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* حوار: لصق قائمة */}
      {mode === "paste" && (
        <Modal title={s.students.pasteTitle} onClose={closeInput} wide>
          <div className="space-y-4">
            <p className="text-ink-soft">{s.students.pasteHint}</p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={s.students.pastePlaceholder}
              aria-label={s.students.pasteTitle}
              rows={10}
              className="w-full rounded-card border-2 border-line p-4 focus:border-teal"
            />
            {pasteText.trim() && (
              <div className="space-y-1 rounded-card bg-teal-bg p-4">
                {parsed.names.length > 0 ? (
                  <p className="font-bold text-teal-dark">
                    {s.students.pastePreview(fmtNum(parsed.names.length, numerals))}
                  </p>
                ) : (
                  <p className="font-bold text-danger">{s.students.pasteEmpty}</p>
                )}
                {parsed.duplicates > 0 && (
                  <p className="text-ink-soft">
                    {s.students.pasteDuplicates(fmtNum(parsed.duplicates, numerals))}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeInput} className="btn border-2 border-line bg-white text-ink">
                {s.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handlePasteCreate()}
                disabled={busy || parsed.names.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? s.common.loading : s.students.pasteConfirm}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* حوار: استيراد Excel */}
      {mode === "excel" && (
        <Modal title={s.students.importTitle} onClose={closeInput}>
          <div className="space-y-4">
            <p className="text-ink-soft">{s.students.importHint}</p>
            <label className="btn-secondary block cursor-pointer text-center">
              <input
                type="file"
                accept=".xlsx"
                aria-label={s.students.importChooseFile}
                className="sr-only"
                onChange={(e) => void handleExcelPick(e.target.files?.[0])}
              />
              <FileSpreadsheet className="size-5" aria-hidden />
              {excelFile || s.students.importChooseFile}
            </label>
            {excelNames && (
              <div className="rounded-card bg-teal-bg p-4">
                {excelNames.length > 0 ? (
                  <p className="font-bold text-teal-dark">
                    {s.students.importPreview(fmtNum(excelNames.length, numerals), excelFile)}
                  </p>
                ) : (
                  <p className="font-bold text-danger">{s.students.pasteEmpty}</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeInput} className="btn border-2 border-line bg-white text-ink">
                {s.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleExcelImport()}
                disabled={busy || !excelNames || excelNames.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {busy ? s.common.loading : s.students.importConfirm}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
