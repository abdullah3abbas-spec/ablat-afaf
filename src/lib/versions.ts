/**
 * نظام النسخ (§2-و): الأصل لا يُمسّ إطلاقاً.
 * كل تعديل نسخة جديدة برقم وسجل، والاسترجاع نسخة جديدة تشير للقديمة.
 * دوال نقية على مصفوفة DocVersion — قابلة للاختبار كاملة.
 */
import type { DocVersion } from "@/db/schema";

/** إنشاء نسخة الأصل (v1) عند أول رفع */
export function initialVersion(fileName: string, now: number): DocVersion[] {
  return [
    {
      version: 1,
      createdAt: now,
      path: fileName,
      editSummary: "النسخة الأصلية — كما رفعتها المعلّمة",
    },
  ];
}

/** إضافة نسخة جديدة بعد تعديل — تعيد المصفوفة الجديدة ورقم النسخة */
export function appendVersion(
  versions: DocVersion[],
  fileName: string,
  editSummary: string,
  now: number
): { versions: DocVersion[]; newVersion: number } {
  const newVersion = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
  return {
    versions: [...versions, { version: newVersion, createdAt: now, path: fileName, editSummary }],
    newVersion,
  };
}

/**
 * استرجاع نسخة قديمة: لا نحذف شيئاً — نضيف نسخة جديدة
 * تحمل basedOnVersion وتصبح الحالية.
 */
export function revertToVersion(
  versions: DocVersion[],
  targetVersion: number,
  now: number,
  summaryTemplate: (v: number) => string
): { versions: DocVersion[]; newVersion: number } | null {
  const target = versions.find((v) => v.version === targetVersion);
  if (!target) return null;
  const newVersion = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
  return {
    versions: [
      ...versions,
      {
        version: newVersion,
        createdAt: now,
        path: target.path,
        editSummary: summaryTemplate(targetVersion),
        basedOnVersion: targetVersion,
      },
    ],
    newVersion,
  };
}
