/**
 * مولّد عيّنة بيانات للمهارات (تشغيل تطويري فقط، ليس جزءاً من التطبيق).
 * يشغّل زرع التطبيق الحقيقي تحت fake-indexeddb، يضيف درجات ونقاطاً تجريبية،
 * ثم يكتب data/منصة-عفاف-بيانات.json ليجرّب عليه الـskills.
 *
 * التشغيل:  npx vite-node scripts/genSampleData.mts
 */
import "fake-indexeddb/auto";
import { writeFileSync, mkdirSync } from "node:fs";
import { db, seedIfEmpty } from "@/db";
import { ensureGradeComponents, leafComponents } from "@/lib/gradeComponents";
import { collectAllData, dataFileName } from "@/lib/dataExport";

const NOW = new Date("2026-08-12T08:00:00").getTime();

function rnd(a: number, b: number): number {
  let t = (a * 73856093) ^ (b * 19349663);
  t = (t ^ (t >>> 13)) >>> 0;
  return (t % 1000) / 1000;
}

async function main() {
  await seedIfEmpty();

  const pol = (await db.assessmentPolicy.toArray())[0];
  const ayId = pol.academicYearId;

  // درجات الفصل الأول لكل الطالبات (بعضها دون النجاح لتنويع التقارير)
  const comps1 = await ensureGradeComponents(ayId, 1);
  const leaves = leafComponents(comps1);
  const students = (await db.students.toArray()).filter((s) => !s.deletedAt);
  if ((await db.grades.count()) === 0) {
    const rows = students.flatMap((st) =>
      leaves.map((c) => {
        const frac = 0.45 + 0.5 * rnd(st.id!, c.id!);
        const mark = Math.max(0, Math.min(c.maxMark, Math.round(c.maxMark * frac)));
        return { studentId: st.id!, classId: st.classId, academicYearId: ayId, term: 1 as const, gradeComponentId: c.id!, mark, source: "manual" as const, createdAt: NOW };
      })
    );
    await db.grades.bulkAdd(rows);
  }

  // نقاط تحفيزية لأوائل الطالبات كي تُظهر التقارير مستوياتٍ
  if ((await db.points.count()) === 0) {
    const rules = await db.pointRules.toArray();
    const prows = students.slice(0, 12).flatMap((st, i) => {
      const n = 1 + (i % 4);
      return Array.from({ length: n }, (_, k) => {
        const rule = rules[(i + k) % rules.length];
        return { studentId: st.id!, classId: st.classId, ruleKey: rule.key, points: rule.points, reason: rule.nameAr, createdAt: NOW - k * 86400000 };
      });
    });
    await db.points.bulkAdd(prows);
  }

  // سجلّا تواصل مع ولي الأمر لاختبار parent-report
  if ((await db.parentContacts.count()) === 0) {
    const first = students[0];
    await db.parentContacts.bulkAdd([
      { studentId: first.id!, date: NOW - 7 * 86400000, channel: "whatsapp", reason: "متابعة مستوى", summary: "تم إبلاغ ولية الأمر بتحسّن المشاركة", outcome: "وعدت بالمتابعة المنزلية", createdAt: NOW - 7 * 86400000 },
    ]);
  }

  const data = await collectAllData(NOW);
  mkdirSync("data", { recursive: true });
  const json = JSON.stringify(data, null, 2);
  writeFileSync("data/منصة-عفاف-بيانات.json", json, "utf8");
  console.log(`✅ ${dataFileName(NOW)} → data/منصة-عفاف-بيانات.json`);
  console.log(`   الحجم: ${Math.round(json.length / 1024)} ك.ب · طالبات: ${students.length} · درجات: ${await db.grades.count()} · أسئلة: ${await db.questions.count()}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
