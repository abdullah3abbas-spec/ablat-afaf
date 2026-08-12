/**
 * غلاف مستند HTML للطباعة (§5 — القاعدة الذهبية):
 * لا نولّد PDF عربياً بمكتبة JS (حروف مقطّعة معكوسة). بل نبني HTML بخطوط
 * مضمّنة، تفتحه المعلّمة وتضغط طباعة ← «حفظ كـ PDF». المتصفح يشكّل العربية
 * بشكل مثالي. التصدير المجمّع = صفحات في مستند واحد بـ page-break-after.
 */
import { fontFaces } from "./fonts.mjs";
import { esc } from "./format.mjs";

/**
 * يبني مستند HTML كامل جاهزاً للطباعة.
 * @param {object} o
 * @param {string} o.title  عنوان المستند (لسان المتصفح)
 * @param {string} o.css    أنماط خاصة بالمخرج (تُدمج بعد الأساس)
 * @param {string} o.body   جسم HTML
 * @param {boolean} [o.autoPrint=true]  فتح حوار الطباعة تلقائياً
 */
export function printableHtml({ title, css = "", body, autoPrint = true }) {
  const auto = autoPrint
    ? `<script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),350)});</script>`
    : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
${fontFaces()}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Tajawal","Amiri",sans-serif;color:#000;background:#fff}
@media print{.no-print{display:none!important}}
${css}
</style></head><body>${body}${auto}</body></html>`;
}
