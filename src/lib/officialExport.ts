/**
 * كشف الدرجات الرسمي (Excel): ترتيب الأعمدة يحدَّد مرة واحدة من
 * الإعدادات (ليطابق النظام الرسمي/NSIS) ثم يُعاد استخدامه — §5:
 * الورقة rightToLeft، نص يمين، أرقام وسط، بلا أعمدة زائدة.
 */
import { db } from "@/db";
import type { Term } from "@/db/schema";
import { DEFAULT_GRADE_SCALE } from "@/db/constants";
import { activePolicyOf } from "./policy";
import { gradeLabel, percentOf, termTotal } from "./grades";
import { leafComponents } from "./gradeComponents";
import { orderColumns } from "./reportData";
import { getBrand } from "./brand";

/** تصدير كشف فصلٍ كامل بترتيب الأعمدة المعتمد */
export async function exportOfficialSheet(classId: number, term: Term): Promise<{ ok: boolean }> {
  const klass = await db.classes.get(classId);
  if (!klass) return { ok: false };
  const settings = await db.settings.get(1);
  const policy = await activePolicyOf(klass.academicYearId);
  const comps = leafComponents(
    await db.gradeComponents.where("[academicYearId+term]").equals([klass.academicYearId, term]).toArray()
  );
  const students = (await db.students.where("classId").equals(classId).toArray())
    .filter((s) => !s.deletedAt)
    .sort((a, b) => a.rollNumber - b.rollNumber);

  // الأعمدة المتاحة: ثابتة + مكوّن لكل عمود
  const available = ["roll", "name", ...comps.map((c) => `comp:${c.key}`), "total", "label"];
  const ordered = orderColumns(available, settings?.officialExportColumns);

  const headerOf = (key: string): string => {
    if (key === "roll") return "الرقم في الكشف";
    if (key === "name") return "اسم الطالبة";
    if (key === "total") return "المجموع";
    if (key === "label") return "التقدير";
    const comp = comps.find((c) => `comp:${c.key}` === key);
    return comp ? `${comp.nameAr} (${comp.maxMark})` : key;
  };

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(klass.name, { views: [{ rightToLeft: true }] });

  sheet.addRow([`كشف درجات مادة ${getBrand().subjectName} — ${klass.name} — ${term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني"}`]);
  sheet.mergeCells(1, 1, 1, ordered.length);
  sheet.getCell(1, 1).font = { name: "Arial", bold: true, size: 13 };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };

  const head = sheet.addRow(ordered.map(headerOf));
  head.font = { name: "Arial", bold: true };

  for (const st of students) {
    const grades = (await db.grades.where("studentId").equals(st.id!).toArray()).filter(
      (g) => !g.deletedAt && g.term === term
    );
    const t = termTotal(grades, comps);
    const pct = percentOf(t.total, t.outOf);
    const row = ordered.map((key) => {
      if (key === "roll") return st.rollNumber;
      if (key === "name") return st.name;
      if (key === "total") return t.counted > 0 ? t.total : "";
      if (key === "label") return t.counted > 0 ? gradeLabel(pct, policy?.gradeScale ?? DEFAULT_GRADE_SCALE) : "";
      const comp = comps.find((c) => `comp:${c.key}` === key);
      if (!comp) return "";
      const live = grades.filter((g) => g.gradeComponentId === comp.id).sort((a, b) => b.createdAt - a.createdAt);
      return live[0]?.mark ?? "";
    });
    sheet.addRow(row);
  }

  ordered.forEach((key, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = key === "name" ? 30 : 14;
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell, colNumber) => {
      cell.font = cell.font ?? { name: "Arial" };
      const key = ordered[colNumber - 1];
      cell.alignment =
        key === "name" || key === "label"
          ? { horizontal: "right", readingOrder: "rtl", vertical: "middle" }
          : { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `كشف-درجات-${klass.name}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}
