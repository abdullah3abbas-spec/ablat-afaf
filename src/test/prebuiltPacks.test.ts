/**
 * اختبار الحزم المبنية مسبقاً (§2-ج): كل درس كتاب يُزرع له مسودة حزمة
 * عند الإقلاع، والزرع آمن التكرار ويحترم حذف المعلّمة، ومحتوى كل حزمة
 * سليم البنية (خطة ٤٥ دقيقة، أسئلة بمفاتيح صحيحة، كرت خروج وواجب).
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import { seedPrebuiltPacksIfMissing } from "@/db/seed";
import { PREBUILT_PACKS } from "@/content/prebuiltPacks";
import { planMinutes } from "@/lib/lessonPack";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("زرع الحزم المبنية مسبقاً", () => {
  test("كل درس كتاب له مسودة حزمة مشحونة", async () => {
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt && !l.isDemo && l.code);
    expect(lessons.length).toBeGreaterThanOrEqual(13);
    const packs = await db.lessonPacks.toArray();
    for (const lesson of lessons) {
      if (!PREBUILT_PACKS[lesson.code as string]) continue;
      const p = packs.find((x) => x.lessonId === lesson.id);
      expect(p, `درس ${lesson.code} بلا حزمة`).toBeTruthy();
      expect(p!.status).toBe("draft");
    }
  });

  test("الزرع آمن التكرار — لا ازدواج", async () => {
    const before = await db.lessonPacks.count();
    await seedPrebuiltPacksIfMissing();
    expect(await db.lessonPacks.count()).toBe(before);
  });

  test("حذف المعلّمة لحزمة لا يعيد زرعها خلف ظهرها", async () => {
    const one = (await db.lessonPacks.toArray())[0];
    await db.lessonPacks.update(one.id!, { deletedAt: Date.now() });
    const before = await db.lessonPacks.count();
    await seedPrebuiltPacksIfMissing();
    expect(await db.lessonPacks.count()).toBe(before);
    await db.lessonPacks.update(one.id!, { deletedAt: undefined });
  });
});

describe("سلامة محتوى كل حزمة مشحونة", () => {
  const codes = Object.keys(PREBUILT_PACKS);

  test("١٣ حزمة لدروس الكتاب", () => {
    expect(codes.length).toBe(13);
  });

  test.each(codes)("حزمة %s: خطة ٤٥ دقيقة وبنية كاملة ومفاتيح إجابات سليمة", (code) => {
    const { pack } = PREBUILT_PACKS[code];
    expect(planMinutes(pack)).toBe(45);
    expect(pack.plan.objectives.length).toBeGreaterThanOrEqual(2);
    expect(pack.opener.text.length).toBeGreaterThan(20);
    expect(pack.discussion.length).toBeGreaterThanOrEqual(3);
    expect(pack.activityIndividual.text.length).toBeGreaterThan(20);
    expect(pack.activityGroup.text.length).toBeGreaterThan(20);
    expect(pack.questions.length).toBeGreaterThanOrEqual(8);
    expect(pack.exitTicket.questions.length).toBeGreaterThanOrEqual(1);
    expect(pack.homework.tasks.length).toBeGreaterThanOrEqual(1);
    for (const q of pack.questions) {
      expect(q.text.length).toBeGreaterThan(5);
      expect(q.answer.length).toBeGreaterThan(0);
      if (q.type === "mcq") {
        expect(q.options?.length).toBeGreaterThanOrEqual(3);
        expect(q.options!.map((o) => o.key)).toContain(q.answer);
      }
    }
  });

  test.each(codes)("حزمة %s: صيغة مؤنثة — لا «الطالب/الطلاب» في المحتوى", (code) => {
    const text = JSON.stringify(PREBUILT_PACKS[code].pack);
    expect(text).not.toMatch(/الطلاب|أيها الطالب|عزيزي الطالب/);
  });
});
