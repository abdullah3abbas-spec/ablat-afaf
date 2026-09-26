/**
 * قائمة التجهيز الأسبوعي (§2-ز) — تُطبع صباح الأحد مع حزمة الأسبوع:
 * لكل درس قادم: أدواته من حزمة حصته المشحونة (مربّع شطب أمام كل أداة)،
 * وعدد نسخ ورقة العمل لكل فصل من عدد طالباته الفعلي، ومساحة «نواقص
 * أطلبها قبل الحصة بيومين». كل شيء محلي وجاهز مسبقاً.
 */
import { db } from "@/db";
import { getBrand } from "@/lib/brand";
import { printDoc } from "@/lib/reportPrint";
import { activeStudentsOf } from "@/lib/students";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function printWeekPrep(): Promise<boolean> {
  const brand = getBrand();
  const lessons = (await db.lessons.toArray())
    .filter((l) => !l.deletedAt && !l.isDemo && l.code)
    .sort((a, b) => a.unitId - b.unitId || a.order - b.order)
    .slice(0, 3);
  if (lessons.length === 0) return false;

  const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);
  const counts: { name: string; count: number }[] = [];
  for (const c of classes) counts.push({ name: c.name, count: (await activeStudentsOf(c.id!)).length });
  const totalCopies = counts.reduce((s, c) => s + c.count, 0);

  const sections: string[] = [];
  for (const lesson of lessons) {
    const pack = (await db.lessonPacks.where("lessonId").equals(lesson.id!).toArray())
      .filter((p) => !p.deletedAt)
      .sort((a, b) => (b.status === "approved" ? 1 : 0) - (a.status === "approved" ? 1 : 0))[0];
    const materials = pack?.content.teacherNotes.materials ?? [];
    sections.push(`
    <section class="wp-lesson">
      <h2>درس: ${esc(lesson.title)}</h2>
      <h3>الأدوات والمواد</h3>
      ${materials.length ? `<ul class="wp-check">${materials.map((m) => `<li><span class="box"></span>${esc(m)}</li>`).join("")}</ul>` : `<p class="wp-empty">حزمة هذا الدرس بلا قائمة أدوات — راجعي الحزمة</p>`}
      <h3>نسخ ورقة العمل</h3>
      <table class="wp-table"><tr><th>الفصل</th>${counts.map((c) => `<th>${esc(c.name)}</th>`).join("")}<th>المجموع</th></tr>
      <tr><td>عدد النسخ</td>${counts.map((c) => `<td>${c.count}</td>`).join("")}<td><b>${totalCopies}</b></td></tr></table>
    </section>`);
  }

  printDoc(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>قائمة التجهيز الأسبوعي</title><style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Tajawal, Arial, sans-serif; color: #253243; margin: 0; }
    h1 { font-size: 22px; color: #A34460; border-bottom: 3px solid #12796F; padding-bottom: 8px; }
    .wp-sub { color: #55606e; font-size: 13px; margin-top: -4px; }
    .wp-lesson { margin-top: 14px; border: 1.5px solid #E5DFD2; border-radius: 12px; padding: 10px 14px; page-break-inside: avoid; }
    h2 { font-size: 16px; color: #12796F; margin: 4px 0 8px; }
    h3 { font-size: 13.5px; color: #7C5A14; margin: 10px 0 6px; }
    .wp-check { list-style: none; padding: 0; margin: 0; columns: 2; }
    .wp-check li { margin-bottom: 6px; break-inside: avoid; }
    .box { display: inline-block; width: 13px; height: 13px; border: 2px solid #253243; border-radius: 3px; margin-inline-end: 7px; vertical-align: -2px; }
    .wp-table { border-collapse: collapse; width: 100%; }
    .wp-table th, .wp-table td { border: 1px solid #C9C2B2; padding: 4px 8px; text-align: center; font-size: 13px; }
    .wp-table th { background: #F3EEE2; }
    .wp-empty { color: #8a6d1f; font-size: 13px; }
    .wp-short { margin-top: 16px; border: 2px dashed #A34460; border-radius: 12px; padding: 10px 14px; }
    .wp-short p { margin: 4px 0; border-bottom: 1px dotted #C9C2B2; height: 22px; }
  </style></head><body>
    <h1>قائمة التجهيز الأسبوعي 🧰</h1>
    <p class="wp-sub">${esc(brand.schoolName)} · ${esc(brand.subjectName)} · الدروس الثلاثة القادمة · اطلبي أي ناقص قبل حصته بيومين على الأقل</p>
    ${sections.join("")}
    <section class="wp-short"><h2>نواقص أطلبها من المدرسة ✍</h2><p></p><p></p><p></p></section>
  </body></html>`);
  return true;
}
