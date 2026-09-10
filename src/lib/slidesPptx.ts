/**
 * تصدير العرض البصري إلى PowerPoint قابل للتحرير — بهوية زكريت:
 * غلاف عنّابي عميق بشعار معيني ذهبي، وكل شريحة بكروم الهوية (صف سدو
 * علوي، شريط لكنة جانبي متناوب، عنوان بخط ذهبي سفلي، ترقيم وتذييل).
 * قواعد §5: rtlMode لكل نص · Arial · 16:9. إجابات التفاعل لا تُطبع على
 * الشريحة — تذهب لملاحظات المتحدّث مع ملاحظات المعلّمة والمصدر.
 */
import type { Presentation, VisualSlide } from "@/db/schema";

const MAROON = "A34460";
const MAROON_DEEP = "4A091D";
const TEAL = "12796F";
const GOLD = "C7952F";
const GOLD_SOFT = "E5C98F";
const INK = "1E2430";
const IVORY = "FBF6EF";
const CREAM_CARD = "FFFFFF";
const LINE = "E9E0D2";

const W = 10;
const H = 5.63;
const ACCENTS = [TEAL, GOLD, MAROON];

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

type Pptx = import("pptxgenjs").default;
type Slide = ReturnType<Pptx["addSlide"]>;

/** شعار معيني السدو: معين ذهبي كبير + معين عنّابي داخلي + مركز ذهبي */
function addEmblem(slide: Slide, cx: number, cy: number, size: number): void {
  const s2 = size * 0.62;
  const s3 = size * 0.16;
  slide.addShape("diamond" as Parameters<Slide["addShape"]>[0], {
    x: cx - size / 2, y: cy - size / 2, w: size, h: size,
    fill: { color: GOLD }, line: { color: GOLD_SOFT, width: 1 },
  });
  slide.addShape("diamond" as Parameters<Slide["addShape"]>[0], {
    x: cx - s2 / 2, y: cy - s2 / 2, w: s2, h: s2,
    fill: { color: MAROON_DEEP }, line: { color: MAROON_DEEP, width: 0 },
  });
  slide.addShape("diamond" as Parameters<Slide["addShape"]>[0], {
    x: cx - s3 / 2, y: cy - s3 / 2, w: s3, h: s3,
    fill: { color: GOLD_SOFT }, line: { color: GOLD_SOFT, width: 0 },
  });
}

/** كروم شريحة المحتوى: خلفية ورقية + صف سدو علوي + لكنة جانبية + تذييل */
function applyChrome(slide: Slide, idx: number, total: number, schoolName: string, rtl: object): void {
  slide.background = { color: IVORY };
  // صف السدو العلوي: شريط عنّابي عميق يحمل معينات ذهبية
  slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: 0, y: 0, w: W, h: 0.16, fill: { color: MAROON_DEEP } });
  slide.addText("◆".repeat(72), { x: 0, y: -0.05, w: W, h: 0.26, align: "center", fontSize: 7, color: GOLD, charSpacing: 6, fontFace: "Arial" });
  // لكنة جانبية يمنى (RTL) متناوبة
  slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: W - 0.1, y: 0.16, w: 0.1, h: H - 0.5, fill: { color: ACCENTS[idx % ACCENTS.length] } });
  // تذييل: المدرسة يميناً ورقم الشريحة داخل معين صغير يساراً
  slide.addText(schoolName, { x: 0.9, y: H - 0.36, w: W - 1.8, h: 0.3, align: "right", fontSize: 9, color: "8a8a8a", ...rtl });
  slide.addShape("diamond" as Parameters<Slide["addShape"]>[0], { x: 0.32, y: H - 0.42, w: 0.34, h: 0.34, fill: { color: MAROON }, line: { color: GOLD, width: 0.75 } });
  slide.addText(String(idx + 1), { x: 0.24, y: H - 0.44, w: 0.5, h: 0.38, align: "center", fontSize: 10, bold: true, color: "FFFFFF", fontFace: "Arial" });
  void total;
}

/** عنوان الشريحة + خط ذهبي تحته */
function addTitle(slide: Slide, title: string, rtl: object): number {
  slide.addText(title, { x: 0.5, y: 0.3, w: W - 1, h: 0.75, align: "right", fontSize: 28, bold: true, color: MAROON, ...rtl });
  slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: W - 2.3, y: 1.08, w: 1.8, h: 0.045, fill: { color: GOLD } });
  return 1.35;
}

