/**
 * يبني src/content/artManifest.ts: قائمة كل الأصول الفنية (jpg) في public
 * — يستخدمها الإحماء الخلفي ليملأ كاش الأوفلاين بهدوء بعد الإقلاع.
 * شغّليه بعد إضافة أي صور جديدة (صور دروس الجزء الثاني مثلاً).
 */
import { readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const urls = [];
for (const dir of readdirSync(pub)) {
  const full = join(pub, dir);
  if (!statSync(full).isDirectory() || !dir.endsWith("-art")) continue;
  for (const f of readdirSync(full).sort()) {
    if (/\.(jpe?g|png)$/i.test(f)) urls.push(`/${dir}/${f}`);
  }
}
const out = `/**
 * قائمة الأصول الفنية المشحونة — مولّدة آلياً بـ node scripts/build-art-manifest.mjs
 * يقرؤها الإحماء الخلفي (pwaWarmup) ليجعل كل الرسمات متاحة بلا إنترنت.
 */
export const ART_MANIFEST: string[] = ${JSON.stringify(urls, null, 1)};
`;
writeFileSync(join(root, "src", "content", "artManifest.ts"), out);
console.log(`artManifest.ts: ${urls.length} أصلاً`);
