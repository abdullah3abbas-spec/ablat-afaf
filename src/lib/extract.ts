/**
 * استخراج النصوص من ملفات المصادر — محلي بالكامل، للبحث داخل
 * المحتوى ولمعاينة الشرائح في الاستوديو.
 *
 * pptx/docx: ملفات zip فيها XML — نقرأ عقد النص فقط.
 * pdf: عبر pdfjs-dist (تحميل كسول — مكتبة ثقيلة).
 */
import JSZip from "jszip";

export interface ExtractResult {
  /** النص الكامل للبحث */
  searchText: string;
  /** نص كل شريحة/صفحة على حدة (للمعاينة والاستوديو) */
  slides: string[];
}

/** يزيل وسوم XML ويعيد نصوص <a:t> أو <w:t> مرتبةً */
function xmlTexts(xml: string, tag: "a:t" | "w:t"): string {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "g");
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) parts.push(m[1]);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** عرض تقديمي: نص كل شريحة من ppt/slides/slideN.xml */
export async function extractPptx(data: Blob | ArrayBuffer): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(data);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)![1]);
      const nb = Number(b.match(/slide(\d+)/)![1]);
      return na - nb;
    });
  const slides: string[] = [];
  for (const f of slideFiles) {
    const xml = await zip.files[f].async("string");
    slides.push(xmlTexts(xml, "a:t"));
  }
  return { searchText: slides.join("\n"), slides };
}

/** مستند Word: نص word/document.xml */
export async function extractDocx(data: Blob | ArrayBuffer): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(data);
  const doc = zip.files["word/document.xml"];
  if (!doc) return { searchText: "", slides: [] };
  const xml = await doc.async("string");
  const text = xmlTexts(xml, "w:t");
  return { searchText: text, slides: text ? [text] : [] };
}

/** PDF: نص كل صفحة عبر pdfjs — استيراد كسول لثقل المكتبة */
export async function extractPdf(data: ArrayBuffer): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  // العامل من نفس الحزمة المحلية — لا CDN
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data }).promise;
  const slides: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    slides.push(text);
  }
  void doc.cleanup();
  return { searchText: slides.join("\n"), slides };
}

/** يختار المستخرج المناسب حسب النوع — يعيد فارغاً لما لا يُستخرج */
export async function extractByKind(
  kind: string,
  file: Blob
): Promise<ExtractResult> {
  try {
    if (kind === "pptx") return await extractPptx(file);
    if (kind === "doc") return await extractDocx(file);
    if (kind === "pdf") return await extractPdf(await file.arrayBuffer());
  } catch {
    // ملف تالف أو صيغة غير متوقعة — نتجاهل الاستخراج ولا نفشل الرفع
  }
  return { searchText: "", slides: [] };
}

/** تخمين نوع الملف من امتداده */
export function kindFromFileName(name: string): "pptx" | "pdf" | "image" | "video" | "doc" | "xlsx" | "other" {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["pptx", "ppt"].includes(ext)) return "pptx";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return "video";
  if (["docx", "doc"].includes(ext)) return "doc";
  if (["xlsx", "xls", "csv"].includes(ext)) return "xlsx";
  return "other";
}
