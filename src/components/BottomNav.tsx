/**
 * شريط التنقّل السفلي الثابت — خمسة أقسام (تحويل زكريت، المرحلة ١):
 * اليوم · المكتبة · الفصول · الأدوات · الإدارة.
 * كل أيقونة معها كلمة عربية (§6)، والقسم الحالي بارز لوناً ونصاً وسماكةً
 * — لا نعتمد على اللون وحده.
 */
import { Link, useLocation } from "react-router-dom";
import { matchesPrefix, SECTIONS } from "@/lib/wayfinding";
import { useStrings } from "@/hooks/useStrings";


export default function BottomNav() {
  const s = useStrings();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={s.a11y.mainNav}
      className="fixed inset-x-3 z-10 rounded-[26px] border border-line/70 bg-white/90 shadow-[0_10px_34px_rgb(74_9_29/0.16)] backdrop-blur-md md:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-1.5">
        {SECTIONS.map((sec) => {
          const active = sec.to === "/" ? pathname === "/" : sec.prefixes.some((p) => matchesPrefix(pathname, p));
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
