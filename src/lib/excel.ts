/**
 * استيراد وتصدير قوائم الطالبات بصيغة Excel (exceljs — محلي).
 * قواعد §5: sheet.views rightToLeft، محاذاة يمين للنصوص ووسط للأرقام.
 */
import ExcelJS from "exceljs";
import type { Student } from "@/db/schema";

/** كلمات تدل على سطر عنوان يجب تجاهله عند الاستيراد */
const HEADER_WORDS = ["الاسم", "اسم الطالبة", "اسم الطالب", "name", "الأسماء"];

/**
 * قراءة أسماء من ملف xlsx: العمود الأول غير الفارغ في الورقة الأولى.
 * يتجاهل سطر العنوان إن وُجد.
 */
export async function readNamesFromExcel(file: File): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const names: string[] = [];
  sheet.eachRow((row) => {
    // أول خلية فيها نص في الصف (يتعامل مع ملفات فيها عمود أرقام أولاً)
    let value = "";
    for (let c = 1; c <= Math.min(row.cellCount, 5); c++) {
      const text = String(row.getCell(c).text ?? "").trim();
      if (text && !/^[0-9٠-٩]+$/.test(text)) {
        value = text;
        break;
      }
    }
    if (!value) return;
    if (HEADER_WORDS.some((h) => value === h || value.startsWith(h))) return;
    names.push(value);
  });
  return names;
}

/** تصدير قائمة فصل إلى ملف xlsx يُنزَّل مباشرة */
export async function exportStudentsToExcel(
  students: Student[],
  className: string,
  labels: { roll: string; name: string; guardian: string; contact: string }
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(className, {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: labels.roll, key: "roll", width: 12 },
    { header: labels.name, key: "name", width: 32 },
    { header: labels.guardian, key: "guardian", width: 24 },
    { header: labels.contact, key: "contact", width: 18 },
  ];

  for (const st of students) {
    sheet.addRow({
      roll: st.rollNumber,
      name: st.name,
      guardian: st.guardianName ?? "",
      contact: st.contactNumber ?? "",
    });
  }

  // ترويسة غامقة + محاذاة (§5): نص يمين، أرقام وسط
  sheet.getRow(1).font = { bold: true };
  sheet.eachRow((row) => {
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    for (const c of [2, 3] as const) {
      row.getCell(c).alignment = { horizontal: "right", readingOrder: "rtl", vertical: "middle" };
    }
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `قائمة-${className}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
