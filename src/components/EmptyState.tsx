/** شاشة فارغة مفيدة — بدل صفحة بيضاء: رسالة + إجراء كبير (§6، §2-د) */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <Icon className="size-12 text-ink-soft" aria-hidden />
      <p className="text-xl font-bold">{title}</p>
      {hint && <p className="text-ink-soft">{hint}</p>}
      {action}
    </div>
  );
}
