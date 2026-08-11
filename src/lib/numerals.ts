/**
 * تحويل الأرقام: غربية (0123) ↔ عربية شرقية (٠١٢٣).
 * الافتراضي (§5): غربية في الجداول والدرجات · شرقية في الشهادات والمستندات.
 */
import type { Numerals } from "@/db/schema";

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** يحوّل أي أرقام غربية في النص إلى شرقية */
export function toEastern(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => EASTERN[Number(d)]);
}

/** يحوّل أي أرقام شرقية في النص إلى غربية */
export function toWestern(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));
}

/** تنسيق رقم حسب الوضع المطلوب */
export function fmtNum(value: number | string, mode: Numerals): string {
  return mode === "eastern" ? toEastern(value) : toWestern(String(value));
}
