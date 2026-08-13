/**
 * منصّة عرض العروض البصرية (صقل زكريت) — خشبة فاتحة أنيقة:
 * الشريحة المصمَّمة في المنتصف، نقاط تقدّم، أسهم لوحة المفاتيح،
 * إجابة التفاعل خلف ضغطة المعلّمة، وملاحظتها الخاصة عند الطلب.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Eye, Home, LogOut } from "lucide-react";
import { db } from "@/db";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import SlideVisual from "@/components/slides/SlideVisual";

export default function SlidesPresentPage() {
  const s = useStrings();
  const navigate = useNavigate();
  const { presentationId } = useParams();
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName);

  const pres = useLiveQuery(() => db.presentations.get(Number(presentationId)), [presentationId]);

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const count = pres?.slides.length ?? 0;

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

  if (!pres) return <p className="p-8 text-ink-soft">{s.common.loading}</p>;
  const sl = pres.slides[idx];
  const n = (v: number) => fmtNum(v, numerals);

  return (
    <div className="flex min-h-dvh flex-col bg-cream text-ink">
      {/* رأس رفيع */}
      <header className="flex items-center justify-between gap-3 border-b-2 border-line bg-white px-5 py-2">
        <span className="truncate font-heading text-xl font-bold text-maroon">{pres.title}</span>
        <div className="flex items-center gap-1">
          <Link to="/" className="flex min-h-touch items-center gap-2 rounded-card px-3 text-ink-soft hover:bg-cream hover:text-ink">
            <Home className="size-5" aria-hidden />
            {s.common.home}
          </Link>
          <button
            type="button"
            onClick={() => navigate(pres.lessonId ? `/slides?lesson=${pres.lessonId}` : "/slides")}
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
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="min-h-touch rounded-pill border-2 border-line bg-white px-4 text-ink-soft hover:border-teal hover:text-teal-dark"
            >
              {s.classMode.teacherNote}
            </button>
          </div>
          {showNote && (
            <p className="mx-auto mt-3 max-w-3xl rounded-card border-2 border-line bg-white p-3 text-lg text-ink-soft">{sl.note.say}</p>
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
        {/* نقاط التقدّم */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
          {pres.slides.map((_, i) => (
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
