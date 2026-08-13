/**
 * استوديو العروض البصرية (زكريت م٣):
 * درس + مصادر ← «ما سيُرسل» ← توليد JSON صارم ← مسودة قابلة للتحرير
 * (نص، ترتيب، حذف) بفاحص جودة يفرض «النص وحده مرفوض» ← اعتماد.
 * لا يظهر شيء للفصل قبل الاعتماد، والأصل المولَّد يبقى مسودة محفوظة.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDown, ArrowUp, BadgeCheck, Download, Presentation as PresentationIcon,
  Printer, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { db } from "@/db";
import type { Presentation, VisualSlide } from "@/db/schema";
import { ALL_KITS } from "@/content/lessonKits";
import { generateSlides, AiClientError } from "@/lib/aiClient";
import type { AskSource } from "@/lib/aiClient";
import { kitToSource, resourceToSource } from "@/lib/curriculumSources";
import { qualityCheck } from "@/lib/slides";
import { downloadSlidesPptx } from "@/lib/slidesPptx";
import { printSlides } from "@/lib/slidesPrint";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import LibraryTabs from "@/components/LibraryTabs";
import SlideVisual from "@/components/slides/SlideVisual";
import SendPreviewDialog from "@/components/SendPreviewDialog";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function SlidesStudioPage() {
  const s = useStrings();
  const [params] = useSearchParams();
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName);
  const show = useToast((x) => x.show);

  const lessons = useLiveQuery(async () =>
    (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.unitId - b.unitId || a.order - b.order)
  );
  const fileSources = useLiveQuery(async () =>
    (await db.resources.toArray()).filter((r) => !r.deletedAt && (r.searchText?.trim() || r.extractedSlides?.length))
  );

  const [lessonId, setLessonId] = useState<number | undefined>(() => {
    const q = Number(params.get("lesson"));
    return Number.isFinite(q) && q > 0 ? q : undefined;
  });
  const lesson = (lessons ?? []).find((l) => l.id === lessonId);

  /** آخر عرض محفوظ لهذا الدرس (مسودة أو معتمد) */
  const saved = useLiveQuery(async () => {
    if (lessonId === undefined) return undefined;
    const list = (await db.presentations.where("lessonId").equals(lessonId).toArray()).filter((p) => !p.deletedAt);
    return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null;
  }, [lessonId]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ content: string; sources: AskSource[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorAr, setErrorAr] = useState<string | null>(null);
  const [genLine, setGenLine] = useState<string | null>(null);
  /** المسودة قيد التحرير (غير المحفوظة بعد) — أو null فنعرض المحفوظ */
  const [draft, setDraft] = useState<Presentation | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  const current: Presentation | null = draft ?? (saved || null);
  const report = current ? qualityCheck(current.slides) : null;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildSources(): AskSource[] {
    const out: AskSource[] = [];
    // درس الحزمة المختار نفسه مصدر تلقائي إن وُجدت حزمته
    const kit = lesson ? ALL_KITS.find((k) => k.lessonTitle === lesson.title) : undefined;
    if (kit) out.push(kitToSource(kit));
    for (const key of selected) {
      if (key.startsWith("r:")) {
        const r = (fileSources ?? []).find((x) => String(x.id) === key.slice(2));
        if (r) out.push(resourceToSource(r));
      }
    }
    return out;
  }

  function openPreview() {
    setErrorAr(null);
    if (!lesson) return;
    const sources = buildSources();
    if (sources.length === 0) {
      show(s.ask.noSources, { kind: "info" });
      return;
    }
    const content = [`توليد عرض بصري لدرس: ${lesson.title}`, "", ...sources.map((src) => `— المصدر: ${src.name}\n${src.text}`)].join("\n");
    setPreview({ content, sources });
  }

  async function generateApproved(sendLogId: number) {
    if (!preview || !lesson) return;
    const sources = preview.sources;
    setPreview(null);
    setBusy(true);
    setGenLine(null);
    try {
      const r = await generateSlides(lesson.title, sources);
      const now = Date.now();
      setDraft({
        lessonId: lesson.id,
        title: lesson.title,
        slides: r.slides,
        status: "draft",
        sourceNames: sources.map((x) => x.name),
        generatedBy: `${r.provider} · ${r.model}`,
        createdAt: now,
        updatedAt: now,
      });
      setGenLine(
        r.cached ? s.slides.fromCache : s.slides.generatedByLine(s.ask.providers[r.provider], fmtNum(r.costUsd, numerals))
      );
      await db.aiSendLog.update(sendLogId, { status: "sent", note: `${r.provider} · ~${r.costUsd}$` });
    } catch (e) {
      const msg = e instanceof AiClientError ? e.messageAr : s.errors.generic;
      setErrorAr(msg);
      await db.aiSendLog.update(sendLogId, { status: "failed", note: msg });
    } finally {
      setBusy(false);
    }
  }

  /** تعديل شريحة في المسودة الحالية (ينسخ المحفوظ لمسودة عند أول تعديل) */
  function mutate(fn: (slides: VisualSlide[]) => VisualSlide[]) {
    const base = current;
    if (!base) return;
    setDraft({ ...base, slides: fn([...base.slides]), status: "draft", updatedAt: Date.now() });
  }

  async function persist(status: "draft" | "approved") {
    const base = current;
    if (!base) return;
    const record: Presentation = { ...base, status, updatedAt: Date.now() };
    if (record.id != null) await db.presentations.put(record);
    else record.id = (await db.presentations.add(record)) as number;
    setDraft(null);
    show(status === "approved" ? s.slides.approved : s.slides.draftSaved);
  }

  const n = (v: number) => fmtNum(v, numerals);

  return (
    <div className="space-y-5">
      <LibraryTabs />

      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Wand2 className="size-7" aria-hidden />
          {s.slides.studioTitle}
        </h1>
        <p className="mt-1 text-ink-soft">{s.slides.subtitle}</p>
      </div>

      {/* الإعداد */}
      <section className="card space-y-3">
        <label className="block space-y-1">
          <span className="font-medium">{s.slides.pickLesson}</span>
          <select
            value={lessonId ?? ""}
            onChange={(e) => {
              setLessonId(e.target.value ? Number(e.target.value) : undefined);
              setDraft(null);
              setGenLine(null);
            }}
            className="w-full rounded-card border-2 border-line p-3 focus:border-teal"
          >
            <option value="">—</option>
            {(lessons ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </label>

        {(fileSources ?? []).length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">{s.ask.fileGroup}</p>
            <div className="flex flex-wrap gap-2">
              {(fileSources ?? []).map((r) => {
                const key = `r:${r.id}`;
                const on = selected.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(key)}
                    className={
                      "min-h-touch rounded-pill border-2 px-3 font-medium transition-colors " +
                      (on ? "border-teal bg-teal text-white" : "border-line bg-white text-ink-soft hover:border-teal hover:bg-teal-bg")
                    }
                  >
                    {r.title || r.fileName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={openPreview}
          disabled={busy || !lesson}
          className="btn-primary w-full min-h-[56px] text-lg disabled:opacity-50"
        >
          <Sparkles className="size-6" aria-hidden />
          {busy ? s.slides.generating : current ? s.slides.regenerate : s.slides.generate}
        </button>
        {genLine && <p className="text-sm text-ink-soft">{genLine}</p>}
        {errorAr && (
          <p role="alert" className="rounded-card bg-danger-bg p-3 font-medium text-danger">{errorAr}</p>
        )}
      </section>

      {/* المسودة/المعتمد */}
      {current === null || current === undefined ? (
        <p className="card text-ink-soft">{s.slides.empty}</p>
      ) : (
        <>
          {/* شريط الحالة والإجراءات */}
          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={
                  "rounded-pill px-4 py-1 font-bold " +
                  (current.status === "approved" && !draft ? "bg-teal-bg text-teal-dark" : "bg-gold-bg text-gold-dark")
                }
              >
                {current.status === "approved" && !draft ? s.slides.approvedBadge : s.slides.draftBadge}
              </span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void persist("approved")} className="btn-primary">
                  <BadgeCheck className="size-5" aria-hidden />
                  {s.slides.approve}
                </button>
                {draft && (
                  <button type="button" onClick={() => void persist("draft")} className="btn-secondary">
                    {s.slides.saveDraft}
                  </button>
                )}
                {current.id != null && current.status === "approved" && !draft && (
                  <Link to={`/slides/${current.id}/present`} className="btn bg-ink text-white hover:bg-black">
                    <PresentationIcon className="size-5" aria-hidden />
                    {s.slides.present}
                  </Link>
                )}
                <button type="button" onClick={() => void downloadSlidesPptx(current, schoolName || "مدرستي")} className="btn-secondary">
                  <Download className="size-5" aria-hidden />
                  {s.slides.exportPptx}
                </button>
                <button type="button" onClick={() => printSlides(current, schoolName || "مدرستي")} className="btn-secondary">
                  <Printer className="size-5" aria-hidden />
                  {s.slides.print}
                </button>
              </div>
            </div>

            {/* فاحص الجودة */}
            {report && (
              <div className={"rounded-card border-2 p-3 " + (report.ok ? "border-ok bg-teal-bg" : "border-gold bg-gold-bg")}>
                <p className="font-bold">{s.slides.quality}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  <li>{report.visualOk ? "✓" : "⚠"} {s.slides.qualityVisual(n(report.visualPct))}</li>
                  <li>
                    {report.wordsOk ? "✓ " + s.slides.qualityWords : "⚠ " + s.slides.qualityWordy(report.wordySlides.join("، "))}
                  </li>
                  <li>{report.interactionOk ? "✓" : "⚠"} {s.slides.qualityInteraction(n(report.maxGapWithoutInteraction))}</li>
                  {!report.sourcesOk && <li>⚠ {s.slides.qualityUnsourced(report.unsourced.join("، "))}</li>}
                  {report.ok && report.sourcesOk && <li className="font-bold text-teal-dark">{s.slides.qualityAllOk}</li>}
                </ul>
              </div>
            )}
          </section>

          {/* الشرائح: معاينة + تحرير */}
          <ol className="space-y-4">
            {current.slides.map((sl, i) => (
              <li key={i} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-ink-soft">{s.slides.slideN(n(i + 1))} · {sl.layout}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => mutate((a) => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })} aria-label={s.slides.moveUp} className="flex min-h-touch min-w-touch items-center justify-center rounded-card hover:bg-cream disabled:opacity-30">
                      <ArrowUp className="size-5" aria-hidden />
                    </button>
                    <button type="button" disabled={i === current.slides.length - 1} onClick={() => mutate((a) => { [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; })} aria-label={s.slides.moveDown} className="flex min-h-touch min-w-touch items-center justify-center rounded-card hover:bg-cream disabled:opacity-30">
                      <ArrowDown className="size-5" aria-hidden />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteIdx(i)} aria-label={s.slides.deleteSlide} className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg">
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="rounded-card border-2 border-line bg-cream/60 p-4">
                  <SlideVisual slide={sl} variant="preview" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{s.slides.editTitle}</span>
                    <input
                      value={sl.title}
                      onChange={(e) => mutate((a) => { a[i] = { ...a[i], title: e.target.value }; return a; })}
                      className="w-full rounded-card border-2 border-line p-2 focus:border-teal"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{s.slides.editSay}</span>
                    <input
                      value={sl.note.say}
                      onChange={(e) => mutate((a) => { a[i] = { ...a[i], note: { ...a[i].note, say: e.target.value } }; return a; })}
                      className="w-full rounded-card border-2 border-line p-2 focus:border-teal"
                    />
                  </label>
                  {sl.bullets && (
                    <label className="block space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">{s.slides.editBullets}</span>
                      <textarea
                        value={sl.bullets.join("\n")}
                        rows={Math.min(5, sl.bullets.length + 1)}
                        onChange={(e) => mutate((a) => { a[i] = { ...a[i], bullets: e.target.value.split("\n").filter((x) => x.trim()) }; return a; })}
                        className="w-full rounded-card border-2 border-line p-2 focus:border-teal"
                      />
                    </label>
                  )}
                </div>

                {(sl.note.ask || sl.note.expected || sl.note.misconception) && (
                  <details className="text-sm text-ink-soft">
                    <summary className="cursor-pointer font-medium text-teal-dark">{s.slides.teacherNotes}</summary>
                    <ul className="mt-1 space-y-1">
                      {sl.note.ask && <li>{s.slides.noteAsk}: {sl.note.ask}</li>}
                      {sl.note.expected && <li>{s.slides.noteExpected}: {sl.note.expected}</li>}
                      {sl.note.misconception && <li>{s.slides.noteMisconception}: {sl.note.misconception}</li>}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {preview && lesson && (
        <SendPreviewDialog
          kind="generation"
          title={`عرض بصري: ${lesson.title}`}
          content={preview.content}
          onApproved={(id) => void generateApproved(id)}
          onClose={() => setPreview(null)}
        />
      )}

      {confirmDeleteIdx !== null && current && (
        <ConfirmDialog
          title={s.slides.deleteSlide}
          body={s.slides.confirmDelete(current.slides[confirmDeleteIdx].title)}
          confirmLabel={s.common.delete}
          onConfirm={() => {
            mutate((a) => { a.splice(confirmDeleteIdx, 1); return a; });
            setConfirmDeleteIdx(null);
          }}
          onClose={() => setConfirmDeleteIdx(null)}
        />
      )}
    </div>
  );
}
