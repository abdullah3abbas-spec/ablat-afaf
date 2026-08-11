/**
 * حارس حدود الذكاء الاصطناعي (§2-هـ):
 * «أي شيء فيه اسم بنت — لا يخرج من الجهاز.»
 *
 * قبل أي إرسال، يفحص المحتوى الصادر ضد كل أسماء الطالبات
 * (حتى المحذوفات ناعماً) ويمنع الإرسال إن وجد أي اسم.
 */
import { db } from "@/db";

export interface GuardResult {
  ok: boolean;
  /** الأسماء التي وُجدت في المحتوى — للعرض في رسالة المنع */
  foundNames: string[];
}

/** توحيد للمقارنة: إزالة التشكيل وضغط الفراغات */
function normalize(text: string): string {
  return text.replace(/[ً-ٰٟ]/g, "").replace(/\s+/g, " ");
}

/**
 * فحص نقي (قابل للاختبار): هل يحوي المحتوى أياً من الأسماء؟
 * يطابق الاسم الكامل، ويكفي وجوده داخل النص.
 */
export function findNamesInContent(content: string, names: string[]): string[] {
  const haystack = normalize(content);
  const found: string[] = [];
  for (const name of names) {
    const needle = normalize(name).trim();
    if (needle.length >= 3 && haystack.includes(needle)) {
      found.push(name);
    }
  }
  return found;
}

/** الفحص الفعلي ضد قاعدة البيانات — يشمل المحذوفات ناعماً احتياطاً */
export async function guardOutgoingContent(content: string): Promise<GuardResult> {
  const students = await db.students.toArray();
  const foundNames = findNamesInContent(
    content,
    students.map((s) => s.name)
  );
  return { ok: foundNames.length === 0, foundNames };
}
