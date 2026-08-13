/**
 * شريط التنقّل السفلي الثابت — خمسة أقسام (تحويل زكريت، المرحلة ١):
 * اليوم · المكتبة · الفصول · الأدوات · الإدارة.
 * كل أيقونة معها كلمة عربية (§6)، والقسم الحالي بارز لوناً ونصاً وسماكةً
 * — لا نعتمد على اللون وحده.
 */
import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, Gamepad2, LayoutGrid, Sun, Users } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

/** المسارات التابعة لكل قسم — لإبراز القسم الصحيح في الأعماق */
const SECTIONS: { to: string; key: "today" | "library" | "classes" | "tools" | "manage"; prefixes: string[] }[] = [
  { to: "/", key: "today", prefixes: [] },
  { to: "/library", key: "library", prefixes: ["/library", "/curriculum", "/resources", "/studio", "/ask"] },
  { to: "/classes", key: "classes", prefixes: ["/classes", "/students"] },
  { to: "/tools", key: "tools", prefixes: ["/tools"] },
  {
    to: "/manage",
    key: "manage",
    prefixes: [
      "/manage", "/grades", "/attendance", "/points", "/questions", "/exams",
      "/certificates", "/worksheets", "/reports", "/analytics", "/requests",
      "/search", "/settings",
    ],
  },
];

const ICONS = { today: Sun, library: BookOpen, classes: Users, tools: Gamepad2, manage: LayoutGrid } as const;

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
            <NavLink
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
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
