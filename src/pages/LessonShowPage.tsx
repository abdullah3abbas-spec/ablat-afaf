/**
 * «العرض المساعد» — منصّة عرض حصة كاملة تُبنى فورياً لأي درس:
 * القوس الوزاري + إثراء الدرس شرائح تفاعلية + أسئلة تحقق من بنك الكتاب
 * (الإجابة دائماً خلف ضغطة المعلّمة §0-ب.٥) + تنزيل PowerPoint احترافي.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Eye, Gamepad2, Home, LogOut } from "lucide-react";
import { db } from "@/db";
import type { Presentation } from "@/db/schema";
import { buildLessonShow } from "@/lib/lessonShow";
import { downloadSlidesPptx } from "@/lib/slidesPptx";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import SlideVisual from "@/components/slides/SlideVisual";

export default function LessonShowPage() {
  const s = useStrings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName);
  const show = useToast((x) => x.show);

  const lessonId = Number(params.get("lesson"));
  const lesson = useLiveQuery(() => db.lessons.get(lessonId), [lessonId]);
  const bank = useLiveQuery(
    async () => (lesson?.id != null ? (await db.questions.where("lessonId").equals(lesson.id).toArray()).filter((q) => !q.deletedAt) : []),
    [lesson?.id]
  );

  const built = useMemo(
    () => (lesson?.code && bank ? buildLessonShow(lesson.code, bank) : undefined),
    [lesson?.code, bank]
  );

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const count = built?.slides.length ?? 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setIdx((i) => Math.min(i + 1, count - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  useEffect(() => {
    setRevealed(false);
    setShowNote(false);
  }, [idx]);

  if (!lesson || bank === undefined) return <p className="p-8 text-ink-soft">{s.common.loading}</p>;
  if (!built)
    return (
      <div className="p-8">
        <p className="card text-ink-soft">{s.lessonShow.notBookLesson}</p>
      </div>
    );

  const sl = built.slides[idx];
  const n = (v: number) => fmtNum(v, numerals);

  async function handlePptx() {
    const pseudo: Presentation = {
      title: built!.title,
      slides: built!.slides,
      status: "approved",
      sourceNames: [s.lessonShow.sourceName],
      createdAt: Date.now(),
    };
    await downloadSlidesPptx(pseudo, schoolName || "مدرستي");
    show(s.library.downloaded);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      {/* رأس رفيع */}
      <header className="flex items-center justify-between gap-3 border-b-2 border-line bg-white px-5 py-2">
        <span className="truncate font-heading text-xl font-bold text-maroon">{built.title}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handlePptx()}
            className="flex min-h-touch items-center gap-2 rounded-card px-3 text-ink-soft hover:bg-cream hover:text-ink"
          >
            <Download className="size-5" aria-hidden />
            PowerPoint
          </button>
          <Link to="/" className="flex min-h-touch items-center gap-2 rounded-card px-3 text-ink-soft hover:bg-cream hover:text-ink">
            <Home className="size-5" aria-hidden />
            {s.common.home}
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/library/${lessonId}`)}
            className="flex min-h-touch items-center gap-2 rounded-card px-3 text-ink-soft hover:bg-cream hover:text-ink"
          >
            <LogOut className="size-5" aria-hidden />
            {s.classMode.exit}
          </button>
        </div>
      </header>

      {/* الشريحة */}
      <main className="flex flex-1 flex-col justify-center overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-5xl">
          <SlideVisual slide={sl} variant="present" index={idx} answerRevealed={revealed} schoolName={schoolName || "مدرستي"} />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {sl.interaction && !revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="btn min-h-[60px] bg-gold px-8 text-xl font-bold text-ink hover:bg-gold-dark hover:text-white"
              >
                <Eye className="size-7" aria-hidden />
                {s.classMode.reveal}
              </button>
            )}
            {sl.action && (
              <Link
                to={sl.action.to}
                className="btn min-h-[60px] border-2 border-maroon bg-white px-6 text-xl font-bold text-maroon hover:bg-maroon hover:text-white"
              >
                <Gamepad2 className="size-6" aria-hidden />
                {sl.action.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="min-h-touch rounded-pill border-2 border-line bg-white px-4 text-ink-soft hover:border-teal hover:text-teal-dark"
            >
              {s.classMode.teacherNote}
            </button>
          </div>
          {showNote && (
            <div className="mx-auto mt-3 max-w-3xl space-y-1 rounded-card border-2 border-line bg-white p-3 text-lg text-ink-soft">
              <p>{sl.note.say}</p>
              {sl.note.ask && <p><b className="text-teal-dark">{s.lessonShow.askLabel}:</b> {sl.note.ask}</p>}
              {sl.note.misconception && <p><b className="text-gold-dark">{s.lessonShow.misconceptionLabel}:</b> {sl.note.misconception}</p>}
            </div>
          )}
        </div>
      </main>

      {/* شريط التنقّل والتقدّم */}
      <footer className="border-t-2 border-line bg-white py-3">
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            className="btn min-h-[56px] border-2 border-line bg-white px-8 text-xl text-ink hover:border-teal hover:bg-teal-bg disabled:opacity-30"
          >
            {s.classMode.prev}
          </button>
          <span className="text-lg text-ink-soft">{s.classMode.slideOf(n(idx + 1), n(count))}</span>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(i + 1, count - 1))}
            disabled={idx >= count - 1}
            className="btn min-h-[56px] bg-teal px-8 text-xl font-bold text-white hover:bg-teal-dark disabled:opacity-30"
          >
            {s.classMode.next}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
          {built.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => setIdx(i)}
              className={"size-3 rounded-full transition-colors " + (i === idx ? "bg-teal" : i < idx ? "bg-gold" : "bg-line hover:bg-teal-bg")}
            />
          ))}
        </div>
      </footer>
    </div>
  );
}
