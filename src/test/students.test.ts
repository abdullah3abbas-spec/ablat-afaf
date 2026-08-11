/**
 * اختبارات منطق الطالبات: لصق القائمة، الترقيم، النقل، الحذف والتراجع، الفرز.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { db, seedIfEmpty } from "@/db";
import {
  addStudent,
  addStudentsBulk,
  compareStudents,
  nextRollNumber,
  parseNameList,
  softDeleteClass,
  softDeleteStudent,
  transferStudent,
  type StudentWithStats,
} from "@/lib/students";

beforeAll(async () => {
  await seedIfEmpty();
});

describe("لصق قائمة الأسماء", () => {
  test("كل سطر اسم، مع تنظيف الفراغات", () => {
    const r = parseNameList("نورة المهندي\n  مريم الكواري  \n\nعائشة النعيمي\n");
    expect(r.names).toEqual(["نورة المهندي", "مريم الكواري", "عائشة النعيمي"]);
    expect(r.duplicates).toBe(0);
  });

  test("يزيل الترقيم اليدوي في أول السطر", () => {
    const r = parseNameList("1- نورة المهندي\n٢. مريم الكواري\n3) عائشة النعيمي");
    expect(r.names).toEqual(["نورة المهندي", "مريم الكواري", "عائشة النعيمي"]);
  });

  test("يتجاهل المكرر داخل اللصق وضد أسماء الفصل", () => {
    const r = parseNameList("نورة المهندي\nنورة المهندي\nهند العطية", ["هند العطية"]);
    expect(r.names).toEqual(["نورة المهندي"]);
    expect(r.duplicates).toBe(2);
  });

  test("نص فارغ = لا أسماء", () => {
    expect(parseNameList("\n  \n").names).toEqual([]);
  });
});

describe("الترقيم التلقائي والإضافة", () => {
  test("دفعة جديدة تكمل الترقيم من آخر رقم", async () => {
    const classId = (await db.classes.toArray())[0].id!;
    const before = await nextRollNumber(classId);
    expect(before).toBe(26); // الفصل المزروع فيه 25

    const ids = await addStudentsBulk(classId, ["اختبار أولى", "اختبار ثانية"]);
    const added = await db.students.bulkGet(ids);
    expect(added.map((s) => s!.rollNumber)).toEqual([26, 27]);

    // تنظيف
    await db.students.bulkDelete(ids);
  });

  test("إضافة واحدة ثم حذفها ناعماً لا يعيد استخدام رقمها", async () => {
    const classId = (await db.classes.toArray())[0].id!;
    const id = await addStudent(classId, "مؤقتة للاختبار");
    const roll = (await db.students.get(id))!.rollNumber;

    await softDeleteStudent(id);
    // المحذوفة ناعماً تحجز رقمها
    expect(await nextRollNumber(classId)).toBe(roll + 1);

    await db.students.delete(id); // تنظيف فعلي في الاختبار فقط
  });
});

describe("الحذف الناعم والتراجع", () => {
  test("حذف طالبة ثم التراجع يعيدها", async () => {
    const classId = (await db.classes.toArray())[0].id!;
    const id = await addStudent(classId, "قابلة للتراجع");

    const undo = await softDeleteStudent(id);
    expect((await db.students.get(id))!.deletedAt).toBeDefined();

    await undo();
    expect((await db.students.get(id))!.deletedAt).toBeUndefined();

    await db.students.delete(id);
  });

  test("حذف فصل يحذف طالباته كوحدة والتراجع يعيد الجميع", async () => {
    const yearId = (await db.academicYears.toArray())[0].id!;
    const subjectId = (await db.subjects.toArray())[0].id!;
    const classId = await db.classes.add({
      name: "فصل مؤقت",
      academicYearId: yearId,
      subjectId,
      createdAt: Date.now(),
    });
    await addStudentsBulk(classId, ["أ", "ب", "ج"]);

    const undo = await softDeleteClass(classId);
    expect((await db.classes.get(classId))!.deletedAt).toBeDefined();
    const deleted = await db.students.where("classId").equals(classId).toArray();
    expect(deleted.every((s) => s.deletedAt)).toBe(true);

    await undo();
    expect((await db.classes.get(classId))!.deletedAt).toBeUndefined();
    const restored = await db.students.where("classId").equals(classId).toArray();
    expect(restored.every((s) => !s.deletedAt)).toBe(true);

    // تنظيف
    await db.students.where("classId").equals(classId).delete();
    await db.classes.delete(classId);
  });
});

describe("النقل بين الفصول", () => {
  test("النقل يغيّر الفصل ويمنح رقماً جديداً ويسجّل التاريخ", async () => {
    const classes = await db.classes.toArray();
    const from = classes[0].id!;
    const to = classes[1].id!;

    const id = await addStudent(from, "منقولة للاختبار");
    const toNext = await nextRollNumber(to);

    await transferStudent(id, to);
    const st = (await db.students.get(id))!;

    expect(st.classId).toBe(to);
    expect(st.rollNumber).toBe(toNext);
    expect(st.classHistory).toHaveLength(1);
    expect(st.classHistory![0].fromClassId).toBe(from);
    expect(st.classHistory![0].toClassId).toBe(to);
    expect(st.classHistory![0].date).toBeGreaterThan(0);

    await db.students.delete(id);
  });

  test("النقل لنفس الفصل لا يفعل شيئاً", async () => {
    const classId = (await db.classes.toArray())[0].id!;
    const id = await addStudent(classId, "ثابتة");
    const before = (await db.students.get(id))!;

    await transferStudent(id, classId);
    const after = (await db.students.get(id))!;
    expect(after.rollNumber).toBe(before.rollNumber);
    expect(after.classHistory).toBeUndefined();

    await db.students.delete(id);
  });
});

describe("الفرز", () => {
  const mk = (name: string, roll: number, total: number, points: number): StudentWithStats =>
    ({ name, rollNumber: roll, classId: 1, createdAt: 0, total, points }) as StudentWithStats;

  test("بالاسم عربياً", () => {
    const list = [mk("ياسمين", 1, 0, 0), mk("آمنة", 2, 0, 0), mk("بدرية", 3, 0, 0)];
    list.sort((a, b) => compareStudents(a, b, "name"));
    expect(list.map((s) => s.name)).toEqual(["آمنة", "بدرية", "ياسمين"]);
  });

  test("بالمجموع تنازلياً ثم بالرقم عند التساوي", () => {
    const list = [mk("أ", 2, 80, 0), mk("ب", 1, 95, 0), mk("ج", 3, 80, 0)];
    list.sort((a, b) => compareStudents(a, b, "total"));
    expect(list.map((s) => s.name)).toEqual(["ب", "أ", "ج"]);
  });

  test("بالنقاط تنازلياً", () => {
    const list = [mk("أ", 1, 0, 10), mk("ب", 2, 0, 50)];
    list.sort((a, b) => compareStudents(a, b, "points"));
    expect(list[0].name).toBe("ب");
  });
});
