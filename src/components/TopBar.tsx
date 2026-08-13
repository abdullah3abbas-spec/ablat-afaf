/**
 * الترويسة — شريط أدوات خفيف فاتح (كروم حديث):
 * على الموبايل يحمل الهوية (الشعار واسم المدرسة) لأن الشريط الجانبي مخفي،
 * وعلى الشاشات الواسعة يصبح شريط سياق نحيفاً (رجوع/الرئيسية + حجم الخط).
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AArrowDown, AArrowUp, ArrowRight, Home } from "lucide-react";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
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

  const isHome = pathname === "/";

  const navBtn =
    "flex min-h-touch items-center gap-1 rounded-card px-2 font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink sm:px-3";
  const fontBtn =
    "flex min-h-touch min-w-touch items-center justify-center rounded-card bg-cream text-ink-soft transition-colors hover:bg-teal-bg hover:text-teal-dark";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="flex items-center gap-1.5 px-3 py-1.5 sm:gap-2 md:px-6">
        {!isHome && (
          <>
            <Link to="/" className={navBtn}>
              <Home className="size-5" aria-hidden />
              <span className="hidden lg:inline">{s.common.home}</span>
              <span className="sr-only lg:hidden">{s.common.home}</span>
            </Link>
            <button type="button" onClick={() => navigate(-1)} className={navBtn}>
              <ArrowRight className="size-5" aria-hidden />
              <span className="hidden lg:inline">{s.common.back}</span>
              <span className="sr-only lg:hidden">{s.common.back}</span>
            </button>
          </>
        )}

        {/* هوية الموبايل — الشريط الجانبي يحملها على الشاشات الواسعة */}
        <div className="me-auto flex min-w-0 items-center gap-2 md:hidden">
          <SchoolEmblem className="size-9" />
          <span className="truncate font-heading text-base font-bold text-maroon-dark">
            {schoolName?.trim() || DEFAULT_SCHOOL_NAME}
          </span>
        </div>
        <div className="me-auto hidden md:block" />

        <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={s.settings.fontSize}>
          <button type="button" onClick={decreaseFont} aria-label={s.a11y.decreaseFont} className={fontBtn}>
            <AArrowDown className="size-6" aria-hidden />
          </button>
          <span className="hidden min-w-8 text-center text-sm tabular-nums text-ink-soft sm:inline">{fontScale}</span>
          <button type="button" onClick={increaseFont} aria-label={s.a11y.increaseFont} className={fontBtn}>
            <AArrowUp className="size-6" aria-hidden />
          </button>
        </div>
      </div>
      {/* خيط السدو — همسة هوية على الموبايل فقط (الجانبي يحمله في الواسع) */}
      <div className="sadu-line md:hidden" aria-hidden />
    </header>
  );
}
