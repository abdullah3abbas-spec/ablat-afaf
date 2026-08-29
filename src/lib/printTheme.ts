/**
 * هوية المطبوعات الموحّدة — ترويسة زكريت لكل ما يخرج من المنصّة ورقاً
 * (أوراق العمل، الحزم، الإثراء، بطاقات أولياء الأمور…):
 * شعار نجمة السدو + اسم المدرسة + سطر السياق + خيط سدو منسوج.
 * ورقة الاختبار الرسمية مستثناة عمداً — شكل الوزارة الصارم (§5).
 */

/** خطوط الطباعة المحلية المشتركة */
export const PRINT_FONTS_CSS = `
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Cairo"; src: url("/fonts/cairo-arabic-800.woff2") format("woff2"); font-weight: 800; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
`;

/** أنماط ترويسة الهوية — ألوان زكريت ثابتة في الطباعة */
export const IDENTITY_HEADER_CSS = `
  .z-head { display: flex; align-items: center; gap: 4mm; padding-bottom: 3mm; }
  .z-emblem { width: 13mm; height: 13mm; flex: none; border-radius: 50%;
              border: 0.5mm solid #C08A2E; background: radial-gradient(circle at 35% 30%, #7d1b3f, #4A091D);
              display: flex; align-items: center; justify-content: center; }
  .z-emblem svg { width: 8mm; height: 8mm; fill: #E5C98F; }
  .z-school { font-family: "Cairo", "Tajawal", sans-serif; font-weight: 800; font-size: 13.5pt; color: #4A091D; line-height: 1.4; }
  .z-doc { font-family: "Tajawal", sans-serif; font-size: 10.5pt; color: #444; line-height: 1.5; }
  .z-title-side { margin-inline-start: auto; text-align: start; font-family: "Cairo", "Tajawal", sans-serif;
                  font-weight: 800; font-size: 15pt; color: #8A1538; }
  .z-sadu { height: 2.8mm; margin-bottom: 5mm;
            background: repeating-conic-gradient(from 45deg at 50% 50%, #C08A2E 0 25%, transparent 0 50%) 0 0 / 2.8mm 2.8mm,
                        linear-gradient(to left, #4A091D, #8A1538); }
  .z-footer { margin-top: 6mm; padding-top: 2mm; border-top: 0.3mm solid #ddd;
              font-family: "Tajawal", sans-serif; font-size: 9pt; color: #8a8a8a;
              display: flex; justify-content: space-between; }
`;

const STAR_PATH =
  '<path d="M12 1.5 14.6 7l5.9-1.5L17 10.4l4.5 4-6-.4-1 5.9-2.5-5.5-5.4 2.7 2.7-5.4L3.8 9.2l6 .3L11 3.6Z" opacity=".3"/><path d="M12 3.5 13.9 9l5.6.2-4.4 3.4 1.6 5.4L12 14.8 7.3 18l1.6-5.4L4.5 9.2 10.1 9Z"/><circle cx="12" cy="11.6" r="1.7" fill="#4A091D"/>';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * ترويسة الهوية: الشعار + المدرسة وسطر السياق يميناً، وعنوان المستند يساراً،
 * ثم خيط السدو فاصلاً.
 */
export function identityHeader(schoolName: string, docTitle: string, metaLine: string): string {
  return `<div class="z-head">
    <div class="z-emblem"><svg viewBox="0 0 24 24" aria-hidden="true">${STAR_PATH}</svg></div>
    <div>
      <div class="z-school">${esc(schoolName)}</div>
      <div class="z-doc">${esc(metaLine)}</div>
    </div>
    <div class="z-title-side">${esc(docTitle)}</div>
  </div>
  <div class="z-sadu"></div>`;
}

/** تذييل موحّد خفيف: المنصّة يميناً وتاريخ/سطر حر يساراً */
export function identityFooter(left = ""): string {
  return `<div class="z-footer"><span>منصّة أبلة عفاف — مدرسة زكريت الابتدائية للبنات</span><span>${esc(left)}</span></div>`;
}
