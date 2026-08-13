/**
 * تصدير العرض البصري إلى PowerPoint قابل للتحرير (زكريت م٣).
 * قواعد §5: rtlMode لكل نص · Arial · 16:9. إجابات التفاعل لا تُطبع على
 * الشريحة — تذهب لملاحظات المتحدّث مع ملاحظات المعلّمة والمصدر.
 */
import type { Presentation, VisualSlide } from "@/db/schema";

const MAROON = "8A1538";
const TEAL = "0F6B62";
const GOLD = "C08A2E";
const INK = "1E2430";
const CREAM = "FBF8F3";

/** ملاحظات المتحدّث: قول/سؤال/متوقع/خطأ شائع + الإجابة والمصدر */
function speakerNotes(sl: VisualSlide): string {
  const parts: string[] = [`قولي: ${sl.note.say}`];
  if (sl.note.ask) parts.push(`اسألي: ${sl.note.ask}`);
  if (sl.note.expected) parts.push(`الإجابة المتوقعة: ${sl.note.expected}`);
  if (sl.note.misconception) parts.push(`الخطأ الشائع: ${sl.note.misconception}`);
  if (sl.interaction) parts.push(`إجابة النشاط (لا تظهر للطالبات): ${sl.interaction.answer}`);
  if (sl.source) parts.push(`المصدر: ${sl.source}`);
  return parts.join("\n");
}

export async function downloadSlidesPptx(p: Presentation, schoolName: string): Promise<void> {
  const { default: pptxgen } = await import("pptxgenjs");
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.rtlMode = true;
  const W = 10;

  const rtl = { fontFace: "Arial", rtlMode: true } as const;

  for (const sl of p.slides) {
    const slide = pres.addSlide();
    slide.background = { color: sl.layout === "cover" ? MAROON : "FFFFFF" };
    if (sl.interaction || sl.layout === "interaction") slide.background = { color: CREAM };

    if (sl.layout === "cover") {
      slide.addText(sl.title, { x: 0.5, y: 1.6, w: W - 1, h: 1.6, align: "center", fontSize: 44, bold: true, color: "FFFFFF", ...rtl });
      slide.addText(`العلوم — المستوى الخامس · ${schoolName}`, { x: 0.5, y: 3.3, w: W - 1, h: 0.6, align: "center", fontSize: 18, color: "E8D5A3", ...rtl });
      slide.addNotes(speakerNotes(sl));
      continue;
    }

    slide.addText(sl.title, { x: 0.4, y: 0.25, w: W - 0.8, h: 0.8, align: "right", fontSize: 30, bold: true, color: MAROON, ...rtl });
    let y = 1.2;

    if (sl.bullets?.length) {
      slide.addText(
        sl.bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
        { x: 0.6, y, w: W - 1.2, h: Math.min(3.6, 0.5 * sl.bullets.length + 0.3), align: "right", fontSize: 20, color: INK, valign: "top", ...rtl }
      );
      y += Math.min(3.6, 0.5 * sl.bullets.length + 0.3) + 0.15;
    }

    if (sl.comparison) {
      const cols = Math.max(sl.comparison.headers.length, 1);
      const rows = [
        sl.comparison.headers.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, align: "center" as const } })),
        ...sl.comparison.rows.map((r) => r.map((cell) => ({ text: cell, options: { align: "center" as const } }))),
      ];
      slide.addTable(rows, { x: 0.6, y, w: W - 1.2, colW: Array.from({ length: cols }, () => (W - 1.2) / cols), fontSize: 15, fontFace: "Arial", color: INK, border: { pt: 1, color: "E6DFD4" } });
      y += 0.55 * rows.length + 0.2;
    }

    const seq = sl.cycle?.steps ?? sl.steps?.steps;
    if (seq?.length) {
      const bw = Math.min(2.1, (W - 1.2 - 0.3 * (seq.length - 1)) / seq.length);
      // RTL: الخطوة الأولى في أقصى اليمين ثم نتقدم يساراً
      seq.forEach((st, i) => {
        const x = W - 0.6 - bw - i * (bw + 0.3);
        slide.addText(`${i + 1}. ${st}`, { x, y, w: bw, h: 1.15, align: "center", fontSize: 14, color: INK, fill: { color: CREAM }, line: { color: TEAL, width: 1.5 }, ...rtl });
        if (i < seq.length - 1) {
          slide.addText("←", { x: x - 0.3, y: y + 0.35, w: 0.3, h: 0.45, align: "center", fontSize: 18, color: GOLD, ...rtl });
        }
      });
      if (sl.cycle) {
        slide.addText("↩ يعود للبداية (دورة)", { x: 0.6, y: y + 1.25, w: W - 1.2, h: 0.4, align: "center", fontSize: 12, color: TEAL, ...rtl });
        y += 0.45;
      }
      y += 1.35;
    }

    if (sl.labeled) {
      slide.addText(sl.labeled.center, { x: W / 2 - 1.6, y, w: 3.2, h: 0.9, align: "center", fontSize: 18, bold: true, color: INK, line: { color: GOLD, width: 2.5 }, ...rtl });
      slide.addText(sl.labeled.labels.join("   ·   "), { x: 0.6, y: y + 1.05, w: W - 1.2, h: 0.7, align: "center", fontSize: 15, color: INK, ...rtl });
      y += 1.9;
    }

    if (sl.icons) {
      slide.addText(
        sl.icons.items.map((it) => ({ text: `▣ ${it.text}`, options: { breakLine: true } })),
        { x: 0.6, y, w: W - 1.2, h: Math.min(2.6, 0.45 * sl.icons.items.length + 0.2), align: "right", fontSize: 18, color: INK, ...rtl }
      );
      y += Math.min(2.6, 0.45 * sl.icons.items.length + 0.2) + 0.1;
    }

    if (sl.interaction) {
      slide.addText(`؟ ${sl.interaction.prompt}`, { x: 0.6, y: Math.max(y, 3.4), w: W - 1.2, h: 1.1, align: "right", fontSize: 22, bold: true, color: GOLD.replace(GOLD, "7A5716"), fill: { color: "FCF3E2" }, ...rtl });
    }

    if (sl.source) {
      slide.addText(`المصدر: ${sl.source}`, { x: 0.4, y: 5.05, w: W - 0.8, h: 0.35, align: "left", fontSize: 10, color: "4A5568", ...rtl });
    }
    slide.addNotes(speakerNotes(sl));
  }

  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عرض-${p.title}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}
