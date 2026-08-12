/**
 * مساعدات التنسيق العربي المشتركة بين كل مهارات المشروع.
 * كلها بصيغة المؤنث (مدرسة بنات §1) وتحترم قواعد العربية (§5).
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

/** جذر المشروع — ثابت مهما كانت المهارة التي استوردت هذا الملف */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");

/** مجلد مخرجات المعلّمة */
export const OUTPUT_DIR = resolve(PROJECT_ROOT, "المخرجات");

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** تحويل الأرقام الغربية إلى شرقية (٠١٢٣) */
export function toEastern(input) {
  return String(input).replace(/[0-9]/g, (d) => EASTERN[+d]);
}

/**
 * تنسيق رقم حسب الوضع: "eastern" شرقية · "western" غربية (الافتراضي).
 * الجداول والدرجات غربية · الشهادات والمستندات الرسمية شرقية (§5).
 */
export function fmtNum(value, numerals = "western") {
  return numerals === "eastern" ? toEastern(value) : String(value);
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** تاريخ ميلادي يوم/شهر/سنة — بلا اعتماد على ICU لضمان ثبات المخرج (§5) */
export function dateYMD(ms, numerals = "western") {
  const d = new Date(ms);
  return fmtNum(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, numerals);
}

/** تاريخ مطوّل: «١٢ أغسطس ٢٠٢٦» — للشهادات والمستندات الرسمية */
export function dateLong(ms, numerals = "eastern") {
  const d = new Date(ms);
  return `${fmtNum(d.getDate(), numerals)} ${MONTHS_AR[d.getMonth()]} ${fmtNum(d.getFullYear(), numerals)}`;
}

/** اسم اليوم بالعربية */
export function weekdayAr(ms) {
  return WEEKDAYS_AR[new Date(ms).getDay()];
}

/** لاحقة تاريخ لأسماء الملفات: 2026-08-12 */
export function fileDateSuffix(ms = Date.now()) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** تهريب HTML — يمنع كسر المستند بأحرف < > & " */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** يضمن وجود مجلد المخرجات ويعيد مساره */
export function ensureOutputDir() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  return OUTPUT_DIR;
}

/** يكتب ملفاً نصّياً/HTML في المخرجات ويعيد مساره الكامل */
export function writeOutput(fileName, content) {
  ensureOutputDir();
  const full = resolve(OUTPUT_DIR, fileName);
  writeFileSync(full, content, "utf8");
  return full;
}

/** يكتب ملفاً ثنائياً (docx/xlsx) في المخرجات ويعيد مساره */
export function writeOutputBuffer(fileName, buffer) {
  ensureOutputDir();
  const full = resolve(OUTPUT_DIR, fileName);
  writeFileSync(full, buffer);
  return full;
}

/**
 * رسالة الختام الموحّدة — ٣ أسطر بالعربية للمعلّمة (§10).
 * تُطبع في نهاية كل مهارة.
 */
export function finalMessage({ done, howTo, next }) {
  return ["", `✅ ${done}`, `📂 ${howTo}`, `➡️ ${next}`, ""].join("\n");
}

/**
 * محلّل وسائط بسيط: --key value · --flag · قيم متعددة بفواصل.
 * يقبل العربية والإنجليزية في القيم.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

/** يقسّم قيمة إلى قائمة (يقبل الفاصلة العربية ، والإنجليزية ,) */
export function splitList(value) {
  if (value == null || value === true) return [];
  return String(value)
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
