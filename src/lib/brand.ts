/**
 * هوية المنصّة المرنة — «أي أبلة، نفس المميزات».
 * كل ما يخصّ هوية المعلّمة والمدرسة (الاسم، المادة، الترويسة، الشعارات)
 * يُقرأ من الإعدادات مع افتراضيات «أبلة عفاف / مدرسة زكريت»، فتتخصّص
 * المنصّة لأي معلّمة من شاشة الإعدادات دون لمس الكود (§1: صفر أسئلة تقنية).
 * الصور المخصّصة تُخزَّن Data URL محلياً في قاعدة البيانات — لا شيء يغادر الجهاز.
 */
import { create } from "zustand";
import { db } from "@/db";

export interface BrandProfile {
  /** اسم المنصّة كما يظهر في الشريط الجانبي والرئيسية */
  platformName: string;
  /** اسم المعلّمة المختصر للترحيب («أبلة عفاف») */
  teacherNick: string;
  /** اسم المعلّمة الرسمي للتوقيعات والترويسات */
  teacherName: string;
  schoolName: string;
  /** اسم المادة — يدخل في التذييلات وسطر الإهداء وترويسة الأوراق */
  subjectName: string;
  /** صورة الترويسة الرسمية بعرض الصفحة (Data URL مخصّصة أو الملف المحلي الافتراضي) */
  letterheadUrl: string;
  /** شعار الوزارة (يمين الشهادة) وشعار المدرسة (شمالها) */
  ministryMarkUrl: string;
  schoolMarkUrl: string;
}

export const BRAND_DEFAULT: BrandProfile = {
  platformName: "منصّة أبلة عفاف",
  teacherNick: "أبلة عفاف",
  teacherName: "عفاف حسين",
  schoolName: "مدرسة زكريت الابتدائية للبنات",
  subjectName: "العلوم",
  letterheadUrl: "/letterhead.png",
  ministryMarkUrl: "/cert-art/mark-ministry.png",
  schoolMarkUrl: "/cert-art/mark-school.png",
};

interface BrandState {
  brand: BrandProfile;
  patch: (p: Partial<BrandProfile>) => void;
}

export const useBrandStore = create<BrandState>((set) => ({
  brand: { ...BRAND_DEFAULT },
  patch: (p) => set((s) => ({ brand: { ...s.brand, ...p } })),
}));

/** للاستخدام خارج React (مولّدات الطباعة) — يعيد الهوية الحالية */
export function getBrand(): BrandProfile {
  return useBrandStore.getState().brand;
}

/** يُستدعى عند إقلاع التطبيق وبعد كل حفظ في الإعدادات.
 *  يبني الهوية كاملة من الافتراضيات ثم يطبّق التخصيصات — فمسح أي حقل يعيد افتراضيّه فوراً. */
export async function loadBrand(): Promise<void> {
  const st = await db.settings.get(1);
  if (!st) return;
  const p: BrandProfile = { ...BRAND_DEFAULT };
  if (st.platformName?.trim()) p.platformName = st.platformName.trim();
  if (st.teacherName?.trim()) {
    p.teacherName = st.teacherName.trim();
    p.teacherNick = `أبلة ${st.teacherName.trim().replace(/^أ\.\s*/, "").split(" ")[0]}`;
  }
  if (st.schoolName?.trim()) p.schoolName = st.schoolName.trim();
  if (st.subjectName?.trim()) p.subjectName = st.subjectName.trim();
  if (st.letterheadDataUrl) p.letterheadUrl = st.letterheadDataUrl;
  if (st.ministryMarkDataUrl) p.ministryMarkUrl = st.ministryMarkDataUrl;
  if (st.schoolMarkDataUrl) p.schoolMarkUrl = st.schoolMarkDataUrl;
  useBrandStore.setState({ brand: p });
}

/** سطر الإهداء الافتراضي في الشهادات — يتبع اسم المادة */
export function grantLineDefault(): string {
  return `تتشرّف إدارة المدرسة ومعلّمة ${getBrand().subjectName} بإهداء هذه الشهادة إلى`;
}
