/** عارض التنبيهات — أسفل الشاشة، aria-live كي تسمعه قارئات الشاشة */
import { CheckCircle2, Info, RotateCcw, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/store/toast";
import { useStrings } from "@/hooks/useStrings";

export default function ToastViewport() {
  const s = useStrings();
  const toasts = useToast((x) => x.toasts);
  const dismiss = useToast((x) => x.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 start-1/2 z-50 flex w-[min(28rem,90vw)] -translate-x-1/2 flex-col gap-3 rtl:translate-x-1/2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "flex min-h-touch items-center gap-3 rounded-card border px-4 py-3 shadow-bar " +
            (t.kind === "danger"
              ? "border-danger bg-danger-bg text-ink"
              : t.kind === "info"
                ? "border-line bg-white text-ink"
                : "border-teal bg-teal-bg text-teal-dark")
          }
        >
          {t.kind === "danger" ? (
            <AlertTriangle className="size-6 shrink-0" aria-hidden />
          ) : t.kind === "info" ? (
            <Info className="size-6 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="size-6 shrink-0" aria-hidden />
          )}
          <p className="me-auto font-medium">{t.message}</p>
          {t.undo && (
            <button
              type="button"
              onClick={() => {
                void t.undo?.();
                dismiss(t.id);
              }}
              className="flex min-h-touch items-center gap-1 rounded-card border-2 border-teal bg-white px-3 font-bold text-teal-dark hover:bg-teal-bg"
            >
              <RotateCcw className="size-5" aria-hidden />
              {s.toast.undo}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label={s.common.cancel}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-card hover:bg-black/5"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
