/**
 * حوار أساس — يغلق بـ Esc وبالنقر خارجه، ويعيد التركيز عند الفتح.
 * دائماً معه زر إغلاق ظاهر (§ ux: مخرج واضح من كل حوار).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useStrings } from "@/hooks/useStrings";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** عرض أوسع لحوارات المعاينة */
  wide?: boolean;
}

export default function Modal({ title, onClose, children, wide }: ModalProps) {
  const s = useStrings();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // انقل التركيز لأول عنصر داخل الحوار، وأعده لمُطلِقه عند الإغلاق
    const opener = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-close])"
    );
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[85dvh] w-full overflow-y-auto rounded-card bg-white p-5 shadow-bar ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-maroon">{title}</h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label={s.common.cancel}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-card border border-line hover:bg-cream"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
