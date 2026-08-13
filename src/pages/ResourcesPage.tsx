/**
 * مركز المصادر (§2-و): رفع مرة واحدة أول العام — سحب وإفلات،
 * تصنيف بالأنواع الثمانية، ترتيب فصل←وحدة←درس، معاينة سريعة،
 * وبحث داخل المحتوى المستخرَج محلياً.
 */
import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  Eye,
  FileText,
  FileSpreadsheet,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Presentation,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  Search,
  Wand2,
} from "lucide-react";
import { db } from "@/db";
import type { Resource, ResourceCategory, Term } from "@/db/schema";
import {
  addResource,
  filterResources,
  MAX_BLOB_BYTES,
  readResourceFile,
  searchSnippet,
  supportsFileHandles,
} from "@/lib/resources";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import LibraryTabs from "@/components/LibraryTabs";

const CATEGORY_KEYS: ResourceCategory[] = [
  "textbook",
  "workbook",
  "term_plan",
  "presentation",
  "worksheet",
  "student_list",
  "grade_template",
  "schedule",
  "other",
];

function kindIcon(kind: Resource["kind"]) {
  switch (kind) {
    case "pptx":
      return Presentation;
    case "pdf":
      return BookOpen;
    case "image":
      return ImageIcon;
    case "video":
      return Film;
    case "xlsx":
      return FileSpreadsheet;
    default:
      return FileText;
  }
}

