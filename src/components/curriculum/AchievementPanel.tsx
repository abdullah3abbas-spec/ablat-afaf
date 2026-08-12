/** ملف الإنجاز: يجمع تلقائياً الخطط والاختبارات والشهادات وإحصاءات النتائج */
import { Trophy } from "lucide-react";
import { db } from "@/db";
import { classAdminReport } from "@/lib/reportData";
import { downloadAchievementFile } from "@/lib/planFiles";
import { useStrings } from "@/hooks/useStrings";
import { useToast } from "@/store/toast";
import type { Term } from "@/db/schema";

export default function AchievementPanel() {
  const s = useStrings();
  const show = useToast((x) => x.show);

  async function generate() {
    const settings = await db.settings.get(1);
    const year = await db.academicYears.filter((y) => y.isCurrent).first();
    const term = (settings?.currentTerm ?? 1) as Term;
    const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);

    const classStats = [];
    for (const c of classes) {
      const r = await classAdminReport(c.id!, term);
      if (r) classStats.push({ className: r.className, average: r.average, passRate: r.passRate });
    }
    const taught = (await db.lessons.toArray()).filter((l) => !l.deletedAt && l.taughtAt).map((l) => l.title);

    await downloadAchievementFile({
      schoolName: settings?.schoolName ?? "",
      yearName: year?.name ?? "",
      plansCount: (await db.lessonPlans.toArray()).filter((p) => !p.deletedAt).length,
      examsCount: (await db.exams.toArray()).filter((e) => !e.deletedAt).length,
      certsCount: (await db.certificates.toArray()).filter((c) => !c.deletedAt).length,
      classStats,
      topLessonsTaught: taught.length ? taught : ["(لم تُعلَّم دروس بعد — علّمي الدروس من شجرة المنهج)"],
    });
    show(s.achievement.generated);
  }

  return (
    <div className="card flex flex-col items-center gap-4 py-8 text-center">
      <Trophy className="size-12 text-gold-dark" aria-hidden />
      <p className="max-w-lg text-ink-soft">{s.achievement.subtitle}</p>
      <button type="button" onClick={() => void generate()} className="btn-primary min-h-[56px] px-8 text-lg">
        {s.achievement.generate}
      </button>
    </div>
  );
}
