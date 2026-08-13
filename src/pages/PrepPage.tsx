/**
 * مركز «حضّري» — بيت كل ما قبل الحصة (إعادة المعمارية الخماسية):
 * الجملة الشارحة أولاً، ثم بطاقات كبيرة لكل ميزة — لا ميزة لها بيتان.
 */
import { Link } from "react-router-dom";
import {
  BookMarked, BookOpen, ClipboardList, FolderOpen, ListChecks,
  MessageCircleQuestion, NotebookPen, Wand2,
} from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

export default function PrepPage() {
  const s = useStrings();
  const c = s.prep.cards;

  const cards = [
    { to: "/library", icon: BookOpen, ...c.library },
    { to: "/slides", icon: Wand2, ...c.slides },
    { to: "/ask", icon: MessageCircleQuestion, ...c.ask },
    { to: "/exams", icon: ClipboardList, ...c.exams },
    { to: "/worksheets", icon: NotebookPen, ...c.worksheets },
    { to: "/questions", icon: ListChecks, ...c.bank },
    { to: "/curriculum", icon: BookMarked, ...c.curriculum },
    { to: "/resources", icon: FolderOpen, ...c.files },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-3xl font-bold text-maroon">{s.prep.title}</h1>
        <p className="mt-1 text-lg text-ink-soft">{s.prep.subtitle}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="card flex min-h-[88px] items-center gap-4 transition-colors hover:border-teal hover:bg-teal-bg"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-card bg-teal-bg">
              <card.icon className="size-7 text-teal-dark" aria-hidden />
            </span>
            <span>
              <span className="block text-lg font-bold">{card.label}</span>
              <span className="text-ink-soft">{card.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
