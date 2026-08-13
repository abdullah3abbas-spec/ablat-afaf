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
    prefixes: ["/prep", "/library", "/slides", "/ask", "/exams", "/worksheets", "/questions", "/curriculum", "/resources", "/studio"],
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
      className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-bar"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {SECTIONS.map(({ to, key, prefixes }) => {
          const Icon = ICONS[key];
          const active = to === "/" ? pathname === "/" : prefixes.some((p) => pathname.startsWith(p));
          return (
            <Link
              key={key}
              to={to}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-base transition-colors " +
                (active
                  ? "border-t-4 border-teal-dark font-bold text-teal-dark"
                  : "border-t-4 border-transparent font-medium text-ink-soft hover:bg-teal-bg hover:text-teal-dark")
              }
            >
              <Icon className="size-6" aria-hidden />
              {s.nav[key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
