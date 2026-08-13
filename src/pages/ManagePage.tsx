/**
 * «الإدارة» — صفحة القسم الخامس (تحويل زكريت، المرحلة ١):
 * تجمع كل الشؤون المدرسية التي كانت مبعثرة روابطَ في الرئيسية،
 * في أربع مجموعات واضحة. كل بطاقة رابط حقيقي لوظيفة قائمة — لا أزرار وهمية.
 */
import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  FileBarChart,
  FolderOpen,
  LineChart,
  ListChecks,
  NotebookPen,
  Search,
  Settings,
  Star,
  Trophy,
} from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

export default function ManagePage() {
  const s = useStrings();

  const groups: { title: string; items: { to: string; label: string; icon: typeof Award }[] }[] = [
    {
      title: s.manage.groups.assessment,
      items: [
        { to: "/grades", label: s.grades.title, icon: BarChart3 },
        { to: "/exams", label: s.exams.title, icon: ClipboardList },
        { to: "/questions", label: s.bank.title, icon: ListChecks },
        { to: "/worksheets", label: s.worksheets.title, icon: NotebookPen },
      ],
    },
    {
      title: s.manage.groups.followup,
      items: [
        { to: "/attendance", label: s.attendance.title, icon: CalendarCheck },
        { to: "/points", label: s.points.title, icon: Star },
        { to: "/points/board", label: s.points.leaderboard, icon: Trophy },
        { to: "/analytics", label: s.analytics.title, icon: LineChart },
      ],
    },
    {
      title: s.manage.groups.docs,
      items: [
        { to: "/certificates", label: s.certs.title, icon: Award },
        { to: "/reports", label: s.reports.title, icon: FileBarChart },
        { to: "/requests", label: s.requests.title, icon: ClipboardList },
        { to: "/search", label: s.search.title, icon: Search },
      ],
    },
    {
      title: s.manage.groups.setup,
      items: [
        { to: "/resources", label: s.resources.title, icon: FolderOpen },
        { to: "/settings", label: s.common.settings, icon: Settings },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl font-bold">{s.manage.title}</h1>
        <p className="mt-1 text-ink-soft">{s.manage.subtitle}</p>
      </header>

      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="font-heading text-xl font-bold">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {g.items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="card flex min-h-[76px] flex-col items-center justify-center gap-1 text-center font-bold transition-colors hover:border-teal hover:bg-teal-bg"
              >
                <it.icon className="size-7 text-teal-dark" aria-hidden />
                {it.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
