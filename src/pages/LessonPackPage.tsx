/**
 * حزمة الحصة الكاملة (١٥/١٠) — قلب وعد الماستر برومبت:
 * أي درس (حتى بلا حزمة يدوية) ← «ما سيُرسل» ← توليد كامل من المصادر ←
 * مراجعة ← اعتماد يُدخل الأسئلة بنكَ الأسئلة فتعمل الألعاب وأوراق العمل فوراً.
 * الاعتماد قابل للتراجع (يسحب أسئلته من البنك كوحدة واحدة).
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BadgeCheck, ClipboardList, FlaskConical, HelpCircle, Home as HomeIcon,
  Lightbulb, ListChecks, Package, Printer, RotateCcw, Sparkles, Timer, Users, Wand2,
} from "lucide-react";
import { db } from "@/db";
import type { LessonPackContent, LessonPackRecord } from "@/db/schema";
import { ALL_KITS } from "@/content/lessonKits";
import { bookLessonByCode } from "@/content/bookG05S1P1";
import { enrichmentByCode } from "@/content/enrichment";
import { AiClientError, generateLessonPack, type AskSource } from "@/lib/aiClient";
import { lessonBookSources, lessonMetaSource } from "@/lib/bookRetrieval";
import { enrichmentToSource, kitToSource, resourceToSource } from "@/lib/curriculumSources";
import { packToQuestions, planMinutes } from "@/lib/lessonPack";
import { downloadMinistryPlanForLesson } from "@/lib/ministryPlan";
import { printLessonPack } from "@/lib/packPrint";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import SendPreviewDialog from "@/components/SendPreviewDialog";

export default function LessonPackPage() {
  const s = useStrings();
  const [params] = useSearchParams();
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName);
  const show = useToast((x) => x.show);

  const lessonId = Number(params.get("lesson"));
  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId]);
  const fileSources = useLiveQuery(async () =>
    (await db.resources.toArray()).filter((r) => !r.deletedAt && (r.searchText?.trim() || r.extractedSlides?.length))
  );
  const saved = useLiveQuery(async () => {
    const list = (await db.lessonPacks.where("lessonId").equals(lessonId).toArray()).filter((p) => !p.deletedAt);
    return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null;
  }, [lessonId]);

  const [preview, setPreview] = useState<{ content: string; sources: AskSource[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorAr, setErrorAr] = useState<string | null>(null);
  const [genLine, setGenLine] = useState<string | null>(null);
  const [draft, setDraft] = useState<LessonPackRecord | null>(null);

  const current: LessonPackRecord | null = draft ?? (saved || null);
  const n = (v: number) => fmtNum(v, numerals);

  /** مصادر التوليد: صفحات الدرس من كتاب الوزارة + إثراؤه المقرَّر + ملفاتها */
  async function buildSources(): Promise<AskSource[]> {
    if (!lesson) return [];
    const out: AskSource[] = [];
    if (lesson.code) {
      const found = bookLessonByCode(lesson.code);
      if (found) out.push(lessonMetaSource(found.unit, found.lesson));
      out.push(...(await lessonBookSources(lesson.code)));
      const enrichment = enrichmentByCode(lesson.code);
      if (enrichment) out.push(enrichmentToSource(enrichment));
    } else {
      const kit = ALL_KITS.find((k) => k.lessonTitle === lesson.title);
      if (kit) out.push(kitToSource(kit));
    }
    for (const r of fileSources ?? []) out.push(resourceToSource(r));
    return out.slice(0, 12);
  }

  async function openPreview() {
    if (!lesson) return;
    setErrorAr(null);
    const sources = await buildSources();
    if (sources.length === 0) {
      show(s.ask.noSources, { kind: "info" });
      return;
    }
    const content = [`توليد حزمة حصة كاملة لدرس: ${lesson.title}`, "", ...sources.map((src) => `— المصدر: ${src.name}${src.locator ? ` (${src.locator})` : ""}\n${src.text}`)].join("\n");
    setPreview({ content, sources });
  }

  async function generateApproved(sendLogId: number) {
    if (!preview || !lesson) return;
    const sources = preview.sources;
    setPreview(null);
    setBusy(true);
    try {
      const r = await generateLessonPack(lesson.title, sources);
      const now = Date.now();
      setDraft({
        lessonId,
        title: lesson.title,
        content: r.pack,
        status: "draft",
        sourceNames: sources.map((x) => x.name),
        generatedBy: `${r.provider} · ${r.model}`,
        createdAt: now,
        updatedAt: now,
      });
      setGenLine(r.cached ? s.pack.fromCache : s.pack.generatedByLine(s.ask.providers[r.provider], n(r.costUsd)));
      await db.aiSendLog.update(sendLogId, { status: "sent", note: `${r.provider} · ~${r.costUsd}$` });
    } catch (e) {
      const msg = e instanceof AiClientError ? e.messageAr : s.errors.generic;
      setErrorAr(msg);
      await db.aiSendLog.update(sendLogId, { status: "failed", note: msg });
    } finally {
      setBusy(false);
    }
  }

  /** الاعتماد: حفظ الحزمة + إدخال أسئلتها البنك (مع أرقامها للتراجع) */
  async function approve() {
    if (!current || !lesson) return;
    const now = Date.now();
    const rows = packToQuestions(current.content, { unitId: lesson.unitId, lessonId }, now);
    const insertedIds = (await db.questions.bulkAdd(rows as never[], { allKeys: true })) as number[];
    const record: LessonPackRecord = { ...current, status: "approved", insertedQuestionIds: insertedIds, updatedAt: now };
    if (record.id != null) await db.lessonPacks.put(record);
    else record.id = (await db.lessonPacks.add(record)) as number;
    setDraft(null);
    show(s.pack.approvedMsg(n(insertedIds.length)));
  }

  /** التراجع عن الاعتماد: سحب أسئلته من البنك كوحدة واحدة */
  async function unapprove() {
    if (!saved || saved.status !== "approved") return;
    const ids = saved.insertedQuestionIds ?? [];
    const now = Date.now();
    await db.questions.where("id").anyOf(ids).modify({ deletedAt: now });
    await db.lessonPacks.put({ ...saved, status: "draft", insertedQuestionIds: undefined, updatedAt: now });
    show(s.pack.unapproved, { kind: "info" });
  }

  if (!lesson) return <p className="card text-ink-soft">{s.common.loading}</p>;
  const pack: LessonPackContent | null = current?.content ?? null;
  const approved = current?.status === "approved" && !draft;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
            <Package className="size-7" aria-hidden />
            {s.pack.title}: {lesson.title}
          </h1>
          <p className="mt-1 text-ink-soft">{s.pack.subtitle}</p>
        </div>
        <Link to={`/library/${lessonId}`} className="btn-secondary">
          <HomeIcon className="size-5" aria-hidden />
          {s.common.back}
        </Link>
      </div>

      {/* التوليد */}
      <section className="card space-y-3">
        <button type="button" onClick={() => void openPreview()} disabled={busy} className="btn-primary w-full min-h-[56px] text-lg disabled:opacity-50">
          <Sparkles className="size-6" aria-hidden />
          {busy ? s.pack.generating : pack ? s.pack.regenerate : s.pack.generate}
        </button>
        {genLine && <p className="text-sm text-ink-soft">{genLine}</p>}
        {errorAr && <p role="alert" className="rounded-card bg-danger-bg p-3 font-medium text-danger">{errorAr}</p>}
      </section>

      {pack && current && (
        <>
          {/* الحالة والإجراءات */}
          <section className="card flex flex-wrap items-center justify-between gap-3">
            <span className={"rounded-pill px-4 py-1 font-bold " + (approved ? "bg-teal-bg text-teal-dark" : "bg-gold-bg text-gold-dark")}>
              {approved ? s.pack.approvedBadge : s.pack.draftBadge}
            </span>
            <div className="flex flex-wrap gap-2">
              {!approved && (
                <button type="button" onClick={() => void approve()} className="btn-primary">
                  <BadgeCheck className="size-5" aria-hidden />
                  {s.pack.approve}
                </button>
              )}
              {approved && (
                <button type="button" onClick={() => void unapprove()} className="btn border-2 border-danger bg-white text-danger hover:bg-danger-bg">
                  <RotateCcw className="size-5" aria-hidden />
                  {s.pack.unapprove}
                </button>
              )}
              <button type="button" onClick={() => printLessonPack(lesson.title, pack, schoolName || "مدرستي")} className="btn-secondary">
                <Printer className="size-5" aria-hidden />
                {s.pack.print}
              </button>
              <button
                type="button"
                onClick={() => void downloadMinistryPlanForLesson(lesson, pack).then(() => show(s.library.downloaded))}
                className="btn-secondary"
              >
                <ClipboardList className="size-5" aria-hidden />
                {s.pack.ministryPlan}
              </button>
              <Link to={`/slides?lesson=${lessonId}`} className="btn-secondary">
                <Wand2 className="size-5" aria-hidden />
                {s.pack.alsoSlides}
              </Link>
            </div>
          </section>

          {approved && (
            <p className="card border-2 border-teal bg-teal-bg font-medium text-teal-dark">{s.pack.afterApprove}</p>
          )}

          {/* خطة الحصة */}
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <Timer className="size-6 text-teal-dark" aria-hidden />
              {s.pack.sections.plan} · {s.pack.planTotal(n(planMinutes(pack)))}
            </h2>
            <ul className="space-y-1">
              {pack.plan.objectives.map((o, i) => (
                <li key={i} className="flex items-start gap-2 rounded-card bg-teal-bg px-3 py-1.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-bold text-white">{n(i + 1)}</span>
                  {o}
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto rounded-card border-2 border-line">
              <table className="w-full text-start">
                <thead><tr className="bg-teal text-white"><th className="p-2">المرحلة</th><th className="p-2">الزمن</th><th className="p-2">ماذا يحدث</th></tr></thead>
                <tbody>
                  {pack.plan.stages.map((st, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-cream" : ""}>
                      <td className="border-t border-line p-2 font-bold">{st.name}</td>
                      <td className="border-t border-line p-2 text-center whitespace-nowrap">{s.pack.minutesShort(n(st.minutes))}</td>
                      <td className="border-t border-line p-2">{st.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* الافتتاحي + النقاش */}
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <Lightbulb className="size-6 text-gold-dark" aria-hidden />
              {s.pack.sections.opener} ({s.pack.minutesShort(n(pack.opener.minutes))}): {pack.opener.title}
            </h2>
            <p className="rounded-card bg-gold-bg p-3">{pack.opener.text}</p>
            <h3 className="font-bold">{s.pack.sections.discussion}:</h3>
            <ul className="list-disc space-y-1 ps-6">{pack.discussion.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </section>

          {/* النشاطان */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <FlaskConical className="size-5 text-teal-dark" aria-hidden />
                {s.pack.sections.individual}: {pack.activityIndividual.title}
              </h2>
              <p className="whitespace-pre-line text-ink-soft">{pack.activityIndividual.text}</p>
            </div>
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <Users className="size-5 text-teal-dark" aria-hidden />
                {s.pack.sections.group}: {pack.activityGroup.title}
              </h2>
              <p className="whitespace-pre-line text-ink-soft">{pack.activityGroup.text}</p>
            </div>
          </section>

          {/* الأسئلة */}
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <ListChecks className="size-6 text-teal-dark" aria-hidden />
              {s.pack.sections.questions}
            </h2>
            <p className="text-sm text-ink-soft">{s.pack.questionsCount(n(pack.questions.length))}</p>
            <ol className="space-y-3">
              {pack.questions.map((q, i) => (
                <li key={i} className="rounded-card border-2 border-line p-3">
                  <p className="font-medium"><b className="text-teal-dark">{n(i + 1)})</b> {q.text}</p>
                  {q.options && (
                    <ul className="mt-1 grid gap-1 ps-6 sm:grid-cols-2">
                      {q.options.map((o) => <li key={o.key}><b className="text-gold-dark">{o.key})</b> {o.text}</li>)}
                    </ul>
                  )}
                  <p className="mt-1 text-sm text-ok">{s.pack.answerLabel}: {q.answer}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* كرت الخروج + الواجب */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <ClipboardList className="size-5 text-teal-dark" aria-hidden />
                {s.pack.sections.exit}
              </h2>
              <ul className="list-disc space-y-1 ps-6">{pack.exitTicket.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
            <div className="card space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
                <HelpCircle className="size-5 text-teal-dark" aria-hidden />
                {s.pack.sections.homework}
              </h2>
              <ul className="list-disc space-y-1 ps-6">{pack.homework.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          </section>

          {/* ملاحظات المعلّمة */}
          <section className="card space-y-3">
            <h2 className="font-heading text-xl font-bold">{s.pack.sections.notes}</h2>
            <p className="rounded-card bg-cream p-3">{pack.teacherNotes.say}</p>
            {pack.teacherNotes.misconceptions.length > 0 && (
              <>
                <h3 className="font-bold text-gold-dark">⚠ {s.pack.sections.misconceptions}:</h3>
                <ul className="list-disc space-y-1 ps-6">{pack.teacherNotes.misconceptions.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </>
            )}
            {pack.teacherNotes.materials.length > 0 && (
              <p className="text-ink-soft"><b>{s.pack.sections.materials}:</b> {pack.teacherNotes.materials.join(" · ")}</p>
            )}
            {pack.sources.length > 0 && (
              <p className="text-sm text-ink-soft">📚 {s.pack.sections.sources}: {pack.sources.join(" · ")}</p>
            )}
          </section>
        </>
      )}

      {preview && (
        <SendPreviewDialog
          kind="generation"
          title={`حزمة حصة: ${lesson.title}`}
          content={preview.content}
          onApproved={(id) => void generateApproved(id)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
