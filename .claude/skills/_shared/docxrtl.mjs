/**
 * مساعدات docx بالاتجاه الصحيح للعربية (§5):
 * - bidirectional: true على كل فقرة
 * - rightToLeft: true على كل run
 * - font: "Arial" (يدعم التشكيل في Word)
 * - الجداول: عكس ترتيب الأعمدة يدوياً + visuallyRightToLeft
 */
import { Paragraph, TextRun, AlignmentType } from "docx";

export const FONT = "Arial";

/** run عربي بالاتجاه الصحيح */
export function run(text, opts = {}) {
  return new TextRun({ text: String(text ?? ""), rightToLeft: true, font: FONT, ...opts });
}

/** فقرة عربية محاذاة يمين افتراضياً */
export function para(text, opts = {}) {
  const { alignment = AlignmentType.RIGHT, runs, spacing, heading, ...runOpts } = opts;
  return new Paragraph({
    bidirectional: true,
    alignment,
    spacing,
    heading,
    children: runs ?? [run(text, runOpts)],
  });
}

/** عنوان */
export function heading(text, opts = {}) {
  return para(text, { bold: true, size: opts.size ?? 30, ...opts });
}

/** فقرة فارغة (مسافة) */
export function spacer() {
  return new Paragraph({ bidirectional: true, children: [] });
}

/**
 * خلية جدول بنص عربي — تُبنى مع docx.TableCell خارجياً؛ هذه تعيد children.
 * (نبقيها بسيطة: كل مهارة تبني جداولها بما يناسبها.)
 */
export function cellText(text, opts = {}) {
  return [para(text, { alignment: opts.alignment ?? AlignmentType.CENTER, bold: opts.bold, size: opts.size })];
}
