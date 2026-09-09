/**
 * الشريط الجانبي — قشرة التطبيق على الشاشات الواسعة (md+):
 * هوية المدرسة أعلاه، ثم أفعال اليوم الخمسة ببنود مريحة ٥٢px،
 * والإعدادات في أسفله. الموبايل يستخدم الشريط السفلي بدلاً منه.
 */
import { Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ClipboardCheck, Presentation, Settings, Sun, Users } from "lucide-react";
import { db } from "@/db";
import { DEFAULT_SCHOOL_NAME } from "@/db/constants";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import SchoolEmblem from "./SchoolEmblem";
import { useBrandStore } from "@/lib/brand";

const SECTIONS: { to: string; key: "today" | "prep" | "teach" | "students" | "follow"; prefixes: string[] }[] = [
  { to: "/", key: "today", prefixes: [] },
  {
    to: "/prep",
    key: "prep",
    prefixes: ["/prep", "/library", "/pack", "/slides", "/ask", "/exams", "/worksheets", "/questions", "/curriculum", "/resources", "/studio"],
  },
  { to: "/teach", key: "teach", prefixes: ["/teach", "/class", "/lab", "/tools"] },
  { to: "/classes", key: "students", prefixes: ["/classes", "/students", "/attendance", "/points"] },
  {
    to: "/follow",
    key: "follow",
    prefixes: ["/follow", "/manage", "/grades", "/reports", "/certificates", "/analytics", "/requests", "/search"],
  },
];

const ICONS = { today: Sun, prep: BookOpen, teach: Presentation, students: Users, follow: ClipboardCheck } as const;

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
        {SECTIONS.map(({ to, key, prefixes }) => {
          const Icon = ICONS[key];
          const active = to === "/" ? pathname === "/" : prefixes.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-lg transition-colors " +
                (active
                  ? "bg-maroon font-bold text-white shadow-[0_2px_8px_rgba(74,9,29,.25)]"
                  : "font-medium text-ink hover:bg-cream")
              }
            >
              <Icon className="size-6 shrink-0" aria-hidden />
              {s.nav[key]}
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
          <Settings className="size-6 shrink-0" aria-hidden />
          {s.settings.title}
        </Link>
      </div>
    </aside>
  );
}
