/**
 * تضمين الخطوط العربية محلياً داخل مستندات الطباعة (§5).
 * تُقرأ من public/fonts وتُدرج كـ data:URI، فيصبح ملف HTML مكتفياً بذاته
 * ويطبع العربية بشكل مثالي في أي متصفح بلا إنترنت.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./format.mjs";

const FONT_DIR = resolve(PROJECT_ROOT, "public", "fonts");

function faceOrEmpty(family, file, weight) {
  const path = resolve(FONT_DIR, file);
  if (!existsSync(path)) return "";
  const b64 = readFileSync(path).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-display:swap;}`;
}

let cached = null;

/**
 * كتلة @font-face كاملة لـ Amiri (شهادات/اختبارات) وTajawal (واجهة/عمل)
 * وCairo (عناوين). تُحسب مرة وتُخزَّن.
 */
export function fontFaces() {
  if (cached) return cached;
  cached = [
    faceOrEmpty("Amiri", "amiri-arabic-400.woff2", 400),
    faceOrEmpty("Amiri", "amiri-arabic-700.woff2", 700),
    faceOrEmpty("Tajawal", "tajawal-arabic-400.woff2", 400),
    faceOrEmpty("Tajawal", "tajawal-arabic-500.woff2", 500),
    faceOrEmpty("Tajawal", "tajawal-arabic-700.woff2", 700),
    faceOrEmpty("Cairo", "cairo-arabic-700.woff2", 700),
  ]
    .filter(Boolean)
    .join("\n");
  return cached;
}
