/**
 * ملف الطالبة الغائبة (§2-ز) — حزمة واحدة بضغطة من شاشة الحضور:
 * صفحة «ما فاتكِ اليوم» (خلاصات الدرس + مفردات + الواجب من حزمة الحصة)
 * ثم ورقة عمل الدرس من البنك. كل شيء محلي وجاهز مسبقاً — لا توليد.
 */
import { db } from "@/db";
import { BOOK_GLOSSARY, bookLessonByCode } from "@/content/bookG05S1P1";
import { lessonArtUrl } from "@/lib/kidTheme";
import { getBrand } from "@/lib/brand";
import { bankWorksheetHtml, printDoc } from "@/lib/reportPrint";

/** جسد مستند (بلا غلاف <html>) — لدمج عدة مستندات طباعية في ملف واحد */
function bodyOf(fullHtml: string): string {
  return fullHtml.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * يبني ويطبع ملف الغائبة لدرسٍ ما. اسم الطالبة يُطبع محلياً فقط.
 * يعيد false إن لم يوجد للدرس محتوى كتاب (فلا ملف يُبنى).
 */
export async function printAbsentFile(lessonId: number, studentName: string): Promise<boolean> {
  const lesson = await db.lessons.get(lessonId);
  if (!lesson?.code) return false;
  const found = bookLessonByCode(lesson.code);
  if (!found) return false;
  const brand = getBrand();

  const pack = (await db.lessonPacks.where("lessonId").equals(lessonId).toArray())
    .filter((p) => !p.deletedAt)
    .sort((a, b) => (b.status === "approved" ? 1 : 0) - (a.status === "approved" ? 1 : 0))[0];
  const homework = pack?.content.homework.tasks ?? [];

  const questions = (await db.questions.where("lessonId").equals(lessonId).toArray())
    .filter((q) => !q.deletedAt)
    .slice(0, 8);

  const art = lessonArtUrl(lesson.code);
  const cover = `
  <section class="af-page">
    <header class="af-head">
      ${art ? `<img class="af-art" src="${art}" alt=""/>` : ""}
      <div>
        <h1>ما فاتكِ اليوم يا ${esc(studentName)} 🌷</h1>
        <p class="af-sub">${esc(brand.schoolName)} · ${esc(brand.subjectName)} · درس: ${esc(found.lesson.title)} (الكتاب ص${found.lesson.pageStart}–${found.lesson.pageEnd})</p>
      </div>
    </header>
    <h2>خلاصة الدرس</h2>
    <ul class="af-list">${found.lesson.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <h2>مفردات تعلّمناها</h2>
    <ul class="af-vocab">${found.lesson.vocab
      .map((v) => {
        const def = BOOK_GLOSSARY.find((g) => g.term === v.term || g.term.startsWith(v.term))?.def;
        return `<li><b>${esc(v.term)}:</b> ${def ? esc(def) : `راجعي قاموس الكتاب ص146–149`}</li>`;
      })
      .join("")}</ul>
    ${homework.length ? `<h2>واجبكِ في البيت</h2><ul class="af-list">${homework.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <p class="af-note">حلّي ورقة العمل في الصفحة التالية وأحضريها معكِ غداً — نوّرتِنا بعودتكِ 🌸</p>
  </section>`;

  const worksheet =
    questions.length > 0
      ? bodyOf(
          bankWorksheetHtml(
            questions,
            { schoolName: brand.schoolName, title: `ورقة عمل: ${found.lesson.title}`, unitName: found.unit.title, lessonCode: lesson.code },
            false
          )
        )
      : "";

  printDoc(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>ملف الغائبة — ${esc(studentName)}</title><style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Tajawal, Arial, sans-serif; color: #253243; margin: 0; }
    .af-page { page-break-after: always; }
    .af-head { display: flex; gap: 12px; align-items: center; border-bottom: 3px solid #12796F; padding-bottom: 10px; margin-bottom: 14px; }
    .af-art { width: 84px; height: 84px; object-fit: cover; border-radius: 12px; }
    h1 { font-size: 22px; margin: 0; color: #A34460; }
    .af-sub { margin: 4px 0 0; color: #55606e; font-size: 13px; }
    h2 { font-size: 16px; color: #12796F; border-inline-start: 5px solid #C7952F; padding-inline-start: 8px; margin: 16px 0 8px; }
    .af-list li, .af-vocab li { margin-bottom: 6px; line-height: 1.7; }
    .af-note { margin-top: 18px; background: #FBF8F0; border: 1.5px dashed #C7952F; border-radius: 10px; padding: 10px 12px; font-weight: 700; }
  </style></head><body>${cover}${worksheet}</body></html>`);
  return true;
}
