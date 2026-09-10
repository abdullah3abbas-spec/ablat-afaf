/**
 * شريط التنقّل السفلي الثابت — خمسة أقسام (تحويل زكريت، المرحلة ١):
 * اليوم · المكتبة · الفصول · الأدوات · الإدارة.
 * كل أيقونة معها كلمة عربية (§6)، والقسم الحالي بارز لوناً ونصاً وسماكةً
 * — لا نعتمد على اللون وحده.
 */
import { Link, useLocation } from "react-router-dom";
import { SECTIONS } from "@/lib/wayfinding";
import { useStrings } from "@/hooks/useStrings";


export default function BottomNav() {
  const s = useStrings();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={s.a11y.mainNav}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line/70 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-sm md:hidden"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-1.5">
        {SECTIONS.map((sec) => {
          const active = sec.to === "/" ? pathname === "/" : sec.prefixes.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={sec.key}
              to={sec.to}
              aria-current={active ? "page" : undefined}
              className={
                "group flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-card py-1.5 text-base transition-colors " +
                (active ? `font-bold ${sec.tint}` : "font-medium text-ink-soft")
              }
            >
              <span
                className={
                  "grid h-8 w-14 place-items-center rounded-pill transition-colors " +
                  (active ? sec.chip : "group-hover:bg-cream")
                }
              >
                <sec.icon className={active ? "size-6" : "size-6 opacity-80"} aria-hidden />
              </span>
              {s.nav[sec.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
