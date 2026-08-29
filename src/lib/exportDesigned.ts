/**
 * التصدير بجودة التصميم — «اللي في البريفيو هو اللي يوصل»:
 * تُصيَّر كل شريحة بمكوّن الشريحة المصمَّم نفسه (SlideVisual) خارج الشاشة
 * بمقاس 1280×720، تُلتقط PNG، ثم تُصدَّر:
 *   - PowerPoint بجودة التصميم (صورة كاملة لكل شريحة — پكسل بپكسل)
 *   - PDF عبر طباعة المتصفح (§5) — صفحة أفقية لكل شريحة
 *   - صور PNG للشرائح
 * (نسخة PowerPoint «قابلة للتحرير» بالأشكال تبقى خياراً ثانياً في slidesPptx.)
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { VisualSlide } from "@/db/schema";
import SlideVisual from "@/components/slides/SlideVisual";
import { printHtml } from "./sheetPrint";

const SLIDE_W = 1280;
const SLIDE_H = 720;

/** ترميز الشريحة HTML ثابتاً بمكوّن الشريحة المصمَّم نفسه */
function slideMarkup(sl: VisualSlide, i: number, schoolName: string, revealAnswers: boolean): string {
  return renderToStaticMarkup(
    createElement(
      "div",
      { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px", background: "#FAF6EF", boxSizing: "border-box" } },
      createElement(SlideVisual, { slide: sl, variant: "present", index: i, answerRevealed: revealAnswers, schoolName })
    )
  );
}

/** تحويل SVG (data URL) إلى PNG عبر Canvas — بمهلة أمان لكل شريحة */
function svgToPng(svgUrl: string, w: number, h: number, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("انتهت مهلة تحويل الشريحة")), 15_000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const cx = canvas.getContext("2d")!;
      cx.fillStyle = "#FAF6EF";
      cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("تعذّر تحميل صورة الشريحة"));
    };
    img.src = svgUrl;
  });
}

/**
 * التقاط الشرائح PNG: تصيير خفي في مستند الصفحة ثم toSvg (المسار الموثوق)
 * فتحويل Canvas يدوي — toPng الداخلية تعلق على شرائحنا فلا نستخدمها.
 */
export async function renderSlidesToPngs(
  slides: VisualSlide[],
  opts: { schoolName: string; revealAnswers?: boolean; onProgress?: (done: number, total: number) => void }
): Promise<string[]> {
  const { toSvg } = await import("html-to-image");

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;`;
  host.setAttribute("dir", "rtl");
  document.body.appendChild(host);

  const out: string[] = [];
  try {
    for (let i = 0; i < slides.length; i++) {
      host.innerHTML = slideMarkup(slides[i], i, opts.schoolName, opts.revealAnswers ?? false);
      await new Promise((r) => setTimeout(r, i === 0 ? 350 : 60));
      const node = host.firstElementChild as HTMLElement;
      const svg = await toSvg(node, { width: SLIDE_W, height: SLIDE_H });
      out.push(await svgToPng(svg, SLIDE_W, SLIDE_H, 1.5));
      opts.onProgress?.(i + 1, slides.length);
    }
  } finally {
    host.remove();
  }
  // خطاف فحص: آخر التقاط متاح للتشخيص (لا يُستخدم في المنتج)
  (window as { __lastSlidePngs?: string[] }).__lastSlidePngs = out;
  return out;
}

/** PowerPoint بجودة التصميم — كل شريحة صورة كاملة (16:9) */
export async function downloadDesignedPptx(
  title: string,
  slides: VisualSlide[],
  opts: { schoolName: string; onProgress?: (done: number, total: number) => void }
): Promise<void> {
  const pngs = await renderSlidesToPngs(slides, opts);
  const { default: pptxgen } = await import("pptxgenjs");
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.rtlMode = true;
  pngs.forEach((data, i) => {
    const slide = pres.addSlide();
    slide.addImage({ data, x: 0, y: 0, w: 10, h: 5.625 });
    const sl = slides[i];
    const notes: string[] = [`قولي: ${sl.note.say}`];
    if (sl.note.ask) notes.push(`اسألي: ${sl.note.ask}`);
    if (sl.interaction) notes.push(`إجابة النشاط (لا تظهر للطالبات): ${sl.interaction.answer}`);
    if (sl.source) notes.push(`المصدر: ${sl.source}`);
    slide.addNotes(notes.join("\n"));
  });
  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عرض-${title}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF عبر طباعة المتصفح — صفحة أفقية لكل شريحة، بلا هوامش */
export async function printSlidesPdf(
  title: string,
  slides: VisualSlide[],
  opts: { schoolName: string; onProgress?: (done: number, total: number) => void }
): Promise<void> {
  const pngs = await renderSlidesToPngs(slides, opts);
  const pages = pngs.map((p) => `<div class="pg"><img src="${p}" alt=""/></div>`).join("");
  printHtml(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${title}</title><style>
    @page { size: 297mm 167mm; margin: 0; }
    * { margin: 0; padding: 0; }
    .pg { width: 297mm; height: 167mm; page-break-after: always; }
    .pg:last-child { page-break-after: auto; }
    .pg img { width: 100%; height: 100%; object-fit: cover; display: block; }
  </style></head><body>${pages}</body></html>`);
}

/** تنزيل الشرائح صور PNG (ملف لكل شريحة) */
export async function downloadSlidesPngs(
  title: string,
  slides: VisualSlide[],
  opts: { schoolName: string; onProgress?: (done: number, total: number) => void }
): Promise<void> {
  const pngs = await renderSlidesToPngs(slides, opts);
  for (let i = 0; i < pngs.length; i++) {
    const a = document.createElement("a");
    a.href = pngs[i];
    a.download = `${title}-شريحة-${i + 1}.png`;
    a.click();
    await new Promise((r) => setTimeout(r, 180));
  }
}
