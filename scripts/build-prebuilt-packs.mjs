/**
 * يبني src/content/prebuiltPacks.ts من ملفات حزم مولّدة وموثّقة بشرياً.
 * الاستخدام: node scripts/build-prebuilt-packs.mjs <مجلد ملفات JSON>
 * كل ملف: { code, title, provider, model, sourceNames, pack } — ناتج
 * POST /api/generate-lesson-pack بعد مراجعة المحتوى يدوياً (المصطلحات من
 * الكتاب، الصيغة المؤنثة، صحة الإجابات). عند فهرسة أجزاء كتاب جديدة:
 * ولّدي حزم دروسها بنفس المسار ثم أعيدي تشغيل هذا السكربت.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir) {
  console.error("الاستخدام: node scripts/build-prebuilt-packs.mjs <مجلد-الحزم>");
  process.exit(1);
}

const packs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")))
  .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));

const entries = packs
  .map((p) => {
    const meta = { title: p.title, generatedBy: `${p.provider} · ${p.model}`, sourceNames: p.sourceNames };
    return `  ${JSON.stringify(p.code)}: ${JSON.stringify({ ...meta, pack: p.pack }, null, 2).replace(/\n/g, "\n  ")},`;
  })
  .join("\n");

const out = `/**
 * حزم الحصص المبنية مسبقاً — «كل شيء جاهز مسبقاً» (الدستور §2-ج):
 * لكل درس في الكتاب حزمة كاملة مولّدة عبر البوابة وموثّقة بشرياً قبل الشحن،
 * تُزرع مسودةً عند الإقلاع (seedPrebuiltPacksIfMissing) فتجدها المعلّمة
 * «جاهزة — راجعيها فقط»، والاعتماد بضغطتها هي كالمعتاد.
 * مولّد آلياً بـ node scripts/build-prebuilt-packs.mjs — لا تحرّريه يدوياً.
 */
import type { LessonPackContent } from "@/db/schema";

export interface PrebuiltPack {
  title: string;
  generatedBy: string;
  sourceNames: string[];
  pack: LessonPackContent;
}

/** المفتاح: رمز الدرس «1.1» */
export const PREBUILT_PACKS: Record<string, PrebuiltPack> = {
${entries}
};
`;

const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "content", "prebuiltPacks.ts");
writeFileSync(dest, out);
console.log(`prebuiltPacks.ts: ${packs.length} حزمة`);
