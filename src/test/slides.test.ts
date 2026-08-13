/**
 * اختبارات العروض البصرية (زكريت م٣):
 * فاحص الجودة (٦٠٪ بصري، حدود الكلمات، إيقاع التفاعل، المصادر)
 * وفاحص مخرج البوابة — هذان يفرضان معيار «النص وحده مرفوض» برمجياً.
 */
import { describe, expect, it } from "vitest";
import type { VisualSlide } from "@/db/schema";
import { qualityCheck, wordCount } from "@/lib/slides";
import { validateSlidesPayload } from "../../gateway/src/logic";

const note = { say: "اشرحي" };
const cover: VisualSlide = { layout: "cover", title: "دورة الماء", note };
const objectives: VisualSlide = { layout: "objectives", title: "الأهداف", bullets: ["هدف"], note };
const visual = (title: string): VisualSlide => ({ layout: "cycle", title, cycle: { steps: ["تبخر", "تكاثف", "هطول"] }, note, source: "الكتاب — ص ١" });
const textOnly = (title: string): VisualSlide => ({ layout: "bullets", title, bullets: ["نقطة"], note, source: "الكتاب — ص ٢" });
const interaction: VisualSlide = {
  layout: "interaction", title: "توقعي", note,
  interaction: { kind: "predict", prompt: "ماذا يحدث؟", answer: "يتبخر" },
};

describe("qualityCheck — فرض معيار «النص وحده مرفوض»", () => {
  it("عرض بصري متوازن يجتاز كل المعايير", () => {
    const r = qualityCheck([cover, objectives, visual("١"), textOnly("٢"), interaction, visual("٣"), visual("٤")]);
    expect(r.visualPct).toBeGreaterThanOrEqual(60);
    expect(r.visualOk).toBe(true);
    expect(r.wordsOk).toBe(true);
    expect(r.interactionOk).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("عرض نصي بحت يفشل في معيار البصري", () => {
    const r = qualityCheck([cover, objectives, textOnly("١"), textOnly("٢"), textOnly("٣")]);
    expect(r.visualOk).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("الغلاف والأهداف خارج حساب النسبة", () => {
    const r = qualityCheck([cover, objectives, visual("١")]);
    expect(r.visualPct).toBe(100);
  });

  it("يرصد الشريحة المكتظة بالكلمات باسمها", () => {
    const wordy: VisualSlide = { layout: "bullets", title: "مكتظة", bullets: [Array.from({ length: 50 }, () => "كلمة").join(" ")], note, source: "س" };
    const r = qualityCheck([cover, wordy]);
    expect(r.wordsOk).toBe(false);
    expect(r.wordySlides).toContain("مكتظة");
  });

  it("يرصد غياب التفاعل لأكثر من ٤ شرائح", () => {
    const r = qualityCheck([cover, visual("١"), visual("٢"), visual("٣"), visual("٤"), visual("٥")]);
    expect(r.interactionOk).toBe(false);
  });

  it("يرصد الشرائح المعلوماتية بلا مصدر", () => {
    const noSrc: VisualSlide = { layout: "bullets", title: "بلا مصدر", bullets: ["ن"], note };
    const r = qualityCheck([cover, noSrc]);
    expect(r.sourcesOk).toBe(false);
    expect(r.unsourced).toContain("بلا مصدر");
  });

  it("wordCount يحسب كل حقول الشريحة", () => {
    expect(wordCount({ layout: "comparison", title: "أ ب", comparison: { headers: ["ج", "د"], rows: [["هـ", "و"]] }, note })).toBe(6);
  });
});

describe("تطبيع انحرافات المولّد الشائعة (كما وقعت فعلاً من Gemini)", () => {
  const base = Array.from({ length: 7 }, (_, i) => ({ layout: "bullets", title: `ش${i}`, bullets: ["ن"], note: { say: "ق" } }));

  it("comparison بالشكل القديم rightLabel/leftLabel يتحول لجدول", () => {
    const r = validateSlidesPayload([...base, { layout: "comparison", title: "م", comparison: { rightLabel: "أ", leftLabel: "ب", rows: [{ right: "١", left: "٢" }] }, note: { say: "ق" } }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slides[7].comparison).toEqual({ headers: ["أ", "ب"], rows: [["١", "٢"]] });
  });

  it("icons مصفوفة مباشرة بعناصر فيها label تُغلَّف وتُدمج", () => {
    const r = validateSlidesPayload([...base, { layout: "icons", title: "أ", icons: [{ icon: "atom", label: "المفهوم", text: "كمية المادة" }], note: { say: "ق" } }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slides[7].icons).toEqual({ items: [{ icon: "atom", text: "المفهوم: كمية المادة" }] });
  });

  it("steps ككائنات {step,title,text} تتحول لنصوص", () => {
    const r = validateSlidesPayload([...base, { layout: "steps", title: "خ", steps: [{ step: 1, title: "التعريف", text: "كل ما له كتلة" }], note: { say: "ق" } }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slides[7].steps).toEqual({ steps: ["التعريف: كل ما له كتلة"] });
  });
});

describe("validateSlidesPayload — فحص مخرج البوابة", () => {
  const good = Array.from({ length: 8 }, (_, i) => ({ layout: "bullets", title: `ش${i}`, bullets: ["ن"], note: { say: "قولي" } }));

  it("يقبل {slides:[…]} والمصفوفة المباشرة", () => {
    expect(validateSlidesPayload({ slides: good }).ok).toBe(true);
    expect(validateSlidesPayload(good).ok).toBe(true);
  });

  it("يرفض العدد خارج الحد وشريحة بلا ملاحظة", () => {
    expect(validateSlidesPayload(good.slice(0, 3)).ok).toBe(false);
    expect(validateSlidesPayload([...good.slice(0, 7), { layout: "bullets", title: "ن", note: { say: "" } }]).ok).toBe(false);
  });

  it("يستبدل أيقونة غير مسموحة بأيقونة آمنة", () => {
    const withIcon = [...good.slice(0, 7), { layout: "icons", title: "أيقونات", icons: { items: [{ icon: "hacker-icon", text: "ن" }] }, note: { say: "ق" } }];
    const r = validateSlidesPayload(withIcon);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ic = r.slides[7].icons!.items[0].icon;
      expect(ic).toBe("sprout");
    }
  });
});
