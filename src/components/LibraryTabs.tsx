/**
 * تبويبات قسم «مكتبتي والمنهج» الموحّد (تحويل زكريت، المرحلة ١):
 * الدروس والحزم (/library) · المنهج والتوزيع (/curriculum) · ملفاتي (/resources).
 * تظهر أعلى الصفحات الثلاث فتبدو قسماً واحداً بتسلسل ثابت:
 * المادة ← الفصل ← الوحدة ← الدرس ← نوع المورد.
 */
import { NavLink, useLocation } from "react-router-dom";
import { BookMarked, BookOpen, FolderOpen, MessageCircleQuestion } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

export default function LibraryTabs() {
  const s = useStrings();
  const { pathname } = useLocation();

  const tabs = [
    { to: "/library", label: s.library.tabs.lessons, icon: BookOpen, active: pathname.startsWith("/library") },
    { to: "/curriculum", label: s.library.tabs.curriculum, icon: BookMarked, active: pathname.startsWith("/curriculum") },
    { to: "/resources", label: s.library.tabs.files, icon: FolderOpen, active: pathname.startsWith("/resources") || pathname.startsWith("/studio") },
    { to: "/ask", label: s.ask.title, icon: MessageCircleQuestion, active: pathname.startsWith("/ask") },
  ];

  return (
    <nav aria-label={s.library.tabs.label} className="flex gap-2 rounded-card border-2 border-line bg-white p-1.5">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          aria-current={t.active ? "page" : undefined}
          className={
            "flex min-h-touch flex-1 items-center justify-center gap-2 rounded-card px-2 text-center font-bold transition-colors " +
            (t.active ? "bg-teal text-white" : "text-ink-soft hover:bg-teal-bg hover:text-teal-dark")
          }
        >
          <t.icon className="size-5 shrink-0" aria-hidden />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
