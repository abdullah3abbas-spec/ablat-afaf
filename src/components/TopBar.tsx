/**
 * الشريط العلوي الثابت: اسم المنصّة والمدرسة والعام + زر رجوع
 * + زرا تكبير/تصغير الخط (§6 — كل أيقونة معها كلمة عربية).
 */
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
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

  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-10 bg-gradient-to-l from-maroon to-maroon-dark text-white shadow-bar">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
        {!isHome && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex min-h-touch min-w-touch items-center gap-1 rounded-card px-3 font-medium hover:bg-white/10"
          >
            <span aria-hidden>→</span>
            {s.common.back}
          </button>
        )}

        <div className="me-auto">
          <div className="font-heading text-xl font-bold">{s.appName}</div>
          <div className="text-sm text-white/80">
            {schoolName}
            {year ? ` · ${year.name}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-3" role="group" aria-label={s.settings.fontSize}>
          <button
            type="button"
            onClick={decreaseFont}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-card bg-white/10 px-3 font-bold hover:bg-white/20"
            aria-label={s.a11y.decreaseFont}
          >
            ا−
          </button>
          <span className="text-sm tabular-nums text-white/90">{fontScale}</span>
          <button
            type="button"
            onClick={increaseFont}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-card bg-white/10 px-3 font-bold hover:bg-white/20"
            aria-label={s.a11y.increaseFont}
          >
            ا+
          </button>
        </div>
      </div>
    </header>
  );
}
