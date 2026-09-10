/**
 * نظام «فين أنا؟» — مصدر واحد للأقسام الخمسة ومساراتها وألوانها:
 * كل قسم له لون ثابت يظهر في الشريط الجانبي والسفلي وشريط المسار،
 * فتعرف المعلّمة مكانها من اللون والاسم معاً (§6: لا لون وحده — دائماً مع نص).
 * يستهلكه: Sidebar · BottomNav · شريط المسار في TopBar.
 */
import { BookOpen, ClipboardCheck, Presentation, Settings, Sun, Users, type LucideIcon } from "lucide-react";

export type SectionKey = "today" | "prep" | "teach" | "students" | "follow";

export interface SectionDef {
  key: SectionKey;
  to: string;
  prefixes: string[];
  icon: LucideIcon;
  /** خلفية فاتحة + نص داكن (رقاقة المسار) */
  chip: string;
  /** خلفية داكنة + نص أبيض (العنصر النشط في التنقّل) — تباين AA محقّق */
  solid: string;
  /** لون الأيقونة على الفاتح */
  tint: string;
}

/** خمسة أفعال من يوم المعلّمة — كل ميزة تتبع فعلاً واحداً فقط */
export const SECTIONS: SectionDef[] = [
  {
    key: "today", to: "/", prefixes: [], icon: Sun,
    chip: "bg-gold-bg text-gold-dark", solid: "bg-gold-dark text-white", tint: "text-gold-dark",
  },
  {
    key: "prep", to: "/prep", icon: BookOpen,
    prefixes: ["/prep", "/library", "/pack", "/slides", "/ask", "/exams", "/worksheets", "/questions", "/curriculum", "/resources", "/studio"],
    chip: "bg-teal-bg text-teal-dark", solid: "bg-teal-dark text-white", tint: "text-teal-dark",
  },
  {
    key: "teach", to: "/teach", icon: Presentation,
    prefixes: ["/teach", "/tools", "/class", "/lab", "/show"],
    chip: "bg-maroon-bg text-maroon-dark", solid: "bg-maroon text-white", tint: "text-maroon",
  },
  {
    key: "students", to: "/classes", icon: Users,
    prefixes: ["/classes", "/students", "/attendance", "/points"],
    chip: "bg-green-bg text-green-dark", solid: "bg-green-dark text-white", tint: "text-green-dark",
  },
  {
    key: "follow", to: "/follow", icon: ClipboardCheck,
    prefixes: ["/follow", "/manage", "/grades", "/reports", "/certificates", "/analytics", "/requests", "/search", "/settings"],
    chip: "bg-marina-bg text-marina", solid: "bg-marina text-white", tint: "text-marina",
  },
];

export const SETTINGS_ICON = Settings;

/** مطابقة على حدود المقاطع — «/class» لا تبتلع «/classes» */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** عناوين الشاشات حسب أول مقطع من المسار — تُعرض في شريط المسار */
export const ROUTE_TITLES: Record<string, string> = {
  library: "المكتبة",
  pack: "حزمة الدرس",
  slides: "استوديو العروض",
  ask: "اسألي المنهج",
  exams: "الاختبارات",
  worksheets: "أوراق العمل",
  questions: "بنك الأسئلة",
  curriculum: "المنهج والتوزيع",
  resources: "مركز المصادر",
  studio: "استوديو الملف",
  tools: "أدوات الحصة",
  class: "وضع الفصل",
  lab: "المختبر التفاعلي",
  classes: "طالباتي",
  students: "ملف الطالبة",
  attendance: "الحضور",
  points: "النقاط والمكافآت",
  grades: "الدرجات",
  reports: "التقارير",
  certificates: "الشهادات",
  analytics: "التحليلات",
  requests: "طلبات المتابعة",
  search: "البحث",
  settings: "الإعدادات",
};

/** عناوين المقاطع الفرعية العميقة (المستوى الثالث) */
const SUB_TITLES: Record<string, string> = {
  "points/board": "لوحة الشرف",
  "settings/policy": "سياسة التقييم",
  "exams/new": "اختبار جديد",
};

export interface Trail {
  section: SectionDef;
  /** رقاقة الشاشة الحالية — غير موجودة في بيوت الأقسام نفسها */
  page?: { label: string; to: string };
  /** مستوى ثالث اختياري (لوحة الشرف، سياسة التقييم…) */
  sub?: string;
}

/** يحدّد موقع المسار الحالي: القسم ← الشاشة ← الفرع */
export function locate(pathname: string): Trail | null {
  if (pathname === "/") return null; // الرئيسية لا تحتاج مساراً
  const section =
    SECTIONS.find((x) => x.prefixes.some((p) => matchesPrefix(pathname, p))) ?? SECTIONS[0];
  const segs = pathname.split("/").filter(Boolean);
  const first = segs[0];
  const label = ROUTE_TITLES[first];
  const isHub = pathname === section.to || (segs.length === 1 && ["prep", "teach", "follow", "manage", "tools"].includes(first));
  const page = label && !isHub ? { label, to: `/${first}` } : undefined;
  const sub = segs.length >= 2 ? SUB_TITLES[`${first}/${segs[1]}`] : undefined;
  return { section, page, sub };
}
