/**
 * هندسة ورقة الرصد الذكية — مصدر الحقيقة الواحد.
 *
 * كل الأبعاد بالملّيمتر على A4 (210×297). نفس الدوال تُستخدم في:
 * ١) توليد الورقة للطباعة (CSS بالملّيمتر)
 * ٢) اقتطاع المربعات بعد تصحيح المنظور (تحويل مم ← بكسل)
 * لهذا لا نقرأ الأسماء إطلاقاً — موضع كل مربع معلوم مسبقاً (§2-ب).
 */

export const PAGE = { w: 210, h: 297 } as const;

/** علامات المحاذاة: مربعات سوداء 8مم، مركزها على بعد 12مم من الحافتين */
export const MARK = { size: 8, inset: 12 } as const;

/** مراكز العلامات الأربع بالترتيب: أعلى-يمين، أعلى-يسار، أسفل-يمين، أسفل-يسار */
export const MARK_CENTERS: { x: number; y: number }[] = [
  { x: PAGE.w - MARK.inset, y: MARK.inset },
  { x: MARK.inset, y: MARK.inset },
  { x: PAGE.w - MARK.inset, y: PAGE.h - MARK.inset },
  { x: MARK.inset, y: PAGE.h - MARK.inset },
];

/** مربع الدرجة: 20×15مم — أكبر من الحد الأدنى 18×14 (§2-ب) */
export const BOX = { w: 20, h: 15 } as const;

/** منطقة الجدول: عمودان (يمين أولاً في RTL) × 13 صفاً */
export const GRID = {
  top: 52,
  rowH: 17.5,
  rows: 13,
  cols: 2,
  /** حدود العمودين من اليمين (RTL): [يمين، يسار] */
  colX: [
    { nameX: 108, boxX: 110 - BOX.w - 4, rollX: 196 }, // العمود الأيمن
    { nameX: 12, boxX: 14, rollX: 100 }, // العمود الأيسر — placeholder يُحسب أدناه
  ],
} as const;

export interface CellRect {
  /** موضع مربع الدرجة بالملّيمتر (زاوية يسار-أعلى) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** ترتيب الطالبة في الكشف (صفرّي) */
  index: number;
}

/**
 * مواضع مربعات الدرجات لعدد طالبات معيّن.
 * الترتيب: العمود الأيمن من أعلى لأسفل (1..13)، ثم الأيسر (14..26).
 */
export function scoreBoxes(studentCount: number): CellRect[] {
  const half = PAGE.w / 2;
  const boxes: CellRect[] = [];
  for (let i = 0; i < Math.min(studentCount, GRID.rows * GRID.cols); i++) {
    const col = Math.floor(i / GRID.rows); // 0 = يمين، 1 = يسار
    const row = i % GRID.rows;
    const y = GRID.top + row * GRID.rowH + (GRID.rowH - BOX.h) / 2;
    // العمود الأيمن يشغل النصف الأيمن [half..PAGE.w]، والمربع في يساره
    const x = col === 0 ? half + 6 : 12;
    boxes.push({ x, y, w: BOX.w, h: BOX.h, index: i });
  }
  return boxes;
}

/** صف الاسم المرافق لكل مربع (للطباعة فقط — لا يُقرأ أبداً) */
export function nameCell(index: number): { x: number; y: number; w: number; col: 0 | 1 } {
  const half = PAGE.w / 2;
  const col = (Math.floor(index / GRID.rows) as 0 | 1) ?? 0;
  const row = index % GRID.rows;
  const y = GRID.top + row * GRID.rowH;
  // الاسم يمين المربع (في RTL): العمود الأيمن اسمه في أقصى اليمين
  const x = col === 0 ? half + 6 + BOX.w + 3 : 12 + BOX.w + 3;
  const w = col === 0 ? PAGE.w - 12 - x : half - 6 - x;
  return { x, y, w, col };
}

/** أقصى عدد طالبات في الورقة الواحدة */
export const MAX_PER_SHEET = GRID.rows * GRID.cols;

/**
 * تحويل مم ← بكسل في الصورة القانونية بعد تصحيح المنظور.
 * scale: بكسل/مم (نستخدم 6 ≈ 152dpi — كافٍ لقراءة الأرقام).
 */
export const CANON_SCALE = 6;
export const CANON = { w: PAGE.w * CANON_SCALE, h: PAGE.h * CANON_SCALE } as const;

export function mmToPx(mm: number): number {
  return Math.round(mm * CANON_SCALE);
}

/** مستطيل المربع بالبكسل داخل الصورة القانونية، مع هامش داخلي يقصّ الإطار */
export function boxPixelRect(cell: CellRect, innerMarginMm = 1.6): { x: number; y: number; w: number; h: number } {
  return {
    x: mmToPx(cell.x + innerMarginMm),
    y: mmToPx(cell.y + innerMarginMm),
    w: mmToPx(cell.w - innerMarginMm * 2),
    h: mmToPx(cell.h - innerMarginMm * 2),
  };
}

/** رمز الورقة: يحمل الفصل والمكوّن والتاريخ — للتوثيق والمطابقة */
export function sheetCode(classId: number, componentId: number, dateMs: number): string {
  const d = new Date(dateMs);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `AA-C${classId}-K${componentId}-${ymd}`;
}
