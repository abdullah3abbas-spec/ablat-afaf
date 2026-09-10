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
  patch: (code: string, dataUrl: string) => void;
  setAll: (map: Record<string, string>) => void;
}

export const useArtStore = create<ArtState>((set) => ({
  lessonArt: {},
  patch: (code, dataUrl) => set((s) => ({ lessonArt: { ...s.lessonArt, [code]: dataUrl } })),
  setAll: (map) => set({ lessonArt: map }),
}));

/** للاستخدام خارج React (مولّدات الطباعة) */
export function storedLessonArt(code?: string): string | undefined {
  if (!code) return undefined;
  return useArtStore.getState().lessonArt[code];
}

/** يُستدعى عند الإقلاع وبعد كل حفظ */
export async function loadArt(): Promise<void> {
  const rows = await db.artAssets.where("kind").equals("lessonArt").toArray().catch(() => []);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.code] = r.dataUrl;
  useArtStore.getState().setAll(map);
}

/** حفظ/استبدال رسمة درس مولّدة — أصل واحد لكل درس */
export async function saveLessonArt(code: string, dataUrl: string): Promise<void> {
  const existing = await db.artAssets.where("[kind+code]").equals(["lessonArt", code]).first();
  if (existing) await db.artAssets.update(existing.id!, { dataUrl, updatedAt: Date.now() });
  else await db.artAssets.add({ kind: "lessonArt", code, dataUrl, createdAt: Date.now() });
  useArtStore.getState().patch(code, dataUrl);
}
