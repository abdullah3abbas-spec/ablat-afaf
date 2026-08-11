/**
 * الشريط العلوي الثابت: اسم المنصّة والمدرسة، العام والفصل الدراسي الحالي،
 * زر رجوع، وزرا تكبير/تصغير الخط (§6 — كل أيقونة معها كلمة عربية).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
import { AArrowDown, AArrowUp, ArrowRight } from "lucide-react";
import { db } from "@/db";
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

  return (
    <header className="sticky top-0 z-10 bg-gradient-to-l from-maroon to-maroon-dark text-white shadow-bar">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
        {!isHome && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex min-h-touch items-center gap-1 rounded-card px-3 font-medium hover:bg-white/10"
          >
            <ArrowRight className="size-5" aria-hidden />
            {s.common.back}
          </button>
        )}

        <div className="me-auto">
          <div className="font-heading text-xl font-bold">{s.appName}</div>
          <div className="text-sm text-white/85">
            {schoolName}
            {year ? ` · ${year.name}` : ""} · {termLabel}
          </div>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label={s.settings.fontSize}>
          <button
            type="button"
            onClick={decreaseFont}
            aria-label={s.a11y.decreaseFont}
            className="flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-card bg-white/10 px-2 hover:bg-white/20"
          >
            <AArrowDown className="size-6" aria-hidden />
          </button>
          <span className="min-w-8 text-center text-sm tabular-nums text-white/90">{fontScale}</span>
          <button
            type="button"
            onClick={increaseFont}
            aria-label={s.a11y.increaseFont}
            className="flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-card bg-white/10 px-2 hover:bg-white/20"
          >
            <AArrowUp className="size-6" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
