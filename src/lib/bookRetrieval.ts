/**
 * استرجاع من كتاب الوزارة — محلي بالكامل، بلا نماذج:
 * بحث كلمات مفتاحية موزون فوق مقاطع الصفحات (bookText) لبناء مصادر
 * «اسألي المنهج» وحزم الحصص، مع استشهاد بصفحة الكتاب المطبوع.
 *
 * الملف الثقيل (bookText) يُحمَّل كسولاً — لا يدخل حزمة الإقلاع.
 */
import type { AskSource } from "@/lib/aiClient";
import { BOOK_META, bookLessonByCode, type BookLessonMeta, type BookUnitMeta } from "@/content/bookG05S1P1";
import type { BookChunk } from "@/content/bookText";

/** تطبيع عربي للبحث: توحيد الألف والياء وإسقاط التطويل والتشكيل */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

/** تقطيع لكلمات بحث (٣ أحرف فأكثر بعد نزع أل التعريف) */
export function searchTokens(s: string): string[] {
  return normalizeArabic(s)
    .split(/[^ء-يa-z0-9]+/)
    .map((t) => t.replace(/^(ال|وال|بال|لل|فال|كال)/, ""))
    .filter((t) => t.length >= 3);
}

let chunksPromise: Promise<BookChunk[]> | null = null;
/** تحميل مقاطع الكتاب كسولاً (مرة واحدة) */
export function loadBookChunks(): Promise<BookChunk[]> {
  chunksPromise ??= import("@/content/bookText").then((m) => m.BOOK_CHUNKS);
  return chunksPromise;
}

/** ترويسة مصدر موحّدة: «كتاب العلوم (ف١ ج١)» */
const SRC = BOOK_META.shortName;

/** تجميع صفحات متتالية في مصدر واحد كل ~أربع صفحات — يحفظ حد عدد المصادر */
function groupPages(chunks: BookChunk[], label: string, pagesPerSource = 4): AskSource[] {
  const out: AskSource[] = [];
  for (let i = 0; i < chunks.length; i += pagesPerSource) {
    const group = chunks.slice(i, i + pagesPerSource);
    const from = group[0].page;
    const to = group[group.length - 1].page;
    out.push({
      name: `${SRC} — ${label}`,
      locator: from === to ? `ص${from}` : `ص${from}–${to}`,
      text: group.map((c) => `【ص${c.page}】\n${c.text}`).join("\n\n"),
    });
  }
  return out;
}

/** مصادر درس كامل من الكتاب: صفحات الدرس + غلاف وحدته (النواتج الرسمية) */
export async function lessonBookSources(lessonCode: string): Promise<AskSource[]> {
  const found = bookLessonByCode(lessonCode);
  if (!found) return [];
  const { unit, lesson } = found;
  const chunks = await loadBookChunks();

  const opener = chunks.filter((c) => c.unitOrder === unit.order && c.kind === "unit-opener");
  const body = chunks.filter((c) => c.lessonCode === lessonCode);

  const sources: AskSource[] = [];
  if (opener.length > 0) {
    sources.push({
      name: `${SRC} — نواتج الوحدة ${unit.order}: ${unit.title}`,
      locator: `ص${unit.pageStart}`,
      text: opener.map((c) => c.text).join("\n"),
    });
  }
  sources.push(...groupPages(body, `الدرس ${lesson.code}: ${lesson.title}`));
  return sources;
}

/** بيانات الدرس المهيكلة (أهداف/نواتج/مفردات/صفحات) كمصدر نصي مضغوط */
export function lessonMetaSource(unit: BookUnitMeta, lesson: BookLessonMeta): AskSource {
  const outcomes = unit.outcomes.filter((o) => lesson.outcomeCodes.includes(o.code));
  const lines = [
    `الدرس ${lesson.code}: ${lesson.title} — صفحات الكتاب ${lesson.pageStart}–${lesson.pageEnd}`,
    `أهداف الدرس: ${lesson.objectives.join(" · ")}`,
    `نواتج التعلم الرسمية: ${outcomes.map((o) => `${o.code} ${o.text}`).join(" · ")}`,
  ];
  if (lesson.vocab.length > 0) {
    lines.push(`مفردات الدرس: ${lesson.vocab.map((v) => `${v.term} (${v.en})`).join(" · ")}`);
  }
  return { name: `${SRC} — بطاقة الدرس ${lesson.code}`, locator: `ص${lesson.pageStart}`, text: lines.join("\n") };
}

export interface BookHit {
  chunk: BookChunk;
  score: number;
}

/**
 * بحث موزون في صفحات الكتاب: تكرار الكلمة × ندرتها (idf مبسّط)،
 * مع مضاعفة وزن الصفحات الأولى للدروس (العناوين والمفاهيم فيها).
 */
export async function searchBook(query: string, topK = 6): Promise<BookHit[]> {
  const tokens = [...new Set(searchTokens(query))];
  if (tokens.length === 0) return [];
  const chunks = await loadBookChunks();

  const norm = chunks.map((c) => normalizeArabic(c.text));
  // df لكل كلمة عبر الصفحات
  const df = new Map<string, number>();
  for (const t of tokens) {
    let n = 0;
    for (const text of norm) if (text.includes(t)) n++;
    df.set(t, n);
  }

  const hits: BookHit[] = [];
  chunks.forEach((chunk, i) => {
    let score = 0;
    for (const t of tokens) {
      const d = df.get(t) ?? 0;
      if (d === 0) continue;
      const tf = norm[i].split(t).length - 1;
      if (tf === 0) continue;
      const idf = Math.log(1 + chunks.length / d);
      score += tf * idf;
    }
    if (score > 0) {
      // غلاف الوحدة والقاموس مرجعية مكثفة — دفعة خفيفة
      if (chunk.kind === "glossary" || chunk.kind === "unit-opener") score *= 1.3;
      hits.push({ chunk, score });
    }
  });

  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** تحويل نتائج البحث لمصادر «اسألي المنهج» — صفحة لكل مصدر باستشهادها */
export function hitsToSources(hits: BookHit[]): AskSource[] {
  return hits.map(({ chunk }) => {
    const found = chunk.lessonCode ? bookLessonByCode(chunk.lessonCode) : undefined;
    const label = found
      ? `الدرس ${found.lesson.code}: ${found.lesson.title}`
      : chunk.kind === "glossary"
        ? "القاموس"
        : chunk.kind === "unit-opener"
          ? `غلاف الوحدة ${chunk.unitOrder}`
          : chunk.kind === "assessment"
            ? "ماذا أستطيع أن أفعل؟"
            : "الكتاب";
    return {
      name: `${SRC} — ${label}`,
      locator: `ص${chunk.page}`,
      text: `【ص${chunk.page}】\n${chunk.text}`,
    };
  });
}