export default function ResourcesPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const [term, setTerm] = useState<Term | 0>(0);
  const [unitId, setUnitId] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [classifying, setClassifying] = useState<Resource | null>(null);
  const [previewing, setPreviewing] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const resources = useLiveQuery(async () => db.resources.toArray());
  const units = useLiveQuery(async () =>
    (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order)
  );

  const visible = useMemo(
    () => (resources ? filterResources(resources, { query, category, term, unitId }) : undefined),
    [resources, query, category, term, unitId]
  );

  async function handleFiles(files: FileList | File[], handles?: (FileSystemFileHandle | undefined)[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const handle = handles?.[i];
      if (!handle && file.size > MAX_BLOB_BYTES) {
        show(s.resources.tooBig(file.name), { kind: "danger" });
        continue;
      }
      await addResource({ file, handle, category: category === "all" ? "other" : category, term: term || undefined, unitId: unitId || undefined });
      ok++;
    }
    setBusy(false);
    if (ok > 0) show(s.resources.uploaded(fmtNum(ok, numerals)));
  }

  /** الرفع عبر المنتقي — بمقابض إن توفرت (الملف يبقى في مكانه §7) */
  async function pickFiles() {
    if (supportsFileHandles()) {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true });
        const files = await Promise.all(handles.map((h) => h.getFile()));
        await handleFiles(files, handles);
      } catch {
        // أغلقت المنتقي — لا شيء
      }
    } else {
      fileInput.current?.click();
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];
    const handles: (FileSystemFileHandle | undefined)[] = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      let handle: FileSystemFileHandle | undefined;
      if ("getAsFileSystemHandle" in item) {
        const h = await (item as DataTransferItem & { getAsFileSystemHandle: () => Promise<FileSystemHandle | null> }).getAsFileSystemHandle();
        if (h?.kind === "file") handle = h as FileSystemFileHandle;
      }
      const file = handle ? await handle.getFile() : item.getAsFile();
      if (file) {
        files.push(file);
        handles.push(handle);
      }
    }
    await handleFiles(files, handles);
  }

  async function handleDelete() {
    if (!deleting) return;
    const id = deleting.id!;
    await db.resources.update(id, { deletedAt: Date.now() });
    show(s.resources.deleted(deleting.title), {
      kind: "danger",
      undo: async () => {
        await db.resources.update(id, { deletedAt: undefined });
      },
    });
    setDeleting(null);
  }

  return (
    <div className="space-y-5">
      <LibraryTabs />
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <FolderOpen className="size-7" aria-hidden />
          {s.resources.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.resources.subtitle}</p>
      </div>

      {/* القاعدة الإلزامية §2-و */}
      <p className="card flex items-start gap-3 border-teal bg-teal-bg text-teal-dark">
        <ShieldCheck className="mt-1 size-6 shrink-0" aria-hidden />
        <span>{s.resources.aiRule}</span>
      </p>

      {/* منطقة الرفع */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => void handleDrop(e)}
        className={
          "card flex flex-col items-center gap-3 border-2 border-dashed py-8 text-center transition-colors " +
          (dragging ? "border-teal bg-teal-bg" : "border-line")
        }
      >
        <Upload className="size-10 text-ink-soft" aria-hidden />
        <p className="text-ink-soft">{s.resources.dropHint}</p>
        <button type="button" onClick={() => void pickFiles()} disabled={busy} className="btn-primary disabled:opacity-50">
          <Upload className="size-5" aria-hidden />
          {busy ? s.resources.uploading : s.resources.upload}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          aria-label={s.resources.upload}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* البحث والفلاتر */}
      <div className="card space-y-3">
        <label className="flex min-h-touch items-center gap-2 rounded-card border-2 border-line px-3 focus-within:border-teal">
          <Search className="size-5 text-ink-soft" aria-hidden />
          <span className="sr-only">{s.a11y.search}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.resources.searchPlaceholder}
            className="min-h-touch w-full bg-transparent outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label={s.resources.title}>
          <button
            type="button"
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
            className={
              "btn px-4 " +
              (category === "all" ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")
            }
          >
            {s.resources.filterAll}
          </button>
          {CATEGORY_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={
                "btn px-4 " +
                (category === c ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")
              }
            >
              {s.resources.categories[c]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-ink-soft">{s.resources.term}:</span>
            <select
              value={term}
              onChange={(e) => setTerm(Number(e.target.value) as Term | 0)}
              className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal"
            >
              <option value={0}>{s.resources.filterAll}</option>
              <option value={1}>{s.common.term1}</option>
              <option value={2}>{s.common.term2}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-soft">{s.resources.unit}:</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(Number(e.target.value))}
              className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal"
            >
              <option value={0}>{s.resources.filterAll}</option>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* القائمة */}
      {visible === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={FolderOpen} title={s.resources.empty} hint={s.resources.emptyHint} />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const Icon = kindIcon(r.kind);
            const snippet = query ? searchSnippet(r, query) : null;
            return (
              <li key={r.id} className="card flex flex-wrap items-center gap-3">
                <Icon className="size-8 shrink-0 text-teal-dark" aria-hidden />
                <div className="me-auto min-w-0">
                  <p className="truncate text-lg font-bold">{r.title}</p>
                  <p className="text-sm text-ink-soft">
                    {s.resources.categories[r.category]}
                    {r.term ? ` · ${r.term === 1 ? s.common.term1 : s.common.term2}` : ""}
                    {r.extractedSlides?.length
                      ? ` · ${s.resources.pagesCount(fmtNum(r.extractedSlides.length, numerals))}`
                      : ""}
                  </p>
                  {snippet && (
                    <p className="mt-1 rounded-card bg-gold-bg px-2 py-1 text-sm text-gold-dark">
                      {s.resources.foundIn}: {snippet}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPreviewing(r)} className="btn-secondary px-4">
                    <Eye className="size-5" aria-hidden />
                    {s.resources.preview}
                  </button>
                  {(r.kind === "pptx" || r.kind === "doc") && (
                    <Link to={`/studio/${r.id}`} className="btn bg-maroon text-white hover:bg-maroon-dark px-4">
                      <Wand2 className="size-5" aria-hidden />
                      {s.resources.openStudio}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setClassifying(r)}
                    className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal"
                  >
                    <Tag className="size-5" aria-hidden />
                    {s.resources.classify}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(r)}
                    aria-label={s.common.delete}
                    className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg"
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {classifying && (
        <ClassifyDialog resource={classifying} onClose={() => setClassifying(null)} />
      )}
      {previewing && <PreviewDialog resource={previewing} onClose={() => setPreviewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title={s.resources.confirmDeleteTitle}
          body={s.resources.confirmDeleteBody(deleting.title)}
          confirmLabel={s.common.delete}
          onConfirm={() => void handleDelete()}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/** حوار التصنيف: النوع + الفصل + الوحدة + الدرس */
function ClassifyDialog({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [category, setCategory] = useState<ResourceCategory>(resource.category);
  const [term, setTerm] = useState<Term | 0>(resource.term ?? 0);
  const [unitId, setUnitId] = useState<number>(resource.unitId ?? 0);
  const [lessonId, setLessonId] = useState<number>(resource.lessonId ?? 0);

  const units = useLiveQuery(async () =>
    (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order)
  );
  const lessons = useLiveQuery(
    async () =>
      unitId
        ? (await db.lessons.where("unitId").equals(unitId).toArray())
            .filter((l) => !l.deletedAt)
            .sort((a, b) => a.order - b.order)
        : [],
    [unitId]
  );

  async function save() {
    await db.resources.update(resource.id!, {
      category,
      term: term || undefined,
      unitId: unitId || undefined,
      lessonId: lessonId || undefined,
      updatedAt: Date.now(),
    });
    show(s.toast.saved);
    onClose();
  }

  const selectCls = "min-h-touch w-full rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <Modal title={s.resources.classifyTitle(resource.title)} onClose={onClose}>
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="font-medium">{s.resources.classify}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ResourceCategory)} className={selectCls}>
            {CATEGORY_KEYS.map((c) => (
              <option key={c} value={c}>
                {s.resources.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="font-medium">{s.resources.term}</span>
          <select value={term} onChange={(e) => setTerm(Number(e.target.value) as Term | 0)} className={selectCls}>
            <option value={0}>{s.resources.noTerm}</option>
            <option value={1}>{s.common.term1}</option>
            <option value={2}>{s.common.term2}</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="font-medium">{s.resources.unit}</span>
          <select
            value={unitId}
            onChange={(e) => {
              setUnitId(Number(e.target.value));
              setLessonId(0);
            }}
            className={selectCls}
          >
            <option value={0}>{s.resources.noUnit}</option>
            {units?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </label>
        {unitId > 0 && (
          <label className="block space-y-2">
            <span className="font-medium">{s.resources.lesson}</span>
            <select value={lessonId} onChange={(e) => setLessonId(Number(e.target.value))} className={selectCls}>
              <option value={0}>{s.resources.noLesson}</option>
              {lessons?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn border-2 border-line bg-white text-ink">
            {s.common.cancel}
          </button>
          <button type="button" onClick={() => void save()} className="btn-primary">
            {s.common.save}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** معاينة سريعة: صورة/PDF/فيديو من الملف نفسه، ونص الشرائح للعروض والمستندات */
function PreviewDialog({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const s = useStrings();
  const [url, setUrl] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const needsFile = resource.kind === "image" || resource.kind === "pdf" || resource.kind === "video";

  async function loadFile() {
    setLoading(true);
    const blob = await readResourceFile(resource);
    setLoading(false);
    if (!blob) {
      setDenied(true);
      return;
    }
    setUrl(URL.createObjectURL(blob));
  }

  // للعروض والمستندات نعرض النص المستخرج مباشرة — لا حاجة للملف
  const slides = resource.extractedSlides;

  return (
    <Modal title={resource.title} onClose={() => { if (url) URL.revokeObjectURL(url); onClose(); }} wide>
      <div className="space-y-4">
        {needsFile && !url && (
          <div className="space-y-3 text-center">
            {denied && <p className="text-danger">{s.resources.permissionNeeded}</p>}
            <button type="button" onClick={() => void loadFile()} disabled={loading} className="btn-primary">
              <Eye className="size-5" aria-hidden />
              {loading ? s.common.loading : s.resources.preview}
            </button>
          </div>
        )}
        {url && resource.kind === "image" && (
          <img src={url} alt={resource.title} className="max-h-[60dvh] w-full rounded-card object-contain" />
        )}
        {url && resource.kind === "pdf" && (
          <iframe src={url} title={resource.title} className="h-[60dvh] w-full rounded-card border border-line" />
        )}
        {url && resource.kind === "video" && (
          <video src={url} controls className="max-h-[60dvh] w-full rounded-card">
            <track kind="captions" />
          </video>
        )}
        {!needsFile &&
          (slides && slides.length > 0 ? (
            <ol className="max-h-[60dvh] space-y-3 overflow-y-auto">
              {slides.map((text, i) => (
                <li key={i} className="rounded-card border border-line bg-cream p-4">
                  <p className="mb-1 text-sm font-bold text-ink-soft">{s.studio.slideN(String(i + 1))}</p>
                  <p>{text || s.studio.noText}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-soft">{s.resources.previewUnavailable}</p>
          ))}
      </div>
    </Modal>
  );
}
