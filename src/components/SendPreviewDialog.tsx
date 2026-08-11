/**
 * شاشة «ما سيُرسل» (§2-هـ ضمانة ١) — إلزامية قبل كل إرسال:
 * تعرض المحتوى الفعلي، تفحصه بحارس الأسماء، ولا تمضي إلا بموافقة صريحة.
 */
import { useEffect, useState } from "react";
import { Ban, ShieldCheck, Send } from "lucide-react";
import { db } from "@/db";
import { guardOutgoingContent } from "@/lib/aiGuard";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import Modal from "./Modal";
import type { AiSendLogEntry } from "@/db/schema";

interface SendPreviewProps {
  kind: AiSendLogEntry["kind"];
  title: string;
  /** المحتوى الفعلي الذي سيغادر الجهاز */
  content: string;
  onApproved: (sendLogId: number) => void;
  onClose: () => void;
}

export default function SendPreviewDialog({ kind, title, content, onApproved, onClose }: SendPreviewProps) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [foundNames, setFoundNames] = useState<string[] | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void guardOutgoingContent(content).then((r) => setFoundNames(r.ok ? [] : r.foundNames));
    void db.settings.get(1).then((st) => setAiOn(st?.aiConnectionEnabled ?? false));
  }, [content]);

  const sizeBytes = new Blob([content]).size;
  const blocked = foundNames !== null && foundNames.length > 0;

  async function approve() {
    setBusy(true);
    const id = await db.aiSendLog.add({
      kind,
      title,
      contentPreview: content,
      sizeBytes,
      // لا مزوّد موصولاً بعد — يُسجَّل معلّقاً حتى مع الاتصال المفعّل
      status: "pending",
      createdAt: Date.now(),
    });
    setBusy(false);
    onApproved(id);
  }

  return (
    <Modal title={s.aiSend.title} onClose={onClose} wide>
      <div className="space-y-4">
        {foundNames === null ? (
          <p className="text-ink-soft">{s.common.loading}</p>
        ) : blocked ? (
          <div className="flex items-start gap-3 rounded-card border-2 border-danger bg-danger-bg p-4">
            <Ban className="mt-1 size-6 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="font-bold text-danger">{s.aiSend.blockedTitle}</p>
              <p className="mt-1">{s.aiSend.blockedBody(foundNames.join("، "))}</p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-card bg-teal-bg p-3 font-medium text-teal-dark">
            <ShieldCheck className="size-6" aria-hidden />
            {s.aiSend.safeLine}
          </p>
        )}

        <div>
          <p className="mb-2 text-ink-soft">{s.aiSend.explain}</p>
          <pre className="max-h-[40dvh] overflow-y-auto whitespace-pre-wrap rounded-card border border-line bg-cream p-4 font-sans">
            {content}
          </pre>
          <p className="mt-2 text-sm text-ink-soft">
            {s.aiSend.sizeLabel}: {fmtNum(Math.ceil(sizeBytes / 1024), numerals)} ك.ب
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="btn border-2 border-line bg-white text-ink">
            {s.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={blocked || busy || foundNames === null}
            className="btn-primary disabled:opacity-50"
          >
            <Send className="size-5" aria-hidden />
            {busy ? s.common.loading : aiOn ? s.aiSend.approve : s.aiSend.approveOffline}
          </button>
        </div>
      </div>
    </Modal>
  );
}
