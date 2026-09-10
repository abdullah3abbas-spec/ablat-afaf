/**
 * الشريط الجانبي — قشرة التطبيق على الشاشات الواسعة (md+):
 * هوية المدرسة أعلاه، ثم أفعال اليوم الخمسة ببنود مريحة ٥٢px،
 * والإعدادات في أسفله. الموبايل يستخدم الشريط السفلي بدلاً منه.
 */
import { Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { SECTIONS, SETTINGS_ICON } from "@/lib/wayfinding";
import { db } from "@/db";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import SchoolEmblem from "./SchoolEmblem";
import { useBrandStore } from "@/lib/brand";


export default function Sidebar() {
  const s = useStrings();
  const { pathname } = useLocation();
  const schoolName = useUi((x) => x.schoolName);
  const year = useLiveQuery(() => db.academicYears.filter((y) => y.isCurrent).first());
  const settings = useLiveQuery(() => db.settings.get(1));
  const termLabel = settings?.currentTerm === 2 ? s.common.term2 : s.common.term1;

  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-e border-line bg-white md:flex">
      {/* الهوية */}
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-start gap-3">
          <SchoolEmblem className="size-12" />
          <div className="min-w-0 pt-0.5">
            <div className="font-heading text-lg font-bold leading-snug text-maroon-dark">
              {schoolName?.trim() || DEFAULT_SCHOOL_NAME}
            </div>
            <div className="mt-0.5 text-sm leading-snug text-ink-soft">
              {useBrandStore((x) => x.brand.platformName)}
              {year ? ` · ${year.name}` : ""} · {termLabel}
            </div>
          </div>
        </div>
        <div className="sadu-line mt-4" aria-hidden />
      </div>

      {/* التنقّل */}
      <nav aria-label={s.a11y.mainNav} className="flex-1 space-y-1.5 overflow-y-auto px-3">
        {SECTIONS.map((sec) => {
          const active = sec.to === "/" ? pathname === "/" : sec.prefixes.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={sec.key}
              to={sec.to}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-lg transition-all " +
                (active
                  ? `${sec.solid} font-bold shadow-[0_2px_10px_rgb(0_0_0/.18)]`
                  : "font-medium text-ink hover:bg-cream")
              }
            >
              <sec.icon className={"size-6 shrink-0 " + (active ? "" : sec.tint)} aria-hidden />
              {s.nav[sec.key]}
            </Link>
          );
        })}
      </nav>

      {/* الإعدادات */}
      <div className="border-t border-line p-3">
        <Link
          to="/settings"
          aria-current={settingsActive ? "page" : undefined}
          className={
            "flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-lg transition-colors " +
            (settingsActive ? "bg-maroon font-bold text-white" : "font-medium text-ink-soft hover:bg-cream hover:text-ink")
          }
        >
          <SETTINGS_ICON className="size-6 shrink-0" aria-hidden />
          {s.settings.title}
        </Link>
      </div>
    </aside>
  );
}
