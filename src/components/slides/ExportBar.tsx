/**
 * شريط التصدير الموحّد للعروض — «اللي في البريفيو هو اللي يوصل»:
 * PowerPoint بجودة التصميم (صور) · PowerPoint قابل للتحرير (أشكال) ·
 * PDF (طباعة المتصفح §5) · صور PNG. مع مؤشر تقدم أثناء الالتقاط.
 */
import { useState } from "react";
import { Download, FileImage, FileText, Presentation as PresentationIcon } from "lucide-react";
import type { Presentation, VisualSlide } from "@/db/schema";
import { downloadDesignedPptx, downloadSlidesPngs, printSlidesPdf } from "@/lib/exportDesigned";
import { downloadSlidesPptx } from "@/lib/slidesPptx";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

interface Props {
  title: string;
  slides: VisualSlide[];
  compact?: boolean;
}

export default function ExportBar({ title, slides, compact }: Props) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const schoolName = useUi((x) => x.schoolName) || "مدرستي";
  const show = useToast((x) => x.show);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const opts = {
    schoolName,
    onProgress: (done: number, total: number) => setProgress([done, total]),
  };

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setProgress(null);
    try {
      await fn();
      show(s.library.downloaded);
    } catch {
      show(s.errors.generic, { kind: "danger" });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const btn = compact
    ? "flex min-h-touch items-center gap-1.5 rounded-card px-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink disabled:opacity-40"
    : "btn-secondary disabled:opacity-40";

  const pseudo = (): Presentation => ({ title, slides, status: "approved", sourceNames: [], createdAt: Date.now() });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={!!busy} className={btn}
        onClick={() => void run("pptx", () => downloadDesignedPptx(title, slides, opts))}>
        <PresentationIcon className="size-5" aria-hidden />
        {busy === "pptx" && progress ? s.exportBar.capturing(fmtNum(progress[0], numerals), fmtNum(progress[1], numerals)) : s.exportBar.pptxDesigned}
      </button>
      <button type="button" disabled={!!busy} className={btn}
        onClick={() => void run("pdf", () => printSlidesPdf(title, slides, opts))}>
        <FileText className="size-5" aria-hidden />
        {busy === "pdf" && progress ? s.exportBar.capturing(fmtNum(progress[0], numerals), fmtNum(progress[1], numerals)) : "PDF"}
      </button>
      <button type="button" disabled={!!busy} className={btn}
        onClick={() => void run("png", () => downloadSlidesPngs(title, slides, opts))}>
        <FileImage className="size-5" aria-hidden />
        {busy === "png" && progress ? s.exportBar.capturing(fmtNum(progress[0], numerals), fmtNum(progress[1], numerals)) : "PNG"}
      </button>
      <button type="button" disabled={!!busy} className={btn}
        onClick={() => void run("editable", () => downloadSlidesPptx(pseudo(), schoolName))}>
        <Download className="size-5" aria-hidden />
        {s.exportBar.pptxEditable}
      </button>
    </div>
  );
}
