/**
 * عرض البروجكتور للعرض البصري المعتمد (زكريت م٣) — شاشة داكنة كاملة
 * كوضع الفصل: أسهم لوحة المفاتيح، إجابة التفاعل خلف ضغطة المعلّمة،
 * وملاحظة المعلّمة مخفية عن الطالبات حتى تطلبها.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Eye, LogOut } from "lucide-react";
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
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-2">
        <span className="truncate font-heading text-xl font-bold text-gold">{pres.title}</span>
        <button
          type="button"
          onClick={() => navigate(pres.lessonId ? `/slides?lesson=${pres.lessonId}` : "/slides")}
          className="flex min-h-touch items-center gap-2 rounded-card px-3 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-5" aria-hidden />
          {s.classMode.exit}
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-5xl text-center">
          <SlideVisual slide={sl} variant="present" answerRevealed={revealed} />

          {sl.interaction && !revealed && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="btn mx-auto mt-6 min-h-[64px] bg-gold px-10 text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white"
            >
              <Eye className="size-8" aria-hidden />
              {s.classMode.reveal}
            </button>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="min-h-touch rounded-pill border border-white/20 px-4 text-white/50 hover:text-white"
            >
              {s.classMode.teacherNote}
            </button>
            {showNote && <p className="mx-auto mt-2 max-w-3xl rounded-card bg-white/10 p-3 text-xl text-white/80">{sl.note.say}</p>}
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-6 border-t-2 border-white/10 bg-black/30 py-3">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx === 0}
          className="btn min-h-[56px] border-2 border-white/30 bg-transparent px-8 text-xl text-white hover:bg-white/10 disabled:opacity-30"
        >
          {s.classMode.prev}
        </button>
        <span className="text-lg text-white/60">{s.classMode.slideOf(n(idx + 1), n(count))}</span>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(i + 1, count - 1))}
          disabled={idx >= count - 1}
          className="btn min-h-[56px] bg-gold px-8 text-xl font-bold text-ink hover:bg-gold-dark hover:text-white disabled:opacity-30"
        >
          {s.classMode.next}
        </button>
      </footer>
    </div>
  );
}