/** بناء ملف PowerPoint كاملاً — نقي، يُستدعى من التنزيل ومن المعاينة */
export async function buildSlidesPptx(p: Presentation, schoolName: string): Promise<Pptx> {
  const { default: pptxgen } = await import("pptxgenjs");
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.rtlMode = true;

  const rtl = { fontFace: "Arial", rtlMode: true } as const;
  const total = p.slides.length;

  p.slides.forEach((sl, idx) => {
    const slide = pres.addSlide();

    if (sl.layout === "cover") {
      // غلاف عنّابي عميق بطبقات دفء وشعار
      slide.background = { color: MAROON_DEEP };
      slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: 0, y: 0, w: W, h: H, fill: { color: MAROON, transparency: 45 } });
      slide.addShape("ellipse" as Parameters<Slide["addShape"]>[0], { x: W - 4.6, y: -2.2, w: 5.4, h: 4.2, fill: { color: GOLD, transparency: 86 }, line: { width: 0 } });
      slide.addShape("ellipse" as Parameters<Slide["addShape"]>[0], { x: -1.6, y: H - 2.2, w: 4.4, h: 3.4, fill: { color: GOLD, transparency: 90 }, line: { width: 0 } });
      addEmblem(slide, W / 2, 1.05, 0.9);
      slide.addText(sl.title, { x: 0.5, y: 1.7, w: W - 1, h: 1.7, align: "center", fontSize: 42, bold: true, color: "FFFFFF", ...rtl });
      slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: W / 2 - 1.1, y: 3.42, w: 2.2, h: 0.05, fill: { color: GOLD } });
      slide.addText(`العلوم — المستوى الخامس · ${schoolName}`, { x: 0.5, y: 3.6, w: W - 1, h: 0.55, align: "center", fontSize: 17, color: GOLD_SOFT, ...rtl });
      // صف سدو سفلي للغلاف
      slide.addShape("rect" as Parameters<Slide["addShape"]>[0], { x: 0, y: H - 0.2, w: W, h: 0.2, fill: { color: MAROON_DEEP } });
      slide.addText("◆".repeat(72), { x: 0, y: H - 0.26, w: W, h: 0.26, align: "center", fontSize: 7, color: GOLD, charSpacing: 6, fontFace: "Arial" });
      slide.addNotes(speakerNotes(sl));
      return;
    }

    applyChrome(slide, idx, total, schoolName, rtl);
    let y = addTitle(slide, sl.title, rtl);

    if (sl.bullets?.length) {
      const h = Math.min(3.4, 0.52 * sl.bullets.length + 0.25);
      slide.addText(
        sl.bullets.map((b) => ({ text: b, options: { bullet: { code: "25C6", color: GOLD }, breakLine: true, paraSpaceAfter: 8 } })),
        { x: 0.7, y, w: W - 1.5, h, align: "right", fontSize: 19, color: INK, valign: "top", ...rtl }
      );
      y += h + 0.15;
    }

    if (sl.comparison) {
      const cols = Math.max(sl.comparison.headers.length, 1);
      const rows = [
        sl.comparison.headers.map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: TEAL }, align: "center" as const } })),
        ...sl.comparison.rows.map((r, ri) =>
          r.map((cell) => ({ text: cell, options: { align: "center" as const, fill: { color: ri % 2 ? IVORY : CREAM_CARD } } }))
        ),
      ];
      slide.addTable(rows, {
        x: 0.7, y, w: W - 1.5, colW: Array.from({ length: cols }, () => (W - 1.5) / cols),
        fontSize: 15, fontFace: "Arial", color: INK, border: { pt: 0.75, color: LINE }, rowH: 0.42,
      });
      y += 0.5 * rows.length + 0.2;
    }

    const seq = sl.cycle?.steps ?? sl.steps?.steps;
    if (seq?.length) {
      const gap = 0.32;
      const bw = Math.min(2.1, (W - 1.5 - gap * (seq.length - 1)) / seq.length);
      seq.forEach((st, i) => {
        const x = W - 0.8 - bw - i * (bw + gap);
        slide.addShape("roundRect" as Parameters<Slide["addShape"]>[0], {
          x, y, w: bw, h: 1.2, fill: { color: CREAM_CARD }, line: { color: TEAL, width: 1.5 }, rectRadius: 0.08,
          shadow: { type: "outer", color: MAROON_DEEP, opacity: 0.18, blur: 6, offset: 2, angle: 90 },
        });
        slide.addShape("diamond" as Parameters<Slide["addShape"]>[0], { x: x + bw / 2 - 0.16, y: y - 0.16, w: 0.32, h: 0.32, fill: { color: TEAL } });
        slide.addText(String(i + 1), { x: x + bw / 2 - 0.25, y: y - 0.19, w: 0.5, h: 0.38, align: "center", fontSize: 11, bold: true, color: "FFFFFF", fontFace: "Arial" });
        slide.addText(st, { x: x + 0.05, y: y + 0.18, w: bw - 0.1, h: 0.95, align: "center", valign: "middle", fontSize: 13, color: INK, ...rtl });
        if (i < seq.length - 1) {
          slide.addText("←", { x: x - gap, y: y + 0.4, w: gap, h: 0.45, align: "center", fontSize: 17, bold: true, color: GOLD, fontFace: "Arial" });
        }
      });
      y += 1.35;
      if (sl.cycle) {
        slide.addText("↩ يعود للبداية (دورة)", { x: 0.7, y, w: W - 1.5, h: 0.4, align: "center", fontSize: 12, color: TEAL, ...rtl });
        y += 0.45;
      }
    }

    if (sl.labeled) {
      slide.addShape("roundRect" as Parameters<Slide["addShape"]>[0], {
        x: W / 2 - 1.7, y, w: 3.4, h: 0.95, fill: { color: MAROON }, line: { color: GOLD, width: 1.5 }, rectRadius: 0.12,
      });
      slide.addText(sl.labeled.center, { x: W / 2 - 1.7, y: y + 0.06, w: 3.4, h: 0.85, align: "center", valign: "middle", fontSize: 18, bold: true, color: "FFFFFF", ...rtl });
      slide.addText(sl.labeled.labels.map((l) => ({ text: `◆ ${l}`, options: { breakLine: false } })).flatMap((x, i, a) => (i < a.length - 1 ? [x, { text: "    ", options: {} }] : [x])), {
        x: 0.7, y: y + 1.1, w: W - 1.5, h: 0.8, align: "center", fontSize: 15, color: INK, ...rtl,
      });
      y += 2.0;
    }

    if (sl.icons) {
      const h = Math.min(2.6, 0.48 * sl.icons.items.length + 0.2);
      slide.addText(
        sl.icons.items.map((it) => ({ text: it.text, options: { bullet: { code: "25C6", color: TEAL }, breakLine: true, paraSpaceAfter: 6 } })),
        { x: 0.7, y, w: W - 1.5, h, align: "right", fontSize: 17, color: INK, ...rtl }
      );
      y += h + 0.1;
    }

    if (sl.interaction) {
      const iy = Math.max(y, 3.15);
      slide.addShape("roundRect" as Parameters<Slide["addShape"]>[0], {
        x: 0.7, y: iy, w: W - 1.5, h: 1.35, fill: { color: "FCF3E2" }, line: { color: GOLD, width: 1.75 }, rectRadius: 0.12,
        shadow: { type: "outer", color: MAROON_DEEP, opacity: 0.15, blur: 7, offset: 2, angle: 90 },
      });
      slide.addShape("ellipse" as Parameters<Slide["addShape"]>[0], { x: W - 1.35, y: iy - 0.3, w: 0.6, h: 0.6, fill: { color: GOLD } });
      slide.addText("؟", { x: W - 1.35, y: iy - 0.33, w: 0.6, h: 0.6, align: "center", valign: "middle", fontSize: 22, bold: true, color: "FFFFFF", ...rtl });
      slide.addText(sl.interaction.prompt, { x: 0.9, y: iy + 0.12, w: W - 2.1, h: 1.1, align: "right", valign: "middle", fontSize: 19, bold: true, color: "7C5A14", ...rtl });
    }

    if (sl.source) {
      slide.addText(`📖 ${sl.source}`, { x: 0.9, y: H - 0.68, w: W - 1.8, h: 0.3, align: "left", fontSize: 9.5, color: "6a6a6a", ...rtl });
    }
    slide.addNotes(speakerNotes(sl));
  });

  return pres;
}

/** تنزيل الملف في المتصفح */
export async function downloadSlidesPptx(p: Presentation, schoolName: string): Promise<void> {
  const pres = await buildSlidesPptx(p, schoolName);
  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `عرض-${p.title}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}
