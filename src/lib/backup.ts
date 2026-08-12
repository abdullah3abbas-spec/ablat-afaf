/**
 * النسخ الاحتياطي والاستعادة (§7 · الأمر ٩).
 *
 * - نسخة كاملة → ملف JSON واحد يحوي كل شيء (بالصور base64).
 * - استعادة → استبدال كامل بتأكيد مزدوج.
 * - تذكير كل ٧ أيام.
 * - نسخة تلقائية صامتة (نقطة استرجاع) قبل أي حذف/استيراد جماعي.
 *
 * كل شيء محلي — لا يغادر الملف الجهاز إطلاقاً (§7 · §2-هـ).
 */
import { db } from "@/db";

const DAY = 86400000;

/** جداول تحمل حقول Blob تحتاج ترميز base64 عند النسخ */
const BLOB_FIELDS: Record<string, string[]> = {
  students: ["photo"],
  requests: ["attachment"],
  gradeBatches: ["image"],
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export interface FullBackup {
  app: "منصة-عفاف";
  kind: "backup";
  schemaVersion: number;
  createdAt: number;
  tables: Record<string, unknown[]>;
}

/** يبني نسخة كاملة (بالصور base64) — جاهزة للتسلسل JSON */
export async function buildFullBackup(nowMs: number): Promise<FullBackup> {
  const tables: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    if (table.name === "backups") continue; // لا نضمّن النسخ داخل النسخ
    const rows = await table.toArray();
    const blobFields = BLOB_FIELDS[table.name];
    if (blobFields) {
      tables[table.name] = await Promise.all(
        rows.map(async (row) => {
          const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
          for (const f of blobFields) {
            if (copy[f] instanceof Blob) copy[`${f}__b64`] = await blobToDataUrl(copy[f] as Blob);
            delete copy[f];
          }
          return copy;
        })
      );
    } else {
      tables[table.name] = rows;
    }
  }
  return { app: "منصة-عفاف", kind: "backup", schemaVersion: db.verno, createdAt: nowMs, tables };
}

function backupFileName(nowMs: number): string {
  const d = new Date(nowMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

async function recordCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of db.tables) counts[t.name] = await t.count();
  return counts;
}

/** ينزّل نسخة كاملة، يسجّل بياناتها الوصفية، ويحدّث آخر نسخة. */
export async function downloadFullBackup(trigger: "manual" | "auto_7day" = "manual", nowMs = Date.now()): Promise<{ fileName: string; sizeBytes: number }> {
  const backup = await buildFullBackup(nowMs);
  const json = JSON.stringify(backup);
  const fileName = backupFileName(nowMs);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  await db.backups.add({ fileName, sizeBytes: json.length, trigger, recordCounts: await recordCounts(), createdAt: nowMs });
  await db.settings.update(1, { lastBackupAt: nowMs, updatedAt: nowMs });
  return { fileName, sizeBytes: json.length };
}

/**
 * يستعيد نسخة كاملة — يمسح كل الجداول ثم يعيد الإدخال. تأكيد مزدوج في الواجهة.
 * يحتفظ بجدول backups (لا يُستبدل بنقاط استرجاع النسخة القديمة).
 */
export async function restoreFromBackup(backup: FullBackup): Promise<{ ok: boolean; error?: string }> {
  if (backup.app !== "منصة-عفاف" || !backup.tables) return { ok: false, error: "الملف ليس نسخة صالحة للمنصّة." };
  const targets = db.tables.filter((t) => t.name !== "backups");
  await db.transaction("rw", targets, async () => {
    for (const table of targets) {
      await table.clear();
      const rows = backup.tables[table.name];
      if (!rows || rows.length === 0) continue;
      const blobFields = BLOB_FIELDS[table.name];
      const restored = blobFields
        ? rows.map((row) => {
            const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
            for (const f of blobFields) {
              const key = `${f}__b64`;
              if (typeof copy[key] === "string") copy[f] = dataUrlToBlob(copy[key] as string);
              delete copy[key];
            }
            return copy;
          })
        : rows;
      await table.bulkAdd(restored as never[]);
    }
  });
  return { ok: true };
}

/**
 * نسخة صامتة قبل عملية خطيرة — تُخزَّن كنقطة استرجاع داخل جدول backups
 * (لا تنزيل ولا إزعاج). نُبقي آخر ٣ نقاط فقط.
 */
export async function silentBackup(trigger: "before_bulk_delete" | "before_import", nowMs = Date.now()): Promise<void> {
  const backup = await buildFullBackup(nowMs);
  const json = JSON.stringify(backup);
  await db.backups.add({ fileName: backupFileName(nowMs), sizeBytes: json.length, trigger, snapshot: json, createdAt: nowMs });
  // تقليم نقاط الاسترجاع الصامتة إلى آخر ٣
  const points = (await db.backups.toArray()).filter((b) => b.snapshot).sort((a, b) => b.createdAt - a.createdAt);
  for (const old of points.slice(3)) if (old.id) await db.backups.delete(old.id);
}

/** أحدث نقطة استرجاع صامتة (إن وُجدت) */
export async function latestRestorePoint(): Promise<{ id: number; createdAt: number } | null> {
  const points = (await db.backups.toArray()).filter((b) => b.snapshot).sort((a, b) => b.createdAt - a.createdAt);
  const p = points[0];
  return p ? { id: p.id!, createdAt: p.createdAt } : null;
}

/** يستعيد من نقطة استرجاع صامتة مخزّنة */
export async function restoreFromPoint(id: number): Promise<{ ok: boolean; error?: string }> {
  const point = await db.backups.get(id);
  if (!point?.snapshot) return { ok: false, error: "نقطة الاسترجاع غير موجودة." };
  return restoreFromBackup(JSON.parse(point.snapshot) as FullBackup);
}

/** عدد الأيام منذ آخر نسخة (Infinity إن لم توجد) */
export async function daysSinceBackup(nowMs = Date.now()): Promise<number> {
  const last = (await db.settings.get(1))?.lastBackupAt;
  return last ? Math.floor((nowMs - last) / DAY) : Infinity;
}

/** هل حان تذكير النسخ (٧ أيام أو أكثر)؟ */
export async function needsBackupReminder(nowMs = Date.now()): Promise<boolean> {
  return (await daysSinceBackup(nowMs)) >= 7;
}
