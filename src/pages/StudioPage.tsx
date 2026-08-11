/**
 * استوديو العرض (§2-و): تكتب المعلّمة طلبها بالعامية،
 * يمرّ عبر شاشة «ما سيُرسل» الإلزامية، ويُسجَّل في طابور الطلبات.
 * الأصل لا يُمسّ — سجل نسخ كامل مع استرجاع بلا حذف.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { History, ListOrdered, MessageSquareText, Presentation, RotateCcw, Wand2, X } from "lucide-react";
import { db } from "@/db";
import type { StudioRequest } from "@/db/schema";
import { revertToVersion } from "@/lib/versions";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import SendPreviewDialog from "@/components/SendPreviewDialog";
import EmptyState from "@/components/EmptyState";

export default function StudioPage() {
  const s = useStrings();
  const { resourceId: idParam } = useParams();
  const resourceId = Number(idParam);
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const [instruction, setInstruction] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const resource = useLiveQuery(() => db.resources.get(resourceId), [resourceId]);
  const requests = useLiveQuery(
    async () =>
      (await db.studioRequests.where("resourceId").equals(resourceId).toArray()).sort(
        (a, b) => b.createdAt - a.createdAt
      ),
    [resourceId]
  );

  if (!resource) return <p className="card text-ink-soft">{s.common.loading}</p>;
  if (resource.kind !== "pptx" && resource.kind !== "doc") {
    return <EmptyState icon={Presentation} title={s.studio.notPresentation} />;
  }

  const slides = resource.extractedSlides ?? [];
  const versions = resource.versions ?? [];

  /** المحتوى الفعلي الذي سيُرسل: الطلب + نصوص الشرائح (لا أسماء، لا بيانات) */
  const outgoingContent = [
    `طلب المعلّمة: ${instruction.trim()}`,
    "",
    `نصوص شرائح العرض «${resource.title}» (النسخة ${resource.currentVersion ?? 1}):`,
    ...slides.map((t, i) => `[${i + 1}] ${t || "(بلا نص)"}`),
  ].join("\n");

  async function onApproved(sendLogId: number) {
    await db.studioRequests.add({
      resourceId,
      instruction: instruction.trim(),
      status: "pending",
      sendLogId,
      createdAt: Date.now(),
    });
    setReviewing(false);
    setInstruction("");
    show(s.studio.requestQueued);
  }

  async function cancelRequest(req: StudioRequest) {
    await db.studioRequests.update(req.id!, { status: "cancelled", updatedAt: Date.now() });
    if (req.sendLogId) {
      await db.aiSendLog.update(req.sendLogId, { status: "cancelled", updatedAt: Date.now() });
    }
    show(s.studio.requestCancelled, { kind: "info" });
  }

  async function revert(targetVersion: number) {
    const r = revertToVersion(versions, targetVersion, Date.now(), s.studio.revertSummary);
    if (!r) return;
    await db.resources.update(resourceId, {
      versions: r.versions,
      currentVersion: r.newVersion,
      updatedAt: Date.now(),
    });
    show(s.studio.reverted(fmtNum(targetVersion, numerals)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Wand2 className="size-7" aria-hidden />
          {s.studio.title} — {resource.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.studio.subtitle}</p>
      </div>

      {/* طلب التعديل */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <MessageSquareText className="size-6 text-teal-dark" aria-hidden />
          {s.studio.instructionTitle}
        </h2>
        <p className="text-ink-soft">{s.studio.instructionHint}</p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={s.studio.instructionPlaceholder}
          aria-label={s.studio.instructionTitle}
          rows={3}
          className="w-full rounded-card border-2 border-line p-4 focus:border-teal"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setReviewing(true)}
            disabled={!instruction.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {s.studio.review}
          </button>
        </div>
      </section>

      {/* الطلبات المعلّقة */}
      {requests && requests.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-heading text-xl font-bold">{s.studio.pendingRequests}</h2>
          <ul className="divide-y divide-line">
            {requests.map((req) => (
              <li key={req.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={
                    "rounded-pill px-3 py-1 text-sm font-medium " +
                    (req.status === "pending"
                      ? "bg-gold-bg text-gold-dark"
                      : req.status === "done"
                        ? "bg-teal-bg text-teal-dark"
                        : "bg-cream text-ink-soft")
                  }
                >
                  {s.studio.requestStatus[req.status]}
                </span>
                <p className="me-auto">{req.instruction}</p>
                {req.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void cancelRequest(req)}
                    className="btn border-2 border-line bg-white px-4 text-ink hover:border-danger hover:text-danger"
                  >
                    <X className="size-5" aria-hidden />
                    {s.studio.cancelRequest}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
        {/* الشرائح */}
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <ListOrdered className="size-6 text-teal-dark" aria-hidden />
            {s.studio.slides}
          </h2>
          {slides.length === 0 ? (
            <p className="text-ink-soft">{s.resources.previewUnavailable}</p>
          ) : (
            <ol className="max-h-[55dvh] space-y-3 overflow-y-auto">
              {slides.map((text, i) => (
                <li key={i} className="rounded-card border border-line bg-cream p-4">
                  <p className="mb-1 text-sm font-bold text-ink-soft">{s.studio.slideN(fmtNum(i + 1, numerals))}</p>
                  <p>{text || s.studio.noText}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* سجل النسخ */}
        <section className="card space-y-3 self-start">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <History className="size-6 text-teal-dark" aria-hidden />
            {s.studio.versions}
          </h2>
          <ul className="space-y-2">
            {[...versions].reverse().map((v) => (
              <li key={v.version} className="rounded-card border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {s.studio.versionN(fmtNum(v.version, numerals))}
                    {v.version === (resource.currentVersion ?? 1) && (
                      <span className="ms-2 rounded-pill bg-teal-bg px-2 text-sm text-teal-dark">
                        {s.studio.current}
                      </span>
                    )}
                  </span>
                  {v.version !== (resource.currentVersion ?? 1) && (
                    <button
                      type="button"
                      onClick={() => void revert(v.version)}
                      className="flex min-h-touch items-center gap-1 rounded-card px-2 text-teal-dark hover:bg-teal-bg"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      {s.studio.revert}
                    </button>
                  )}
                </div>
                {v.editSummary && <p className="mt-1 text-sm text-ink-soft">{v.editSummary}</p>}
                <p className="mt-1 text-sm text-ink-soft">
                  {new Date(v.createdAt).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {reviewing && (
        <SendPreviewDialog
          kind="studio-edit"
          title={`${s.studio.title}: ${resource.title}`}
          content={outgoingContent}
          onApproved={(id) => void onApproved(id)}
          onClose={() => setReviewing(false)}
        />
      )}
    </div>
  );
}
