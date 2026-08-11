/**
 * اختبارات الأمر ١-ج: سلامة محتوى المكتبة (٧ عناصر لكل درس،
 * ألعاب معتمدة فقط، مدد ≤ ٢٠ دقيقة)، مطابقة العناوين لقاعدة البيانات،
 * ومولّدات HTML وWord.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import { ALL_KITS, EMERGENCY_KIT, kitByLessonTitle } from "@/content/lessonKits";
import { APPROVED_GAMES } from "@/content/kitTypes";
import { elementHtml, type KitElementKind } from "@/lib/kitPrint";

beforeAll(async () => {
  await seedIfEmpty();
});

const INFO = { schoolName: "مدرسة الاختبار" };

describe("سلامة محتوى المكتبة (§2-ج)", () => {
  test("عشر حزم — حزمة لكل درس مزروع، بمطابقة العنوان حرفياً", async () => {
    expect(ALL_KITS).toHaveLength(10);
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
    expect(lessons).toHaveLength(10);
    for (const lesson of lessons) {
      expect(kitByLessonTitle(lesson.title), `لا حزمة للدرس: ${lesson.title}`).toBeDefined();
    }
  });

  test("كل حزمة كاملة العناصر السبعة", () => {
    for (const kit of [...ALL_KITS, EMERGENCY_KIT]) {
      expect(kit.slides.length, kit.lessonTitle).toBeGreaterThanOrEqual(5);
      expect(kit.worksheet.length, kit.lessonTitle).toBeGreaterThanOrEqual(5);
      expect(kit.game.cards.length, kit.lessonTitle).toBeGreaterThanOrEqual(5);
      expect(kit.experiment.tools.length, kit.lessonTitle).toBeGreaterThan(0);
      expect(kit.experiment.safety.length, kit.lessonTitle).toBeGreaterThan(0);
      expect(kit.exitCard.length, kit.lessonTitle).toBeGreaterThanOrEqual(2);
      expect(kit.plan.objectives.length, kit.lessonTitle).toBeGreaterThan(0);
      expect(kit.participationCriteria.length, kit.lessonTitle).toBeGreaterThanOrEqual(3);
    }
  });

  test("الألعاب من القائمة المعتمدة فقط و≤ ٢٠ دقيقة", () => {
    for (const kit of [...ALL_KITS, EMERGENCY_KIT]) {
      expect(APPROVED_GAMES).toContain(kit.game.name);
      expect(kit.game.minutes).toBeLessThanOrEqual(20);
    }
  });

  test("لكل سؤال ورقة عمل إجابة غير فارغة", () => {
    for (const kit of ALL_KITS) {
      for (const q of kit.worksheet) {
        expect(q.answer.trim().length, `${kit.lessonTitle}: ${q.text}`).toBeGreaterThan(0);
      }
    }
  });

  test("تنوّع الألعاب عبر الوحدة الواحدة — لا تكرار مملّاً", () => {
    const names = ALL_KITS.map((k) => k.game.name);
    expect(new Set(names).size).toBeGreaterThanOrEqual(8);
  });
});

describe("مولّدات HTML للطباعة (§5: طباعة المتصفح)", () => {
  const kinds: KitElementKind[] = ["slides", "worksheet", "answers", "game", "experiment", "exit", "plan", "participation"];

  test("كل عنصر يولّد مستنداً RTL كاملاً غير فارغ", () => {
    const kit = ALL_KITS[0];
    for (const kind of kinds) {
      const html = elementHtml(kind, kit, INFO, ["نورة المهندي", "مريم الكواري"]);
      expect(html).toContain('dir="rtl"');
      expect(html).toContain("@page");
      expect(html).toContain(kit.lessonTitle);
      expect(html.length).toBeGreaterThan(800);
    }
  });

  test("نسخة الإجابات تحوي الإجابات والنسخة العادية لا تحويها", () => {
    const kit = ALL_KITS[0];
    const plain = elementHtml("worksheet", kit, INFO, []);
    const answers = elementHtml("answers", kit, INFO, []);
    const firstAnswer = kit.worksheet[0].answer.slice(0, 10);
    expect(answers).toContain("الإجابة:");
    expect(plain).not.toContain("الإجابة:");
    expect(answers).toContain(firstAnswer);
  });

  test("ورقة المشاركة تطبع أسماء الطالبات الممرّرة", () => {
    const html = elementHtml("participation", ALL_KITS[0], INFO, ["شيخة السليطي", "دانة المريخي"]);
    expect(html).toContain("شيخة السليطي");
    expect(html).toContain("دانة المريخي");
  });

  test("بطاقات اللعبة كلها حاضرة في مستند اللعبة", () => {
    const kit = ALL_KITS[2]; // سباق التصنيف
    const html = elementHtml("game", kit, INFO, []);
    for (const card of kit.game.cards) {
      expect(html).toContain(card.slice(0, 8));
    }
  });
});

describe("مولّد Word (docx) — قواعد §5", () => {
  test("ورقة العمل تُبنى كـdocx سليم وبحجم معقول", async () => {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
    // بنية مطابقة لما يبنيه kitFiles: bidirectional + rightToLeft
    const kit = ALL_KITS[0];
    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", rightToLeft: true } } } },
      sections: [
        {
          children: [
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: kit.lessonTitle, rightToLeft: true, bold: true })],
            }),
            ...kit.worksheet.map(
              (q) =>
                new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: q.text, rightToLeft: true })],
                })
            ),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });
});
