/**
 * اختبارات الأمر ١-أ: حارس الأسماء (§2-هـ)، نظام النسخ (§2-و)،
 * وفلترة المصادر والبحث داخل المحتوى.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import type { Resource } from "@/db/schema";
import { findNamesInContent, guardOutgoingContent } from "@/lib/aiGuard";
import { appendVersion, initialVersion, revertToVersion } from "@/lib/versions";
import { filterResources, searchSnippet } from "@/lib/resources";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("حارس الأسماء — لا يخرج اسم بنت من الجهاز", () => {
  test("يكتشف اسماً كاملاً داخل نص صادر", () => {
    const found = findNamesInContent(
      "أضيفي سؤالاً عن درجة نورة المهندي في الاختبار",
      ["نورة المهندي", "مريم الكواري"]
    );
    expect(found).toEqual(["نورة المهندي"]);
  });

  test("يتجاهل النص النظيف", () => {
    const found = findNamesInContent(
      "أضيفي بعد الشريحة ٦ لعبة جماعية عن دورة الماء",
      ["نورة المهندي"]
    );
    expect(found).toEqual([]);
  });

  test("يطابق رغم التشكيل وفروق الفراغات", () => {
    const found = findNamesInContent("مُلاحظة عن نُورةَ  المهندي!", ["نورة المهندي"]);
    expect(found).toEqual(["نورة المهندي"]);
  });

  test("الفحص الفعلي ضد قاعدة البيانات يمنع اسم طالبة مزروعة", async () => {
    const anyStudent = await db.students.toCollection().first();
    const bad = await guardOutgoingContent(`شرح عن ${anyStudent!.name} وواجباتها`);
    expect(bad.ok).toBe(false);
    expect(bad.foundNames).toContain(anyStudent!.name);

    const good = await guardOutgoingContent("ورقة عمل عن المخاليط والمحاليل");
    expect(good.ok).toBe(true);
  });
});

describe("نظام النسخ — الأصل لا يُمسّ", () => {
  test("النسخة الأولى ثم الإضافة ترقّم تصاعدياً", () => {
    const v1 = initialVersion("عرض-دورة-الماء.pptx", 1000);
    expect(v1).toHaveLength(1);
    expect(v1[0].version).toBe(1);

    const { versions, newVersion } = appendVersion(v1, "عرض-دورة-الماء-معدل.pptx", "إضافة لعبة", 2000);
    expect(newVersion).toBe(2);
    expect(versions).toHaveLength(2);
    // الأصل ما زال موجوداً بلا تغيير
    expect(versions[0]).toEqual(v1[0]);
  });

  test("الاسترجاع نسخة جديدة تشير للقديمة — لا حذف", () => {
    let versions = initialVersion("أصل.pptx", 1000);
    versions = appendVersion(versions, "معدل-١.pptx", "تعديل أول", 2000).versions;
    versions = appendVersion(versions, "معدل-٢.pptx", "تعديل ثانٍ", 3000).versions;

    const r = revertToVersion(versions, 1, 4000, (v) => `استرجاع النسخة ${v}`)!;
    expect(r.newVersion).toBe(4);
    expect(r.versions).toHaveLength(4);
    expect(r.versions[3].basedOnVersion).toBe(1);
    expect(r.versions[3].path).toBe("أصل.pptx");
    // كل النسخ السابقة باقية
    expect(r.versions.map((v) => v.version)).toEqual([1, 2, 3, 4]);
  });

  test("استرجاع نسخة غير موجودة يعيد null", () => {
    expect(revertToVersion(initialVersion("أ.pptx", 1), 99, 2, (v) => `${v}`)).toBeNull();
  });
});

describe("فلترة المصادر والبحث داخل المحتوى", () => {
  const mk = (over: Partial<Resource>): Resource =>
    ({
      title: "مصدر",
      kind: "pdf",
      category: "other",
      createdAt: 0,
      ...over,
    }) as Resource;

  const list: Resource[] = [
    mk({ title: "كتاب العلوم", category: "textbook", searchText: "التغيرات الفيزيائية والكيميائية للمادة" }),
    mk({ title: "ملزمة الوحدة الأولى", category: "workbook", term: 1, searchText: "أسئلة عن المخاليط والمحاليل" }),
    mk({ title: "عرض الجهاز الهضمي", category: "presentation", kind: "pptx", term: 2, unitId: 9 }),
    mk({ title: "محذوف", category: "other", deletedAt: 123 }),
  ];

  test("يستبعد المحذوف ناعماً دائماً", () => {
    expect(filterResources(list, {})).toHaveLength(3);
  });

  test("فلترة بالتصنيف والفصل", () => {
    expect(filterResources(list, { category: "workbook" })).toHaveLength(1);
    expect(filterResources(list, { term: 2 })[0].title).toBe("عرض الجهاز الهضمي");
  });

  test("بحث داخل المحتوى مع توحيد الهمزات والتاء المربوطة", () => {
    // «مخاليط» داخل نص الملزمة
    const hit = filterResources(list, { query: "المخاليط" });
    expect(hit).toHaveLength(1);
    expect(hit[0].title).toBe("ملزمة الوحدة الأولى");
    // همزة مختلفة: «اسئلة» تطابق «أسئلة»
    expect(filterResources(list, { query: "اسئلة" })).toHaveLength(1);
  });

  test("المقتطف يحيط بالكلمة المطلوبة", () => {
    const snip = searchSnippet(list[1], "المخاليط");
    expect(snip).toContain("المخاليط");
  });
});
