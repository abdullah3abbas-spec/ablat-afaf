/**
 * الشريط العلوي — هوية مدرسة زكريت: شعار حرفي بحلقة ذهبية، اسم المدرسة
 * أولاً (الهوية المؤسسية)، حزام سدو منسوج أسفل الشريط، وأزرار الخط
 * (§6 — كل أيقونة معها كلمة عربية أو aria-label).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AArrowDown, AArrowUp, ArrowRight, Home } from "lucide-react";
import { db } from "@/db";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

export default function TopBar() {
  const s = useStrings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fontScale = useUi((x) => x.fontScale);
  const increaseFont = useUi((x) => x.increaseFont);
  const decreaseFont = useUi((x) => x.decreaseFont);
  const schoolName = useUi((x) => x.schoolName);

  const year = useLiveQuery(() => db.academicYears.filter((y) => y.isCurrent).first());
  const settings = useLiveQuery(() => db.settings.get(1));

  const isHome = pathname === "/";
  const termLabel = settings?.currentTerm === 2 ? s.common.term2 : s.common.term1;
  const displaySchool = schoolName?.trim() || DEFAULT_SCHOOL_NAME;

  return (
    <header className="sticky top-0 z-10 text-white shadow-bar">
      <div className="bg-gradient-to-l from-maroon to-maroon-deep">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-0 px-4 py-2.5 sm:flex-nowrap sm:gap-3">
          {!isHome && (
            <>
              <Link
                to="/"
                className="order-2 flex min-h-touch shrink-0 items-center gap-1 rounded-card px-2 font-medium text-white/95 transition-colors hover:bg-white/10 sm:order-none sm:px-3"
              >
                <Home className="size-5" aria-hidden />
                <span className="hidden sm:inline">{s.common.home}</span>
                <span className="sr-only sm:hidden">{s.common.home}</span>
              </Link>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="order-2 flex min-h-touch shrink-0 items-center gap-1 rounded-card px-2 font-medium text-white/95 transition-colors hover:bg-white/10 sm:order-none sm:px-3"
              >
                <ArrowRight className="size-5" aria-hidden />
                <span className="hidden sm:inline">{s.common.back}</span>
                <span className="sr-only sm:hidden">{s.common.back}</span>
              </button>
            </>
          )}

          <div
            className={
              "order-1 flex min-w-0 items-center gap-3 sm:order-none sm:me-auto " +
              (isHome ? "me-auto" : "w-full pb-1 sm:w-auto sm:pb-0")
            }
          >
            {/* شعار الهوية: نجمة سدو ثمانية داخل حلقة ذهبية */}
            <div
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-gold/90 bg-maroon-deep shadow-[inset_0_1px_4px_rgba(0,0,0,.35)] ring-1 ring-white/15 ring-offset-1 ring-offset-maroon-deep"
            >
              <svg viewBox="0 0 24 24" className="size-6 fill-gold" aria-hidden>
                <path d="M12 1.5 14.6 7l5.9-1.5L17 10.4l4.5 4-6-.4-1 5.9-2.5-5.5-5.4 2.7 2.7-5.4L3.8 9.2l6 .3L11 3.6Z" opacity=".35" />
                <path d="M12 3.5 13.9 9l5.6.2-4.4 3.4 1.6 5.4L12 14.8 7.3 18l1.6-5.4L4.5 9.2 10.1 9Z" />
                <circle cx="12" cy="11.6" r="1.7" className="fill-maroon-deep" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="truncate font-heading text-base font-extrabold leading-tight sm:text-xl">{displaySchool}</div>
              <div className="truncate text-sm leading-snug text-white/80">
                {s.appName}
                {year ? ` · ${year.name}` : ""} · {termLabel}
              </div>
            </div>
          </div>

          <div className="order-3 ms-auto flex shrink-0 items-center gap-1.5 sm:order-none sm:ms-0 sm:gap-2" role="group" aria-label={s.settings.fontSize}>
            <button
              type="button"
              onClick={decreaseFont}
              aria-label={s.a11y.decreaseFont}
              className="flex min-h-touch min-w-touch items-center justify-center rounded-card bg-white/10 px-2 transition-colors hover:bg-white/20"
            >
              <AArrowDown className="size-6" aria-hidden />
            </button>
            <span className="hidden min-w-8 text-center text-sm tabular-nums text-white/90 sm:inline">{fontScale}</span>
            <button
              type="button"
              onClick={increaseFont}
              aria-label={s.a11y.increaseFont}
              className="flex min-h-touch min-w-touch items-center justify-center rounded-card bg-white/10 px-2 transition-colors hover:bg-white/20"
            >
              <AArrowUp className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {/* حزام السدو — توقيع الهوية */}
      <div className="sadu-band" aria-hidden />
    </header>
  );
}
