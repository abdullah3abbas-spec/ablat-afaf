/**
 * مركز «درّسي» — بيت كل ما أثناء الحصة (إعادة المعمارية الخماسية):
 * زر واحد كبير لوضع الفصل (وفيه كل أدوات الحصة) + المختبر التفاعلي.
 * أدوات الحصة كلها داخل وضع الفصل — لا نسخ مكررة في صفحات أخرى.
 */
import { Link } from "react-router-dom";
import { CheckCircle2, FlaskConical, Presentation } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

export default function TeachPage() {
  const s = useStrings();

  return (
    <div className="space-y-5">
      <section className="hero-paint hero-paint--sub relative isolate overflow-hidden rounded-[24px] border border-line/80 shadow-lift">
        <img aria-hidden src="/app-art/hero-teach.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-left mix-blend-multiply" onError={(e) => e.currentTarget.remove()} />
        <div className="relative px-6 py-7 md:w-[64%] md:px-10 md:py-9">
          <h1 className="font-heading text-3xl font-extrabold text-maroon-dark md:text-4xl">{s.teach.title}</h1>
          <p className="mt-2 text-lg text-ink-soft md:text-xl">{s.teach.subtitle}</p>
        </div>
      </section>

      {/* البوابة الرئيسية: وضع الفصل */}
      <Link
        to="/class"
        className="card block space-y-3 border-2 border-ink bg-ink text-white transition-colors hover:bg-black"
      >
        <span className="flex items-center gap-3 font-heading text-2xl font-bold">
          <Presentation className="size-9 text-gold" aria-hidden />
          {s.teach.open}
        </span>
        <span className="block text-white/80">{s.teach.openHint}:</span>
        <span className="flex flex-wrap gap-2">
          {s.teach.inside.map((item) => (
            <span key={item} className="flex items-center gap-1 rounded-pill bg-white/10 px-3 py-1 text-white/90">
              <CheckCircle2 className="size-4 text-gold" aria-hidden />
              {item}
            </span>
          ))}
        </span>
      </Link>

      {/* المختبر التفاعلي */}
      <Link
        to="/lab"
        className="card flex min-h-[88px] items-center gap-4 border-2 border-maroon/40 transition-colors hover:bg-maroon-bg"
      >
        <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-maroon-bg">
          <FlaskConical className="size-7 text-maroon" aria-hidden />
        </span>
        <span>
          <span className="block text-lg font-bold">{s.teach.labCard.label}</span>
          <span className="text-ink-soft">{s.teach.labCard.hint}</span>
        </span>
      </Link>
    </div>
  );
}
