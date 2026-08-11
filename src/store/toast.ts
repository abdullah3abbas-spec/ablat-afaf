/**
 * متجر التنبيهات (Toast) — رسالة «تم ✓» بعد كل عملية مهمة،
 * مع زر «تراجع» يبقى ١٠ ثوانٍ للعمليات القابلة للتراجع (§6).
 */
import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  /** إن وُجدت، يظهر زر «تراجع» يستدعيها */
  undo?: () => void | Promise<void>;
  /** نوع بصري — النجاح افتراضياً */
  kind?: "success" | "info" | "danger";
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, opts?: { undo?: ToastItem["undo"]; kind?: ToastItem["kind"]; durationMs?: number }) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, opts) => {
    const id = nextId++;
    const toast: ToastItem = { id, message, undo: opts?.undo, kind: opts?.kind ?? "success" };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    // ١٠ ثوانٍ للقابل للتراجع، ٤ للرسائل العادية
    const duration = opts?.durationMs ?? (opts?.undo ? 10_000 : 4_000);
    setTimeout(() => get().dismiss(id), duration);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
