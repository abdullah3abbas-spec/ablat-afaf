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

/** «آخر درس عملتِ عليه» — تفضيل عرض لكل جهاز، يكفي فيه التخزين المحلي */
export interface LastLesson {
  id: number;
  title: string;
}

function readLastLesson(): LastLesson | undefined {
  try {
    const raw = localStorage.getItem("lastLesson");
    if (!raw) return undefined;
    const v = JSON.parse(raw) as LastLesson;
    return typeof v?.id === "number" && typeof v?.title === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

interface UiState {
  hydrated: boolean;
  fontScale: FontScale;
  numeralsTable: Numerals;
  studentGender: Gender;
  currentClassId?: number;
  currentAcademicYearId?: number;
  schoolName: string;
  lastLesson?: LastLesson;
  hydrateFromDb: () => Promise<void>;
  setFontScale: (v: FontScale) => void;
  increaseFont: () => void;
  decreaseFont: () => void;
  setNumeralsTable: (m: Numerals) => void;
  setCurrentClass: (id?: number) => void;
  setLastLesson: (v: LastLesson) => void;
}

export const useUi = create<UiState>((set, get) => ({
  hydrated: false,
  fontScale: 18,
  numeralsTable: "western",
  studentGender: "female",
  schoolName: "",
  lastLesson: readLastLesson(),

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
  setLastLesson: (v) => {
    set({ lastLesson: v });
    try {
      localStorage.setItem("lastLesson", JSON.stringify(v));
    } catch {
      // التخزين المحلي قد يكون معطلاً — الجلسة الحالية تكفي
    }
  },
}));
