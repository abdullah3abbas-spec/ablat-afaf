/** سجل التجارب: من المكتبة الجاهزة، بأدواتها وسلامتها + قائمة مشتريات Excel */
import { FlaskConical, Printer, ShoppingCart } from "lucide-react";
import { db } from "@/db";
import { ALL_KITS } from "@/content/lessonKits";
import { experimentHtml } from "@/lib/kitPrint";
import { downloadLabShoppingXlsx, type ShoppingItem } from "@/lib/planFiles";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import { printHtml } from "@/lib/sheetPrint";

export default function ExperimentsPanel() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  async function exportShopping() {
    const settings = await db.settings.get(1);
    // نجمع أدوات كل التجارب — سطر لكل أداة مع درسها
    const items: ShoppingItem[] = [];
    for (const kit of ALL_KITS) {
      for (const tool of kit.experiment.tools) {
        items.push({ tool, lesson: `${kit.experiment.title} (${kit.lessonTitle})` });
      }
    }
    await downloadLabShoppingXlsx(items, settings?.schoolName ?? "");
    show(s.experiments.exported);
  }

  async function printExperiment(lessonTitle: string) {
    const kit = ALL_KITS.find((k) => k.lessonTitle === lessonTitle);
    if (!kit) return;
    const settings = await db.settings.get(1);
    printHtml(experimentHtml(kit, { schoolName: settings?.schoolName ?? "" }));
    show(s.library.printedElement);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">{s.experiments.fromLesson(fmtNum(ALL_KITS.length, numerals))}</p>
        <button type="button" onClick={() => void exportShopping()} className="btn-primary">
          <ShoppingCart className="size-5" aria-hidden />
          {s.experiments.exportShopping}
        </button>
      </div>

      <ul className="space-y-3">
        {ALL_KITS.map((kit) => (
          <li key={kit.lessonTitle} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <FlaskConical className="size-6 text-teal-dark" aria-hidden />
              <div className="me-auto">
                <p className="text-lg font-bold">{kit.experiment.title}</p>
                <p className="text-sm text-ink-soft">{kit.lessonTitle} · {kit.unitTitle}</p>
              </div>
              <button type="button" onClick={() => void printExperiment(kit.lessonTitle)} className="btn-secondary px-4">
                <Printer className="size-5" aria-hidden />
                {s.experiments.print}
              </button>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-bold text-teal-dark">{s.experiments.tools}</p>
                <p className="text-ink-soft">{kit.experiment.tools.join(" · ")}</p>
              </div>
              <div className="rounded-card border border-danger bg-danger-bg p-2">
                <p className="font-bold text-danger">{s.experiments.safety}</p>
                <ul className="text-ink-soft">
                  {kit.experiment.safety.map((x, i) => (
                    <li key={i}>• {x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
