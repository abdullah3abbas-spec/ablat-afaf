/**
 * تصدير بيانات المنصّة إلى JSON — جسر المهارات (§10 من CLAUDE.md).
 *
 * المهارات في .claude/skills/ تعمل خارج المتصفح (Node)، فلا تصل إلى
 * IndexedDB مباشرة. لذلك تصدّر المعلّمة بياناتها مرة كملف JSON واحد،
 * فتقرأه المهارة وتولّد المخرج (اختبار، شهادة، تقرير…).
 *
 * القاعدة: كل شيء محلي — لا يغادر الملف الجهاز، ولا يُرسل لأي خدمة (§2-هـ).
 * صور الطالبات (Blob) تُستبعد: غير قابلة لـ JSON ولا تحتاجها المهارات.
 */
import { db } from "@/db";

/** رقم إصدار المخطط الحالي — تقرؤه المهارات لتتأكد من التوافق */
export const DATA_EXPORT_SCHEMA = 6;

export interface ExportedData {
  app: "منصة-عفاف";
  schemaVersion: number;
  /** طابع التصدير (epoch ms) */
  exportedAt: number;
  /** كل الجداول كما هي، مفتاحها اسم الجدول */
  tables: Record<string, unknown[]>;
}

/** يفرّغ كل جداول قاعدة البيانات إلى كائن JSON واحد. */
export async function collectAllData(nowMs: number): Promise<ExportedData> {
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    // استبعاد صورة الطالبة (Blob) — لا تُسلسل ولا تحتاجها المهارات
    tables[table.name] =
      table.name === "students"
        ? rows.map((r) => {
            const { photo, ...rest } = r as Record<string, unknown>;
            void photo;
            return rest;
          })
        : rows;
  }
  return { app: "منصة-عفاف", schemaVersion: DATA_EXPORT_SCHEMA, exportedAt: nowMs, tables };
}

/** اسم ملف واضح بالعربية مع التاريخ */
export function dataFileName(nowMs: number): string {
  const d = new Date(nowMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `منصة-عفاف-بيانات-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/** يبني الملف وينزّله عبر المتصفح. يعيد اسم الملف وحجمه (بالكيلوبايت). */
export async function downloadDataJson(nowMs = Date.now()): Promise<{ fileName: string; sizeKb: number }> {
  const data = await collectAllData(nowMs);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileName = dataFileName(nowMs);
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { fileName, sizeKb: Math.round((json.length / 1024) * 10) / 10 };
}
