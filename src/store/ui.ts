/**
 * متجر واجهة المستخدم — إعدادات العرض فقط.
 * البيانات الفعلية تبقى في Dexie وتُقرأ بـ useLiveQuery — لا ننسخها هنا.
 * الكتابة تمرّ لصف settings (id=1) في قاعدة البيانات.
 */
import { create } from "zustand";
import type { UpdateSpec } from "dexie";
import { db } from "@/db";
import type { Gender, Numerals, Settings } from "@/db/schema";

export type FontScale = 18 | 20 | 22 | 24;

const FONT_STEPS: FontScale[] = [18, 20, 22, 24];

/** يطبّق حجم الخط على الجذر ويحفظه للإقلاع بلا وميض */
function applyFont(v: FontScale): void {
  document.documentElement.style.fontSize = `${v}px`;
  try {
    localStorage.setItem("fontScale", String(v));
  } catch {
    // التخزين المحلي قد يكون معطلاً — الجلسة الحالية تكفي
  }
}

/** كتابة عابرة لصف الإعدادات — تجاهل الفشل بصمت (الواجهة تبقى مستجيبة) */
function persist(patch: UpdateSpec<Settings>): void {
  db.settings.update(1, patch).catch(() => {});
}

interface UiState {
  hydrated: boolean;
  fontScale: FontScale;
  numeralsTable: Numerals;
  studentGender: Gender;
  currentClassId?: number;
  currentAcademicYearId?: number;
  schoolName: string;
  hydrateFromDb: () => Promise<void>;
  setFontScale: (v: FontScale) => void;
  increaseFont: () => void;
  decreaseFont: () => void;
  setNumeralsTable: (m: Numerals) => void;
  setCurrentClass: (id?: number) => void;
}

export const useUi = create<UiState>((set, get) => ({
  hydrated: false,
  fontScale: 18,
  numeralsTable: "western",
  studentGender: "female",
  schoolName: "",

  /** تُستدعى مرة واحدة بعد الزرع عند الإقلاع */
  hydrateFromDb: async () => {
    const s = await db.settings.get(1);
    const fontScale = (s?.fontScale ?? 18) as FontScale;
    applyFont(fontScale);
    set({
      hydrated: true,
      fontScale,
      numeralsTable: s?.numeralsTable ?? "western",
      studentGender: s?.studentGender ?? "female",
      currentClassId: s?.lastUsedClassId,
      currentAcademicYearId: s?.currentAcademicYearId,
      schoolName: s?.schoolName ?? "",
    });
  },

  setFontScale: (v) => {
    applyFont(v);
    set({ fontScale: v });
    persist({ fontScale: v });
  },
  increaseFont: () => {
    const i = FONT_STEPS.indexOf(get().fontScale);
    get().setFontScale(FONT_STEPS[Math.min(i + 1, FONT_STEPS.length - 1)]);
  },
  decreaseFont: () => {
    const i = FONT_STEPS.indexOf(get().fontScale);
    get().setFontScale(FONT_STEPS[Math.max(i - 1, 0)]);
  },
  setNumeralsTable: (m) => {
    set({ numeralsTable: m });
    persist({ numeralsTable: m });
  },
  setCurrentClass: (id) => {
    set({ currentClassId: id });
    persist({ lastUsedClassId: id });
  },
}));
