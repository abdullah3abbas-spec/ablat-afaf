/**
 * تأكيد قبل الحذف — يسمّي المحذوف صراحة (§6):
 * «هل تريدين حذف الطالبة نورة المهندي؟»
 */
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import { useStrings } from "@/hooks/useStrings";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ title, body, confirmLabel, busy, onConfirm, onClose }: ConfirmDialogProps) {
  const s = useStrings();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-card border-2 border-danger bg-danger-bg p-4">
          <AlertTriangle className="size-6 shrink-0 text-danger" aria-hidden />
          <p>{body}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="btn border-2 border-line bg-white text-ink hover:bg-cream">
            {s.common.cancel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="btn-danger">
            {busy ? s.common.loading : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
