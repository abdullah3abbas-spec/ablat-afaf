/**
 * فاحص جودة العروض البصرية (زكريت م٣) — يفرض معيار الماستر برومبت
 * برمجياً: «النص وحده مرفوض». يعمل محلياً على أي مسودة قبل الاعتماد.
 */
import type { VisualSlide } from "@/db/schema";

export interface QualityReport {
  /** نسبة الشرائح البصرية/التفاعلية (الغلاف والأهداف خارج الحساب) */
  visualPct: number;
  visualOk: boolean;
  /** شرائح تجاوزت ٤٥ كلمة */
  wordySlides: string[];
  wordsOk: boolean;
  /** أطول مسافة بين تفاعلَين (بالشرائح) */
  maxGapWithoutInteraction: number;
  interactionOk: boolean;
  /** شرائح معلوماتية بلا مصدر */
  unsourced: string[];
  sourcesOk: boolean;
  ok: boolean;
}

const VISUAL_LAYOUTS = new Set(["comparison", "cycle", "steps", "labeled", "icons", "interaction"]);
const META_LAYOUTS = new Set(["cover", "objectives"]);

export function wordCount(s: VisualSlide): number {
  const parts: string[] = [s.title, ...(s.bullets ?? [])];
  if (s.comparison) parts.push(...s.comparison.headers, ...s.comparison.rows.flat());
  if (s.cycle) parts.push(...s.cycle.steps);
  if (s.steps) parts.push(...s.steps.steps);
  if (s.labeled) parts.push(s.labeled.center, ...s.labeled.labels);
  if (s.icons) parts.push(...s.icons.items.map((i) => i.text));
  if (s.interaction) parts.push(s.interaction.prompt);
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

export function qualityCheck(slides: VisualSlide[]): QualityReport {
  const content = slides.filter((s) => !META_LAYOUTS.has(s.layout));
  const visualCount = content.filter((s) => VISUAL_LAYOUTS.has(s.layout)).length;
  const visualPct = content.length === 0 ? 0 : Math.round((visualCount / content.length) * 100);

  const wordySlides = slides.filter((s) => wordCount(s) > 45).map((s) => s.title);

  // أطول مسافة بين تفاعلَين — تشمل ما قبل الأول وما بعد الأخير
  let maxGap = 0;
  let gap = 0;
  for (const s of slides) {
    if (s.layout === "interaction" || s.interaction) gap = 0;
    else {
      gap++;
      maxGap = Math.max(maxGap, gap);
    }
  }

  const unsourced = slides
    .filter((s) => !META_LAYOUTS.has(s.layout) && s.layout !== "interaction" && !s.source?.trim())
    .map((s) => s.title);

  const report: QualityReport = {
    visualPct,
    visualOk: visualPct >= 60,
    wordySlides,
    wordsOk: wordySlides.length === 0,
    maxGapWithoutInteraction: maxGap,
    interactionOk: maxGap <= 4,
    unsourced,
    sourcesOk: unsourced.length === 0,
    ok: false,
  };
  report.ok = report.visualOk && report.wordsOk && report.interactionOk;
  return report;
}
