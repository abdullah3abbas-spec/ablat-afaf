/**
 * اختبار الاستخراج المحلي للملاحظات الصوتية (§2-ز):
 * تقسيم الجمل، مطابقة الأسماء بالتوحيد العربي، وفرز
 * (نجوم · متابعة · مهام) من كلام عامي حقيقي الشكل.
 */
import { describe, expect, test } from "vitest";
import { extractFromTranscript, matchStudent, splitSentences } from "@/lib/voiceNotes";

const roster = [
  { id: 1, name: "مريم عبد الله المري" },
  { id: 2, name: "نورة المهندي" },
  { id: 3, name: "شيخة الكواري" },
  { id: 4, name: "أمينة السليطي" },
];

describe("مطابقة الأسماء", () => {
  test("الاسم الأول يكفي، وبالتوحيد (ة/ه، أ/ا)", () => {
    expect(matchStudent("نجمة لنوره اليوم", roster)?.id).toBe(2);
    expect(matchStudent("امينه ما فهمت الدرس", roster)?.id).toBe(4);
    expect(matchStudent("جملة بلا أي اسم", roster)).toBeUndefined();
  });
});

describe("التقسيم والاستخراج", () => {
  test("يقسم على الوقف والفواصل", () => {
    expect(splitSentences("نجمة لمريم، وشيخة تحتاج متابعة. ذكريني أطبع الأوراق").length).toBe(3);
  });

  test("كلام عامي كامل يخرج نجوماً ومتابعات ومهاماً بأصحابها", () => {
    const t = "نجمتين لمريم جاوبت ممتاز اليوم، شيخه محتاجة متابعه في السلاسل الغذائية، وذكريني اطبع ورقة العمل لبكره، ونوره نسيت كتابها تاني مره";
    const items = extractFromTranscript(t, roster);
    const star = items.find((x) => x.kind === "star")!;
    expect(star.studentId).toBe(1);
    expect(star.stars).toBe(2);
    const follows = items.filter((x) => x.kind === "follow");
    expect(follows.map((f) => f.studentId).sort()).toEqual([2, 3]);
    const task = items.find((x) => x.kind === "task")!;
    expect(task.text).toContain("اطبع ورقة العمل");
  });

  test("المتابعة تتقدم على النجمة عند التعارض، واسم بلا نمط ⇒ متابعة مقترحة", () => {
    const items = extractFromTranscript("مريم شاطرة لكنها تحتاج متابعة في القراءة. أمينة سألت سؤال غريب اليوم", roster);
    expect(items[0].kind).toBe("follow");
    expect(items[0].studentId).toBe(1);
    expect(items[1].kind).toBe("follow");
    expect(items[1].studentId).toBe(4);
  });

  test("مهمة بلا اسم لا تتحول نجمة، ونص فارغ يعيد لا شيء", () => {
    const items = extractFromTranscript("لازم أجهز أدوات المختبر", roster);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("task");
    expect(extractFromTranscript("", roster)).toEqual([]);
  });
});
