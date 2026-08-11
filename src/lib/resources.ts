/**
 * منطق مركز المصادر: الرفع (مقبض أو Blob صغير)، القراءة، البحث والفلترة.
 *
 * §7: الملف يبقى في مكانه — نخزّن المقبض (المرجع) لا البايتات.
 * البديل للمتصفحات بلا مقابض: Blob للملفات ≤ الحد فقط.
 */
import { db } from "@/db";
import type { Resource, ResourceCategory, Term } from "@/db/schema";
import { extractByKind, kindFromFileName } from "./extract";
import { initialVersion } from "./versions";

/** أقصى حجم يُخزَّن Blob حين لا تتوفر المقابض (٢٥ م.ب) */
export const MAX_BLOB_BYTES = 25 * 1024 * 1024;

/** هل المتصفح يدعم مقابض نظام الملفات؟ */
export function supportsFileHandles(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export interface UploadInput {
  file: File;
  handle?: FileSystemFileHandle;
  category: ResourceCategory;
  term?: Term;
  unitId?: number;
  lessonId?: number;
}

/** رفع مصدر واحد: استخراج النص + تخزين المرجع + نسخة أصلية للعروض */
export async function addResource(input: UploadInput): Promise<number> {
  const { file, handle, category, term, unitId, lessonId } = input;
  const now = Date.now();
  const kind = kindFromFileName(file.name);
  const { searchText, slides } = await extractByKind(kind, file);

  const settings = await db.settings.get(1);
  const subject = await db.subjects.toCollection().first();

  const resource: Resource = {
    title: file.name.replace(/\.[^.]+$/, ""),
    kind,
    category,
    fileName: file.name,
    handle,
    // بلا مقبض: نخزّن الملف نفسه إن كان صغيراً (وإلا يرفضه المستدعي)
    blob: handle ? undefined : file,
    sizeBytes: file.size,
    grade: 5,
    term,
    unitId,
    lessonId,
    subjectId: subject?.id,
    academicYearId: settings?.currentAcademicYearId,
    searchText: searchText || undefined,
    extractedSlides: slides.length > 0 ? slides : undefined,
    versions: kind === "pptx" || kind === "doc" ? initialVersion(file.name, now) : undefined,
    currentVersion: kind === "pptx" || kind === "doc" ? 1 : undefined,
    createdAt: now,
  };
  return db.resources.add(resource);
}

/** قراءة بايتات مصدر: من المقبض (بعد إذن) أو من الـBlob المخزّن */
export async function readResourceFile(resource: Resource): Promise<Blob | null> {
  if (resource.handle) {
    const perm = await resource.handle.queryPermission({ mode: "read" });
    if (perm !== "granted") {
      const req = await resource.handle.requestPermission({ mode: "read" });
      if (req !== "granted") return null;
    }
    return resource.handle.getFile();
  }
  return resource.blob ?? null;
}

// ── البحث والفلترة (نقية — قابلة للاختبار) ────────────────────

export interface ResourceFilter {
  query?: string;
  category?: ResourceCategory | "all";
  term?: Term | 0;
  unitId?: number | 0;
}

/** توحيد للبحث العربي: بلا تشكيل، همزات موحّدة، فراغات مضغوطة */
function normalizeSearch(text: string): string {
  return text
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** فلترة قائمة مصادر حسب الاستعلام والتصنيف والفصل والوحدة */
export function filterResources(list: Resource[], f: ResourceFilter): Resource[] {
  const q = f.query ? normalizeSearch(f.query.trim()) : "";
  return list.filter((r) => {
    if (r.deletedAt) return false;
    if (f.category && f.category !== "all" && r.category !== f.category) return false;
    if (f.term && r.term !== f.term) return false;
    if (f.unitId && r.unitId !== f.unitId) return false;
    if (q) {
      const hay = normalizeSearch(
        [r.title, r.fileName ?? "", (r.tags ?? []).join(" "), r.searchText ?? ""].join("\n")
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** أين وردت الكلمة؟ مقتطف قصير حول أول ورود في نص المحتوى */
export function searchSnippet(resource: Resource, query: string, radius = 40): string | null {
  if (!resource.searchText || !query.trim()) return null;
  const hay = normalizeSearch(resource.searchText);
  const idx = hay.indexOf(normalizeSearch(query.trim()));
  if (idx < 0) return null;
  // نقتطع من النص الأصلي بنفس الموضع تقريباً
  const start = Math.max(0, idx - radius);
  const end = Math.min(resource.searchText.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + resource.searchText.slice(start, end) + (end < resource.searchText.length ? "…" : "");
}
