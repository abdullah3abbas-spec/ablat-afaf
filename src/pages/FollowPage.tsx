/**
 * مركز «تابعي» — بيت كل ما بعد الحصة (إعادة المعمارية الخماسية):
 * الرصد والتقارير والتحليلات والإعدادات في أربع مجموعات واضحة.
 */
import { Link } from "react-router-dom";
import {
  Award, BarChart3, ClipboardList, FileBarChart, LineChart, Search, Settings, Trophy,
} from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

export default function FollowPage() {
  const s = useStrings();

  const groups: { title: string; items: { to: string; label: string; icon: typeof Award }[] }[] = [
    {
      title: s.follow.groups.grading,
      items: [
        { to: "/grades", label: s.grades.title, icon: BarChart3 },
        { to: "/points/board", label: s.points.leaderboard, icon: Trophy },
      ],
    },
    {
      title: s.follow.groups.docs,
      items: [
        { to: "/reports", label: s.reports.title, icon: FileBarChart },
        { to: "/certificates", label: s.certs.title, icon: Award },
      ],
    },
    {
      title: s.follow.groups.insight,
      items: [
        { to: "/analytics", label: s.analytics.title, icon: LineChart },
        { to: "/requests", label: s.requests.title, icon: ClipboardList },
      ],
    },
    {
      title: s.follow.groups.setup,
      items: [
        { to: "/search", label: s.search.title, icon: Search },
        { to: "/settings", label: s.common.settings, icon: Settings },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="hero-paint hero-paint--sub relative isolate overflow-hidden rounded-[24px] border border-line/80 shadow-lift">
        <img aria-hidden src="/app-art/hero-follow.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-left mix-blend-multiply" onError={(e) => e.currentTarget.remove()} />
        <div className="relative px-6 py-7 md:w-[64%] md:px-10 md:py-9">
          <h1 className="font-heading text-3xl font-extrabold text-marina md:text-4xl">{s.follow.title}</h1>
          <p className="mt-2 text-lg text-ink-soft md:text-xl">{s.follow.subtitle}</p>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="font-heading text-xl font-bold">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3">
            {g.items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="card flex min-h-[76px] flex-col items-center justify-center gap-1 text-center font-bold transition-colors hover:border-marina/50 hover:bg-marina-bg"
              >
                <it.icon className="size-7 text-marina" aria-hidden />
                {it.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
