// يبني فهرس صور الشرائح المشحونة من محتويات public/slide-art
import { readdirSync, writeFileSync } from "node:fs";

const files = readdirSync("public/slide-art").filter((f) => f.endsWith(".jpg")).sort();
const entries = files.map((f) => {
  const m = f.match(/^(\d+)-(\d+)-(\d+)\.jpg$/);
  if (!m) return null;
  return `  "${m[1]}.${m[2]}#${m[3]}": "/slide-art/${f}",`;
}).filter(Boolean);
const out = `/**
 * فهرس صور الشرائح المشحونة مع المنصّة — مولّد آلياً من public/slide-art
 * (node scripts/build-slide-art-manifest.mjs) — لا تحرّريه يدوياً.
 * المفتاح: «رمز الدرس#رقم الشريحة». المولّدة على الجهاز تتقدّم على هذه.
 */
export const SLIDE_ART: Record<string, string> = {
${entries.join("\n")}
};
`;
writeFileSync("src/content/slideArtManifest.ts", out);
console.log("manifest:", entries.length);
