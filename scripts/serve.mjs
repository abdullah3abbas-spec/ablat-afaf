/**
 * خادم محلي بسيط بلا أي تبعية — يقدّم مجلد dist للتطبيق المبني.
 * يعمل بلا إنترنت، ويدعم service worker (localhost)، وارتداد SPA لـ index.html.
 * يُستدعى من المشغّل «تشغيل-البرنامج.command».
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname, normalize } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.env.PORT) || 4785;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

async function tryFile(path) {
  try {
    const s = await stat(path);
    if (s.isFile()) return path;
  } catch {
    /* غير موجود */
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    // منع الخروج خارج المجلد
    const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let file = join(ROOT, safe);
    if (safe === "/" || safe === "") file = join(ROOT, "index.html");

    let resolved = await tryFile(file);
    // ارتداد SPA: أي مسار غير موجود بلا امتداد → index.html
    if (!resolved && !extname(file)) resolved = join(ROOT, "index.html");
    if (!resolved) resolved = await tryFile(file);

    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("غير موجود");
      return;
    }

    const body = await readFile(resolved);
    const type = MIME[extname(resolved)] || "application/octet-stream";
    const headers = { "Content-Type": type };
    // service worker من الجذر — لا تخزين للـsw كي تصل التحديثات
    if (resolved.endsWith("sw.js") || resolved.endsWith("registerSW.js")) headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    res.end(body);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("خطأ في الخادم");
    console.error(e);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  ✅ منصّة أبلة عفاف تعمل الآن على:\n     http://localhost:${PORT}\n\n  اتركي هذه النافذة مفتوحة أثناء العمل. لإغلاق البرنامج أغلقي النافذة.\n`);
});
