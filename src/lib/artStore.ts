/**
 * مخزن رسمات الدروس المولّدة ذاتياً — «أي درس، رسمته عنده».
 * الرسمات تُولَّد عبر البوابة (بعد موافقة «ما سيُرسل») وتُحفظ محلياً في
 * جدول artAssets، ويقرؤها هذا المخزن مرة عند الإقلاع فتصبح متاحة
 * تزامنياً لكل مولّدات الطباعة (ترويسات أوراق العمل، حزم الدروس، أغلفة العروض).
 * الرسمة المولّدة تتقدّم على ملف /lesson-art/ الثابت إن وُجدا معاً.
 */
import { create } from "zustand";
import { db } from "@/db";

interface ArtState {
  lessonArt: Record<string, string>;
  slideArt: Record<string, string>;
  patch: (kind: "lessonArt" | "slideArt", code: string, dataUrl: string) => void;
  setAll: (lessonArt: Record<string, string>, slideArt: Record<string, string>) => void;
}

export const useArtStore = create<ArtState>((set) => ({
  lessonArt: {},
  slideArt: {},
  patch: (kind, code, dataUrl) => set((s) => ({ [kind]: { ...s[kind], [code]: dataUrl } }) as Partial<ArtState>),
  setAll: (lessonArt, slideArt) => set({ lessonArt, slideArt }),
}));

/** للاستخدام خارج React (مولّدات الطباعة) */
export function storedLessonArt(code?: string): string | undefined {
  if (!code) return undefined;
  return useArtStore.getState().lessonArt[code];
}

/** رسمة شريحة محفوظة — مفتاحها «رمز الدرس#رقم الشريحة» */
export function storedSlideArt(lessonCode: string, slideIndex: number): string | undefined {
  return useArtStore.getState().slideArt[`${lessonCode}#${slideIndex}`];
}

/** يُستدعى عند الإقلاع وبعد كل حفظ */
export async function loadArt(): Promise<void> {
  const rows = await db.artAssets.toArray().catch(() => []);
  const lessons: Record<string, string> = {};
  const slides: Record<string, string> = {};
  for (const r of rows) (r.kind === "slideArt" ? slides : lessons)[r.code] = r.dataUrl;
  useArtStore.getState().setAll(lessons, slides);
}

/** حفظ/استبدال أصل فني — أصل واحد لكل (نوع، رمز) */
export async function saveArt(kind: "lessonArt" | "slideArt", code: string, dataUrl: string): Promise<void> {
  const existing = await db.artAssets.where("[kind+code]").equals([kind, code]).first();
  if (existing) await db.artAssets.update(existing.id!, { dataUrl, updatedAt: Date.now() });
  else await db.artAssets.add({ kind, code, dataUrl, createdAt: Date.now() });
  useArtStore.getState().patch(kind, code, dataUrl);
}

export const saveLessonArt = (code: string, dataUrl: string) => saveArt("lessonArt", code, dataUrl);
