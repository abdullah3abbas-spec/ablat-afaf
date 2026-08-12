/**
 * official-export — كشف درجات فصل ملف Excel بترتيب أعمدة النظام الرسمي.
 * منقول من src/lib/officialExport.ts. §5: rightToLeft، نص يمين، أرقام وسط.
 * محلي بالكامل (§2-هـ).
 */
import ExcelJS from "exceljs";
import { loadData, leafComponents, termTotal, percentOf, gradeLabel } from "../_shared/data.mjs";
import { parseArgs, fileDateSuffix, ensureOutputDir, finalMessage } from "../_shared/format.mjs";
import { resolve } from "node:path";

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

if (typeof args.class !== "string") {
  console.error('حدّدي الفصل: --class "خامس ١"');
  process.exit(1);
}
const cls = data.resolveClass(args.class);
if (!cls) {
  console.error(`لم أجد فصلاً باسم «${args.class}».`);
  process.exit(1);
}
const term = args.term === "2" ? 2 : 1;

const comps = leafComponents(data.gradeComponents(term));
const students = data.studentsOf(cls.id);
const scale = data.gradeScale();

// ترتيب الأعمدة (يتبع الإعدادات إن ضُبط) — orderColumns منقولة
function orderColumns(available, saved) {
  if (!saved || saved.length === 0) return available;
  const ordered = saved.filter((k) => available.includes(k));
  const missing = available.filter((k) => !ordered.includes(k));
  return [...ordered, ...missing];
}
const available = ["roll", "name", ...comps.map((c) => `comp:${c.key}`), "total", "label"];
const ordered = orderColumns(available, data.settings().officialExportColumns);

const headerOf = (key) => {
  if (key === "roll") return "الرقم في الكشف";
  if (key === "name") return "اسم الطالبة";
  if (key === "total") return "المجموع";
  if (key === "label") return "التقدير";
  const comp = comps.find((c) => `comp:${c.key}` === key);
  return comp ? `${comp.nameAr} (${comp.maxMark})` : key;
};

const wb = new ExcelJS.Workbook();
const sheet = wb.addWorksheet(cls.name, { views: [{ rightToLeft: true }] });

sheet.addRow([`كشف درجات ${data.subject().nameAr} — ${cls.name} — ${term === 1 ? "الفصل الدراسي الأول" : "الفصل الدراسي الثاني"}`]);
sheet.mergeCells(1, 1, 1, ordered.length);
sheet.getCell(1, 1).font = { name: "Arial", bold: true, size: 13 };
sheet.getCell(1, 1).alignment = { horizontal: "center" };

const head = sheet.addRow(ordered.map(headerOf));
head.font = { name: "Arial", bold: true };

for (const st of students) {
  const grades = data.gradesOf(st.id, term);
  const t = termTotal(grades, comps);
  const pct = percentOf(t.total, t.outOf);
  const row = ordered.map((key) => {
    if (key === "roll") return st.rollNumber;
    if (key === "name") return st.name;
    if (key === "total") return t.counted > 0 ? t.total : "";
    if (key === "label") return t.counted > 0 ? gradeLabel(pct, scale) : "";
    const comp = comps.find((c) => `comp:${c.key}` === key);
    if (!comp) return "";
    const live = grades.filter((g) => g.gradeComponentId === comp.id).sort((a, b) => b.createdAt - a.createdAt);
    return live[0]?.mark ?? "";
  });
  sheet.addRow(row);
}

ordered.forEach((key, i) => {
  sheet.getColumn(i + 1).width = key === "name" ? 30 : 14;
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

ensureOutputDir();
const fileName = `كشف-درجات-${cls.name}-${fileDateSuffix()}.xlsx`;
const fullPath = resolve(ensureOutputDir(), fileName);
await wb.xlsx.writeFile(fullPath);

const gradedCount = students.filter((st) => termTotal(data.gradesOf(st.id, term), comps).counted > 0).length;
console.log(
  finalMessage({
    done: `جهّزت كشف درجات ${cls.name} (${students.length} طالبة، رُصد ${gradedCount} منهنّ) بترتيب أعمدة النظام.`,
    howTo: `الملف «${fileName}» في مجلد المخرجات — افتحيه في Excel وارفعيه للنظام أو اطبعيه.`,
    next: "تريدين كشف فصل آخر؟ شغّلي المهارة باسمه. لتغيير ترتيب الأعمدة: من إعدادات التطبيق.",
  })
);
