/**
 * البحث الشامل (§ الأمر ٦ البند ٨): كلمة واحدة تُظهر كل ما يتعلق بها
 * عبر الدروس والوحدات والأسئلة والمصادر والتجارب والاختبارات — بلا
 * أي اسم طالبة (لا نبحث في الطالبات أو الملاحظات السلوكية).
 */
import { db } from "@/db";

export type SearchKind = "lesson" | "unit" | "question" | "resource" | "exam" | "worksheet";

export interface SearchHit {
  kind: SearchKind;
  id: number;
  title: string;
  subtitle?: string;
  /** مسار التنقّل */
  to: string;
}

/** توحيد عربي: بلا تشكيل، همزات وتاء مربوطة موحّدة */
function norm(s: string): string {
  return s
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

const KIND_LABEL: Record<SearchKind, string> = {
  lesson: "درس",
  unit: "وحدة",
  question: "سؤال",
  resource: "مصدر",
  exam: "اختبار",
  worksheet: "ورقة عمل",
};

export function kindLabel(kind: SearchKind): string {
  return KIND_LABEL[kind];
}

/** البحث الشامل — يعيد نتائج مصنّفة بالنوع */
export async function universalSearch(query: string): Promise<SearchHit[]> {
  const q = norm(query);
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];

  const units = (await db.units.toArray()).filter((u) => !u.deletedAt);
  for (const u of units) {
    if (norm(u.title).includes(q)) hits.push({ kind: "unit", id: u.id!, title: u.title, to: `/curriculum` });
  }

  const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt);
  for (const l of lessons) {
    const outcomes = (l.learningOutcomes ?? []).map((o) => o.text).join(" ");
    if (norm(`${l.title} ${outcomes}`).includes(q)) {
      hits.push({ kind: "lesson", id: l.id!, title: l.title, subtitle: units.find((u) => u.id === l.unitId)?.title, to: `/library/${l.id}` });
    }
  }

  const questions = (await db.questions.toArray()).filter((x) => !x.deletedAt);
  for (const x of questions) {
    if (norm(x.text).includes(q)) hits.push({ kind: "question", id: x.id!, title: x.text.slice(0, 80), to: `/questions` });
  }

  const resources = (await db.resources.toArray()).filter((r) => !r.deletedAt);
  for (const r of resources) {
    if (norm(`${r.title} ${r.searchText ?? ""}`).includes(q)) {
      hits.push({ kind: "resource", id: r.id!, title: r.title, to: `/resources` });
    }
  }

  const exams = (await db.exams.toArray()).filter((e) => !e.deletedAt);
  for (const e of exams) {
    if (norm(e.title).includes(q)) hits.push({ kind: "exam", id: e.id!, title: e.title, to: `/exams/${e.id}/build` });
  }

  const worksheets = (await db.worksheets.toArray()).filter((w) => !w.deletedAt);
  for (const w of worksheets) {
    if (norm(w.title).includes(q)) hits.push({ kind: "worksheet", id: w.id!, title: w.title, to: `/worksheets` });
  }

  return hits;
}
