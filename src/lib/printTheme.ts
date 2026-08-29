/**
 * هوية المطبوعات الرسمية — الترويسة والتذييل من ملفات المدرسة نفسها:
 * ترويسة رسمية (شعار وزارة التربية والتعليم والتعليم العالي — دولة قطر +
 * «مدرسة زكريت الابتدائية للبنات» بخطها الرسمي) مأخوذة صورةً من مستندات
 * المدرسة المرجعية، وتذييل بنمط الوزارة: اسم المستند والعام الدراسي
 * يتكرران أسفل كل صفحة.
 * الأصول محلية في public/‏ (letterhead.png) — لا CDN (§3).
 */

/** خطوط الطباعة المحلية المشتركة */
export const PRINT_FONTS_CSS = `
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Cairo"; src: url("/fonts/cairo-arabic-800.woff2") format("woff2"); font-weight: 800; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
`;

/** أنماط الترويسة الرسمية + تذييل يتكرر في كل صفحة مطبوعة */
export const IDENTITY_HEADER_CSS = `
  .z-official { margin-bottom: 2mm; }
  .z-official img { width: 100%; max-height: 22mm; object-fit: contain; display: block; }
  .z-docline { display: flex; align-items: baseline; justify-content: space-between; gap: 6mm;
               border-bottom: 0.4mm solid #8A1538; padding-bottom: 1.5mm; margin-bottom: 4mm; }
  .z-doctitle { font-family: "Cairo", "Tajawal", sans-serif; font-weight: 800; font-size: 14.5pt; color: #8A1538; }
  .z-docmeta { font-family: "Tajawal", sans-serif; font-size: 10pt; color: #444; }
  /* تذييل ثابت يتكرر أسفل كل صفحة (نمط تذييل الوزارة في التحضير الرسمي) */
  .z-pagefoot { position: fixed; bottom: 0; left: 0; right: 0;
                font-family: "Tajawal", sans-serif; font-size: 8.5pt; color: #777;
                display: flex; justify-content: space-between; gap: 6mm;
                border-top: 0.3mm solid #c9c0b2; padding: 1.2mm 2mm 0; background: #fff; }
  body { padding-bottom: 12mm; }
`;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * الترويسة الرسمية: صورة ترويسة المدرسة والوزارة كاملةً بعرض الصفحة،
 * ثم سطر المستند: عنوانه يميناً وبياناته يساراً.
 * (schoolName يُتجاهل هنا — الاسم داخل الترويسة الرسمية نفسها.)
 */
export function identityHeader(_schoolName: string, docTitle: string, metaLine: string): string {
  return `<div class="z-official"><img src="/letterhead.png" alt="مدرسة زكريت الابتدائية للبنات — وزارة التربية والتعليم والتعليم العالي، دولة قطر" /></div>
  <div class="z-docline">
    <span class="z-doctitle">${esc(docTitle)}</span>
    <span class="z-docmeta">${esc(metaLine)}</span>
  </div>`;
}

/**
 * التذييل الرسمي المتكرر أسفل كل صفحة — بنمط تذييل الوزارة:
 * «{اسم المستند} لمادة العلوم — العام الدراسي {…}».
 */
export function identityFooter(docLabel: string, yearName = ""): string {
  const right = `${docLabel} لمادة العلوم${yearName ? ` — العام الدراسي ${yearName}` : ""}`;
  return `<div class="z-pagefoot"><span>${esc(right)}</span><span>مدرسة زكريت الابتدائية للبنات</span></div>`;
}
