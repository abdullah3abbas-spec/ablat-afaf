/**
 * صفحة حزمة الدرس — العناصر السبعة، لكل عنصر «افتحي» و«اطبعي» فوريان
 * بلا حوارات (§2-ج)، مع تنزيل PowerPoint/Word حقيقي حيث يلزم.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Award,
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
import type { LessonKit } from "@/content/kitTypes";
import { elementHtml, printElement, type KitElementKind } from "@/lib/kitPrint";
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
  if (!kit) return <EmptyState icon={Presentation} title={s.library.kitMissing} />;

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
          {/* استوديو العرض البصري (زكريت م٣) */}
          <Link to={`/slides?lesson=${lessonId}`} className="btn-secondary">
            <Sparkles className="size-6" aria-hidden />
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
