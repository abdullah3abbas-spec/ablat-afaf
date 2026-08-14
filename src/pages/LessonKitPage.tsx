/**
 * صفحة حزمة الدرس — العناصر السبعة، لكل عنصر «افتحي» و«اطبعي» فوريان
 * بلا حوارات (§2-ج)، مع تنزيل PowerPoint/Word حقيقي حيث يلزم.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Award,
  Wand2,
  ClipboardCheck,
  Download,
  Eye,
  FlaskConical,
  Gamepad2,
  ListChecks,
  NotebookPen,
  Presentation,
  Printer,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { db } from "@/db";
import { kitByLessonTitle } from "@/content/lessonKits";
import { bookLessonByCode } from "@/content/bookG05S1P1";
import { enrichmentByCode } from "@/content/enrichment";
import type { LessonKit } from "@/content/kitTypes";
import { elementHtml, printElement, type KitElementKind } from "@/lib/kitPrint";
import { printEnrichmentCards, printEnrichmentSheet } from "@/lib/enrichmentPrint";
import { downloadMinistryPlanForLesson } from "@/lib/ministryPlan";
import { downloadPlanDocx, downloadPptx, downloadWorksheetDocx } from "@/lib/kitFiles";
import { activeStudentsOf } from "@/lib/students";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";

export default function LessonKitPage() {
  const s = useStrings();
  const { lessonId: idParam } = useParams();
  const lessonId = Number(idParam);
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName);
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);

  const [previewHtml, setPreviewHtml] = useState<{ title: string; html: string } | null>(null);

  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId]);
  const kit = lesson ? kitByLessonTitle(lesson.title) : undefined;
  const setLastLesson = useUi((x) => x.setLastLesson);

  // «آخر درس عملتِ عليه» — يظهر في مركز اليوم بزر «متابعة»
  useEffect(() => {
    if (lesson?.id) setLastLesson({ id: lesson.id, title: lesson.title });
  }, [lesson?.id, lesson?.title, setLastLesson]);

  if (!lesson) return <p className="card text-ink-soft">{s.common.loading}</p>;
  if (!kit) {
    const book = lesson.code ? bookLessonByCode(lesson.code) : undefined;
    const enrichment = lesson.code ? enrichmentByCode(lesson.code) : undefined;
    const b = s.library.book;
    const e = s.library.enrichment;
    if (!book) {
      return (
        <div className="space-y-4">
          <EmptyState icon={Presentation} title={s.library.kitMissing} />
          <div className="card space-y-3 border-2 border-teal bg-teal-bg text-center">
            <p className="font-medium text-teal-dark">{s.pack.emptyLesson}</p>
            <Link to={`/pack?lesson=${lessonId}`} className="btn-primary mx-auto">
              <Sparkles className="size-6" aria-hidden />
              {s.pack.button}
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {/* بطاقة الدرس من كتاب الوزارة */}
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="me-auto font-heading text-2xl font-bold text-maroon">
              <span className="me-2">{book.lesson.code}</span>
              {book.lesson.title}
            </h1>
            <span className="rounded-pill bg-cream px-3 py-1 font-medium text-ink-soft">
              {b.pages(fmtNum(book.lesson.pageStart, numerals), fmtNum(book.lesson.pageEnd, numerals))}
            </span>
            {book.lesson.isProject && (
              <span className="rounded-pill bg-gold-bg px-3 py-1 font-medium text-gold-dark">{b.project}</span>
            )}
          </div>
          <p className="text-ink-soft">
            {book.unit.title} · {b.standardsLine(book.lesson.outcomeCodes.join(" · "))}
          </p>
          <div>
            <h2 className="font-heading text-lg font-bold text-teal-dark">{b.objectives}</h2>
            <ul className="mt-1 list-disc space-y-1 ps-6">
              {book.lesson.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          {book.lesson.vocab.length > 0 && (
            <div>
              <h2 className="font-heading text-lg font-bold text-teal-dark">{b.vocab}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {book.lesson.vocab.map((v) => (
                  <span key={v.term} className="rounded-pill border-2 border-line bg-white px-3 py-1">
                    <strong>{v.term}</strong>
                    <span className="ms-2 text-sm text-ink-soft" dir="ltr">{v.en}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* العرض المساعد — الفعل الرئيسي: برزنتيشن الحصة الكامل فوراً */}
        <div className="card-hero text-center">
          <h2 className="font-heading text-2xl font-extrabold">{s.lessonShow.button}</h2>
          <p className="mx-auto mt-1 max-w-xl pb-3 text-white/90">{s.lessonShow.hint}</p>
          <Link
            to={`/show?lesson=${lessonId}`}
            className="btn mx-auto mb-2 min-h-[60px] bg-white px-8 text-xl font-bold text-maroon-dark hover:bg-cream"
          >
            <Presentation className="size-7" aria-hidden />
            {s.lessonShow.button}
          </Link>
        </div>

        {/* إثراء الحصة المقرَّر */}
        {enrichment && (
          <div className="card space-y-3 border-2 border-maroon/30">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="me-auto flex items-center gap-2 font-heading text-xl font-bold text-maroon">
                <Gamepad2 className="size-6" aria-hidden />
                {e.title}: {enrichment.title}
              </h2>
              <span className="rounded-pill bg-maroon px-3 py-1 font-medium text-white">{enrichment.vehicle}</span>
              <span className="rounded-pill bg-cream px-3 py-1 text-sm text-ink-soft">
                {e.minutesBadge(fmtNum(enrichment.minutes, numerals))}
              </span>
            </div>
            <div className="rounded-card bg-teal-bg p-3">
              <p className="font-bold text-teal-dark">{e.whyTitle}</p>
              <p className="mt-1">{enrichment.why}</p>
            </div>
            <div>
              <p className="font-bold text-teal-dark">{e.materialsTitle}</p>
              <ul className="mt-1 list-disc space-y-1 ps-6">
                {enrichment.materials.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-teal-dark">{e.stepsTitle}</p>
              <ol className="mt-1 list-decimal space-y-1 ps-6">
                {enrichment.steps.map((st) => (
                  <li key={st}>{st}</li>
                ))}
              </ol>
            </div>
            {enrichment.story && (
              <div>
                <p className="font-bold text-teal-dark">{e.storyTitle}</p>
                <div className="mt-1 space-y-2 rounded-card bg-cream p-3 leading-relaxed">
                  {enrichment.story.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                </div>
              </div>
            )}
            {enrichment.cards && (
              <div>
                <p className="font-bold text-teal-dark">{e.cardsTitle}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {enrichment.cards.map((c) => (
                    <span key={c.slice(0, 24)} className="rounded-card border-2 border-dashed border-maroon/40 bg-white px-3 py-2 text-sm">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="font-bold text-teal-dark">{e.debriefTitle}</p>
              <ol className="mt-1 list-decimal space-y-1 ps-6">
                {enrichment.debrief.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  printEnrichmentSheet(enrichment, schoolName || "مدرستي", lesson.title);
                  show(e.printed);
                }}
                className="btn-primary"
              >
                <Printer className="size-5" aria-hidden />
                {e.printSheet}
              </button>
              {enrichment.cards && (
                <button
                  type="button"
                  onClick={() => {
                    printEnrichmentCards(enrichment, schoolName || "مدرستي", lesson.title);
                    show(e.printed);
                  }}
                  className="btn-secondary"
                >
                  <Printer className="size-5" aria-hidden />
                  {e.printCards}
                </button>
              )}
            </div>
          </div>
        )}

        {/* حزمة الحصة الكاملة بالذكاء — من صفحات الكتاب نفسها */}
        <div className="card space-y-3 border-2 border-teal bg-teal-bg text-center">
          <p className="font-medium text-teal-dark">{s.pack.emptyLesson}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={`/pack?lesson=${lessonId}`} className="btn-primary">
              <Sparkles className="size-6" aria-hidden />
              {s.pack.button}
            </Link>
            <button
              type="button"
              onClick={() => void downloadMinistryPlanForLesson(lesson).then(() => show(s.library.downloaded))}
              className="btn-secondary"
            >
              <Download className="size-5" aria-hidden />
              {s.pack.ministryPlan}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const info = { schoolName: schoolName || "مدرستي" };

  async function studentNames(): Promise<string[]> {
    if (!currentClassId) return [];
    return (await activeStudentsOf(currentClassId)).sort((a, b) => a.rollNumber - b.rollNumber).map((st) => st.name);
  }

  async function doPrint(kind: KitElementKind) {
    printElement(kind, kit as LessonKit, info, await studentNames());
    show(s.library.printedElement);
  }

  async function doOpen(kind: KitElementKind, title: string) {
    setPreviewHtml({ title, html: elementHtml(kind, kit as LessonKit, info, await studentNames()) });
  }

  const k = kit;
  const elements: {
    kind: KitElementKind;
    title: string;
    badge: string;
    icon: typeof Presentation;
    extraDownload?: () => Promise<void>;
    downloadLabel?: string;
  }[] = [
    {
      kind: "slides",
      title: s.library.elements.slides,
      badge: s.library.slidesCount(fmtNum(k.slides.length + 1, numerals)),
      icon: Presentation,
      extraDownload: () => downloadPptx(k),
      downloadLabel: s.library.downloadPptx,
    },
    {
      kind: "worksheet",
      title: s.library.elements.worksheet,
      badge: s.library.questionsCount(fmtNum(k.worksheet.length, numerals)),
      icon: NotebookPen,
      extraDownload: () => downloadWorksheetDocx(k, false),
      downloadLabel: s.library.downloadDocx,
    },
    {
      kind: "answers",
      title: s.library.elements.answers,
      badge: s.library.questionsCount(fmtNum(k.worksheet.length, numerals)),
      icon: ClipboardCheck,
      extraDownload: () => downloadWorksheetDocx(k, true),
      downloadLabel: s.library.downloadDocx,
    },
    {
      kind: "game",
      title: s.library.elements.game,
      badge: s.library.gameBadge(k.game.name, fmtNum(k.game.minutes, numerals)),
      icon: Gamepad2,
    },
    {
      kind: "experiment",
      title: s.library.elements.experiment,
      badge: k.experiment.title,
      icon: FlaskConical,
    },
    {
      kind: "exit",
      title: s.library.elements.exit,
      badge: s.library.questionsCount(fmtNum(k.exitCard.length, numerals)),
      icon: Award,
    },
    {
      kind: "plan",
      title: s.library.elements.plan,
      badge: k.unitTitle,
      icon: ScrollText,
      extraDownload: () => downloadPlanDocx(k),
      downloadLabel: s.library.downloadDocx,
    },
    {
      kind: "participation",
      title: s.library.elements.participation,
      badge: s.library.participationNote,
      icon: ListChecks,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-maroon">{k.lessonTitle}</h1>
          <p className="mt-1 text-ink-soft">
            {k.unitTitle} · {s.library.kitReady}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* وضع الفصل: تشغيل الحصة على البروجكتور (زكريت م٤) */}
          <Link to={`/class?lesson=${lessonId}`} className="btn bg-ink text-white hover:bg-black">
            <Presentation className="size-6" aria-hidden />
            {s.classMode.openButton}
          </Link>
          {/* حزمة الحصة الكاملة (١٥/١٠) */}
          <Link to={`/pack?lesson=${lessonId}`} className="btn-primary">
            <Sparkles className="size-6" aria-hidden />
            {s.pack.button}
          </Link>
          {/* استوديو العرض البصري (زكريت م٣) */}
          <Link to={`/slides?lesson=${lessonId}`} className="btn-secondary">
            <Wand2 className="size-6" aria-hidden />
            {s.slides.title}
          </Link>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {elements.map((el) => (
          <li key={el.kind} className="card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <el.icon className="size-8 shrink-0 text-teal-dark" aria-hidden />
              <div className="me-auto">
                <p className="text-lg font-bold">{el.title}</p>
                <p className="text-sm text-ink-soft">{el.badge}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => void doOpen(el.kind, el.title)} className="btn-secondary flex-1 px-3">
                <Eye className="size-5" aria-hidden />
                {s.library.open}
              </button>
              <button type="button" onClick={() => void doPrint(el.kind)} className="btn-primary flex-1 px-3">
                <Printer className="size-5" aria-hidden />
                {s.library.print}
              </button>
              {el.extraDownload && (
                <button
                  type="button"
                  onClick={() => {
                    void el.extraDownload!().then(() => show(s.library.downloaded));
                  }}
                  className="btn w-full border-2 border-line bg-white text-ink hover:border-teal"
                >
                  <Download className="size-5" aria-hidden />
                  {el.downloadLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {previewHtml && (
        <Modal title={previewHtml.title} onClose={() => setPreviewHtml(null)} wide>
          <iframe
            srcDoc={previewHtml.html}
            title={previewHtml.title}
            className="h-[70dvh] w-full rounded-card border border-line bg-white"
          />
        </Modal>
      )}
    </div>
  );
}
