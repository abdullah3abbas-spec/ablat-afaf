/**
 * المنهج والتحضير — صفحة جامعة بتبويبات:
 * شجرة المنهج · التوزيع الزمني · التحضير اليومي · سجل التجارب ·
 * ملف الإنجاز. (البحث الشامل صفحة مستقلة.)
 */
import { useState } from "react";
import { BookMarked, CalendarRange, FileText, FlaskConical, Trophy } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";
import CurriculumTree from "@/components/curriculum/CurriculumTree";
import PacingPanel from "@/components/curriculum/PacingPanel";
import PlanningPanel from "@/components/curriculum/PlanningPanel";
import ExperimentsPanel from "@/components/curriculum/ExperimentsPanel";
import AchievementPanel from "@/components/curriculum/AchievementPanel";

type Tab = "tree" | "pacing" | "planning" | "experiments" | "achievement";

export default function CurriculumPage() {
  const s = useStrings();
  const [tab, setTab] = useState<Tab>("tree");

  const tabs: { key: Tab; label: string; icon: typeof BookMarked }[] = [
    { key: "tree", label: s.curriculum.tree, icon: BookMarked },
    { key: "pacing", label: s.pacing.title, icon: CalendarRange },
    { key: "planning", label: s.planning.title, icon: FileText },
    { key: "experiments", label: s.experiments.title, icon: FlaskConical },
    { key: "achievement", label: s.achievement.title, icon: Trophy },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <BookMarked className="size-7" aria-hidden />
          {s.curriculum.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.curriculum.subtitle}</p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={"btn " + (tab === t.key ? "bg-maroon text-white" : "border-2 border-line bg-white text-ink hover:border-maroon")}
          >
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tree" && <CurriculumTree />}
      {tab === "pacing" && <PacingPanel />}
      {tab === "planning" && <PlanningPanel />}
      {tab === "experiments" && <ExperimentsPanel />}
      {tab === "achievement" && <AchievementPanel />}
    </div>
  );
}
