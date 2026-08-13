/**
 * شريط التنقّل السفلي الثابت — خمسة أقسام (تحويل زكريت، المرحلة ١):
 * اليوم · المكتبة · الفصول · الأدوات · الإدارة.
 * كل أيقونة معها كلمة عربية (§6)، والقسم الحالي بارز لوناً ونصاً وسماكةً
 * — لا نعتمد على اللون وحده.
 */
import { Link, useLocation } from "react-router-dom";
import { BookOpen, ClipboardCheck, Presentation, Sun, Users } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

/**
 * خمسة أفعال من يوم المعلّمة: اليوم ← حضّري ← درّسي ← طالباتي ← تابعي.
 * كل ميزة تتبع فعلاً واحداً فقط — والقسم يُضاء في كل أعماقه.
 */
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
    prefixes: ["/follow", "/manage", "/grades", "/reports", "/certificates", "/analytics", "/requests", "/search", "/settings"],
  },
];

const ICONS = { today: Sun, prep: BookOpen, teach: Presentation, students: Users, follow: ClipboardCheck } as const;

export default function BottomNav() {
  const s = useStrings();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={s.a11y.mainNav}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-sm md:hidden"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-1.5">
        {SECTIONS.map(({ to, key, prefixes }) => {
          const Icon = ICONS[key];
          const active = to === "/" ? pathname === "/" : prefixes.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className={
                "group flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-card py-1.5 text-base transition-colors " +
                (active ? "font-bold text-teal-dark" : "font-medium text-ink-soft hover:text-teal-dark")
              }
            >
              <span
                className={
                  "grid h-8 w-14 place-items-center rounded-pill transition-colors " +
                  (active ? "bg-teal-bg shadow-[inset_0_0_0_1.5px_rgb(var(--c-teal)/.35)]" : "group-hover:bg-teal-bg/70")
                }
              >
                <Icon className={active ? "size-6" : "size-6 opacity-80"} aria-hidden />
              </span>
              {s.nav[key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
