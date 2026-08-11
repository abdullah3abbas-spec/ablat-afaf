/**
 * توليد ورقة الرصد الذكية وطباعتها — طباعة المتصفح حصراً (§5):
 * نبني HTML بالملّيمتر من هندسة sheetLayout، نفتحه في iframe مخفي،
 * ونستدعي print(). المتصفح يشكّل العربية بشكل مثالي.
 */
import QRCode from "qrcode";
import type { GradeComponent, Klass, Student } from "@/db/schema";
import { GRID, MARK, MARK_CENTERS, MAX_PER_SHEET, nameCell, PAGE, scoreBoxes, sheetCode } from "./sheetLayout";

export interface SheetData {
  klass: Klass;
  component: GradeComponent;
  students: Student[];
  subjectName: string;
  schoolName: string;
  dateMs: number;
}

/** يبني HTML صفحة (أو صفحات) الورقة كاملة */
export async function buildSheetHtml(data: SheetData): Promise<string> {
  const { klass, component, students, subjectName, schoolName, dateMs } = data;
  const code = sheetCode(klass.id!, component.id!, dateMs);
  const qrDataUrl = await QRCode.toDataURL(code, { margin: 0, width: 96 });
  const dateStr = new Date(dateMs).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });

  // ورقة لكل ٢٦ طالبة
  const pages: string[] = [];
  for (let p = 0; p * MAX_PER_SHEET < students.length; p++) {
    const slice = students.slice(p * MAX_PER_SHEET, (p + 1) * MAX_PER_SHEET);
    pages.push(pageHtml(slice, p));
  }

  function pageHtml(slice: Student[], pageIndex: number): string {
    const marks = MARK_CENTERS.map(
      (c) => `<div class="mark" style="right:${PAGE.w - c.x - MARK.size / 2}mm;top:${c.y - MARK.size / 2}mm"></div>`
    ).join("");

    const boxes = scoreBoxes(slice.length)
      .map((b) => {
        const st = slice[b.index];
        const nc = nameCell(b.index);
        return `
        <div class="score-box" style="right:${PAGE.w - b.x - b.w}mm;top:${b.y}mm;width:${b.w}mm;height:${b.h}mm"></div>
        <div class="name" style="right:${PAGE.w - nc.x - nc.w}mm;top:${nc.y}mm;width:${nc.w}mm;height:${GRID.rowH}mm">
          <span class="roll">${st.rollNumber}</span>
          <span class="nm">${escapeHtml(st.name)}</span>
        </div>`;
      })
      .join("");

    return `
    <div class="page">
      ${marks}
      <div class="header">
        <div class="h-line1">${escapeHtml(schoolName)} — ورقة رصد الدرجات</div>
        <div class="h-line2">
          الفصل: <b>${escapeHtml(klass.name)}</b> · المادة: <b>${escapeHtml(subjectName)}</b> ·
          التقييم: <b>${escapeHtml(component.nameAr)}</b> ·
          الدرجة العظمى: <b>${component.maxMark}</b> · التاريخ: <b>${dateStr}</b>
          ${pages.length > 1 ? `· صفحة ${pageIndex + 1}` : ""}
        </div>
        <div class="h-hint">اكتبي الدرجة داخل المربع بقلم أزرق أو أسود غامق — رقماً واضحاً في وسط المربع</div>
      </div>
      <img class="qr" src="${qrDataUrl}" alt="${code}" />
      <div class="code">${code}</div>
      ${boxes}
    </div>`;
  }

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>ورقة رصد — ${escapeHtml(klass.name)} — ${escapeHtml(component.nameAr)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: "Tajawal", "Segoe UI", sans-serif; }
  .page { position: relative; width: ${PAGE.w}mm; height: ${PAGE.h}mm; page-break-after: always; overflow: hidden; }
  .mark { position: absolute; width: ${MARK.size}mm; height: ${MARK.size}mm; background: #000; }
  .header { position: absolute; top: 10mm; right: 26mm; left: 26mm; text-align: center; }
  .h-line1 { font-size: 15pt; font-weight: 700; }
  .h-line2 { font-size: 11pt; margin-top: 2mm; }
  .h-hint { font-size: 9pt; color: #444; margin-top: 2mm; }
  .qr { position: absolute; top: 24mm; left: 12mm; width: 14mm; height: 14mm; }
  .code { position: absolute; top: 39mm; left: 8mm; width: 22mm; font-size: 6.5pt; text-align: center; direction: ltr; }
  .score-box { position: absolute; border: 0.6mm solid #000; border-radius: 1mm; }
  .name { position: absolute; display: flex; align-items: center; gap: 2mm; font-size: 11pt; }
  .roll { display: inline-flex; align-items: center; justify-content: center; min-width: 7mm; height: 7mm;
          border: 0.3mm solid #999; border-radius: 50%; font-size: 9pt; }
  .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>${pages.join("")}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** طباعة عبر iframe مخفي — «حفظ كـ PDF» من حوار المتصفح (§5) */
export function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // نزيله بعد مهلة كافية لحوار الطباعة
    setTimeout(() => iframe.remove(), 60_000);
  };
}
