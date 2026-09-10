/**
 * الترويسة — شريط المسار «فين أنا؟»:
 * على كل شاشة داخلية يظهر المسار كاملاً بلون القسم:
 * [الرئيسية] ‹ [القسم بلونه] ‹ الشاشة الحالية — كل رقاقة زر يرجع خطوة.
 * على الموبايل يحمل الهوية أيضاً (الشريط الجانبي مخفي)، وحجم الخط دائماً في الطرف.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AArrowDown, AArrowUp, ArrowRight, ChevronLeft, Home } from "lucide-react";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
import { locate } from "@/lib/wayfinding";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import SchoolEmblem from "./SchoolEmblem";

export default function TopBar() {
  const s = useStrings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fontScale = useUi((x) => x.fontScale);
  const increaseFont = useUi((x) => x.increaseFont);
  const decreaseFont = useUi((x) => x.decreaseFont);
  const schoolName = useUi((x) => x.schoolName);

  const trail = locate(pathname);
  const Sep = () => <ChevronLeft className="size-4 shrink-0 text-line" aria-hidden />;

  const fontBtn =
    "flex min-h-touch min-w-touch items-center justify-center rounded-card bg-cream text-ink-soft transition-colors hover:bg-teal-bg hover:text-teal-dark";

  const trailChips = trail && (
    <nav aria-label={s.a11y.youAreHere} className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
      <Link
        to="/"
        className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-pill border border-line bg-white px-3 font-medium text-ink-soft transition-colors hover:border-gold-dark/40 hover:text-ink"
      >
        <Home className="size-5" aria-hidden />
        <span className="hidden sm:inline">{s.common.home}</span>
        <span className="sr-only sm:hidden">{s.common.home}</span>
      </Link>
      <Sep />
      <Link
        to={trail.section.to}
        className={`flex min-h-touch shrink-0 items-center gap-1.5 rounded-pill px-3.5 font-bold transition-opacity hover:opacity-85 ${trail.section.chip}`}
      >
        <trail.section.icon className="size-5" aria-hidden />
        {s.nav[trail.section.key]}
      </Link>
      {trail.page && (
        <>
          <Sep />
          <span className="flex min-h-touch shrink-0 items-center whitespace-nowrap px-1 font-heading font-bold text-ink" aria-current="page">
            {trail.sub ? <Link to={trail.page.to} className="font-medium text-ink-soft hover:text-ink">{trail.page.label}</Link> : trail.page.label}
          </span>
        </>
      )}
      {trail.sub && (
        <>
          <Sep />
          <span className="flex min-h-touch shrink-0 items-center whitespace-nowrap px-1 font-heading font-bold text-ink" aria-current="page">
            {trail.sub}
          </span>
        </>
      )}
    </nav>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-1.5 md:px-6">
        {/* هوية الموبايل — الشريط الجانبي يحملها على الشاشات الواسعة */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
          <SchoolEmblem className="size-9 shrink-0" />
          <span className="truncate font-heading text-base font-bold text-maroon-dark">
            {schoolName?.trim() || DEFAULT_SCHOOL_NAME}
          </span>
        </div>

        {/* شريط المسار — قلب الترويسة على الشاشات الواسعة */}
        <div className="hidden min-w-0 flex-1 md:block">{trailChips}</div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {trail && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex min-h-touch items-center gap-1 rounded-card px-2 font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:px-3"
            >
              <ArrowRight className="size-5" aria-hidden />
              <span className="hidden lg:inline">{s.common.back}</span>
              <span className="sr-only lg:hidden">{s.common.back}</span>
            </button>
          )}
          <div className="flex items-center gap-1.5" role="group" aria-label={s.settings.fontSize}>
            <button type="button" onClick={decreaseFont} aria-label={s.a11y.decreaseFont} className={fontBtn}>
              <AArrowDown className="size-6" aria-hidden />
            </button>
            <span className="hidden min-w-8 text-center text-sm tabular-nums text-ink-soft lg:inline">{fontScale}</span>
            <button type="button" onClick={increaseFont} aria-label={s.a11y.increaseFont} className={fontBtn}>
              <AArrowUp className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {/* شريط المسار على الموبايل — صف مستقل كامل العرض */}
      {trail && <div className="border-t border-line/60 px-3 py-1 md:hidden">{trailChips}</div>}
      {/* خيط السدو — همسة هوية على الموبايل */}
      <div className="sadu-line md:hidden" aria-hidden />
    </header>
  );
}
