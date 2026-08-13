/**
 * بناء «مصادر المنهج» المرسلة للبوابة (زكريت م٢/م٣) — مشترك بين
 * «اسألي المنهج» واستوديو العروض. محتوى منهجي فقط، بلا أي اسم طالبة.
 */
import type { Resource } from "@/db/schema";
import type { LessonKit } from "@/content/kitTypes";
import type { AskSource } from "@/lib/aiClient";

/** قصّ نص طويل بحد آمن — لطفاً بالميزانية (حدود البوابة أكبر) */
export const MAX_SOURCE_CHARS = 20_000;
export function clip(text: string): string {
  return text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) + "\n…(اقتُطع الباقي)" : text;
}

/** نص درس جاهز من المكتبة — الشرائح مرقّمة ليستشهد النموذج بها */
export function kitSourceText(kit: LessonKit): string {
  const lines: string[] = [];
  kit.slides.forEach((sl, i) => {
    lines.push(`شريحة ${i + 1}: ${sl.title} — ${sl.bullets.join(" · ")}`);
  });
  kit.worksheet.forEach((q, i) => {
    lines.push(`سؤال ورقة العمل ${i + 1}: ${q.text} (الإجابة: ${q.answer})`);
  });
  return lines.join("\n");
}

export function kitToSource(kit: LessonKit): AskSource {
  return { name: `درس «${kit.lessonTitle}»`, text: clip(kitSourceText(kit)), locator: "حزمة الدرس" };
}

export function resourceToSource(r: Resource): AskSource {
  const text = r.extractedSlides?.length
    ? r.extractedSlides.map((t, i) => `شريحة/صفحة ${i + 1}: ${t}`).join("\n")
    : (r.searchText ?? "");
  return { name: r.title || r.fileName || "ملف مرفوع", text: clip(text) };
}
