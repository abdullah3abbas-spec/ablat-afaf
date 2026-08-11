/**
 * الإعدادات: حجم الخط + شكل الأرقام + البيانات التجريبية
 * + الذكاء الاصطناعي والخصوصية (§2-هـ): قطع الاتصال، الحدود، سجل الإرسال.
 */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Plug, PlugZap, ShieldCheck } from "lucide-react";
import { clearDemo, db, reseedDemo } from "@/db";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useToast } from "@/store/toast";
import { useUi, type FontScale } from "@/store/ui";

const FONT_OPTIONS: FontScale[] = [18, 20, 22, 24];

export default function SettingsPage() {
  const s = useStrings();
  const fontScale = useUi((x) => x.fontScale);
  const setFontScale = useUi((x) => x.setFontScale);
  const numerals = useUi((x) => x.numeralsTable);
  const setNumerals = useUi((x) => x.setNumeralsTable);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClear() {
    setBusy(true);
    await clearDemo();
    setBusy(false);
    setConfirming(false);
    setMessage(s.toast.demoCleared);
  }

  async function handleReseed() {
    setBusy(true);
    await reseedDemo();
    setBusy(false);
    setMessage(s.toast.demoReseeded);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-maroon">{s.settings.title}</h1>

      {/* حجم الخط */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.settings.fontSize}</h2>
        <p className="text-ink-soft">{s.settings.fontSizeHint}</p>
        <div className="flex flex-wrap gap-3" role="group" aria-label={s.settings.fontSize}>
          {FONT_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setFontScale(size)}
              aria-pressed={fontScale === size}
              className={
                fontScale === size
                  ? "btn-primary"
                  : "btn border-2 border-line bg-white text-ink hover:border-teal"
              }
            >
              {size}
            </button>
          ))}
        </div>
      </section>

      {/* شكل الأرقام */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.settings.numerals}</h2>
        <div className="flex flex-wrap gap-3" role="group" aria-label={s.settings.numerals}>
          <button
            type="button"
            onClick={() => setNumerals("western")}
            aria-pressed={numerals === "western"}
            className={
              numerals === "western"
                ? "btn-primary"
                : "btn border-2 border-line bg-white text-ink hover:border-teal"
            }
          >
            {s.settings.numeralsWestern}
          </button>
          <button
            type="button"
            onClick={() => setNumerals("eastern")}
            aria-pressed={numerals === "eastern"}
            className={
              numerals === "eastern"
                ? "btn-primary"
                : "btn border-2 border-line bg-white text-ink hover:border-teal"
            }
          >
            {s.settings.numeralsEastern}
          </button>
        </div>
      </section>

      {/* البيانات التجريبية */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.settings.demoData}</h2>
        <p className="text-ink-soft">{s.settings.demoDataHint}</p>

        {message && (
          <p className="rounded-card bg-teal-bg px-4 py-3 font-medium text-teal-dark" role="status">
            {message}
          </p>
        )}

        {confirming ? (
          <div className="space-y-3 rounded-card border-2 border-danger bg-danger-bg p-4">
            <p className="font-bold">{s.settings.confirmClearTitle}</p>
            <p className="text-ink-soft">{s.settings.confirmClearBody}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void handleClear()} disabled={busy} className="btn-danger">
                {busy ? s.common.loading : s.settings.clearDemo}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="btn border-2 border-line bg-white text-ink"
              >
                {s.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setConfirming(true);
              }}
              className="btn border-2 border-danger bg-white text-danger hover:bg-danger-bg"
            >
              🗑 {s.settings.clearDemo}
            </button>
            <button type="button" onClick={() => void handleReseed()} disabled={busy} className="btn-secondary">
              🔄 {busy ? s.common.loading : s.settings.reseedDemo}
            </button>
          </div>
        )}
      </section>

      <AiPrivacySection />

      <p className="card bg-teal-bg text-teal-dark">{s.settings.workingOffline}</p>
    </div>
  );
}

/** قسم الذكاء الاصطناعي والخصوصية — الضمانات الثلاث (§2-هـ) */
function AiPrivacySection() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const settings = useLiveQuery(() => db.settings.get(1));
  const log = useLiveQuery(async () =>
    (await db.aiSendLog.toArray()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
  );

  const aiOn = settings?.aiConnectionEnabled ?? false;

  async function toggleAi() {
    await db.settings.update(1, { aiConnectionEnabled: !aiOn, updatedAt: Date.now() });
    show(!aiOn ? s.aiSend.connectionOn : s.aiSend.connectionOff, { kind: "info" });
  }

  async function exportLog() {
    const all = await db.aiSendLog.toArray();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `سجل-الإرسال-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    show(s.aiSend.logExported);
  }

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <ShieldCheck className="size-6 text-teal-dark" aria-hidden />
        {s.aiSend.connection}
      </h2>

      {/* الضمانة ٣: زر القطع — والمنصّة تعمل كاملة بدونه */}
      <div
        className={
          "flex flex-wrap items-center justify-between gap-3 rounded-card border-2 p-4 " +
          (aiOn ? "border-gold bg-gold-bg" : "border-teal bg-teal-bg")
        }
      >
        <p className={"font-medium " + (aiOn ? "text-gold-dark" : "text-teal-dark")}>
          {aiOn ? s.aiSend.connectionOn : s.aiSend.connectionOff}
        </p>
        <button
          type="button"
          onClick={() => void toggleAi()}
          className={aiOn ? "btn-danger" : "btn-secondary"}
        >
          {aiOn ? <Plug className="size-5" aria-hidden /> : <PlugZap className="size-5" aria-hidden />}
          {aiOn ? s.aiSend.disconnect : s.aiSend.connect}
        </button>
      </div>

      {/* ملاحظة خصوصية قارئ الدرجات (§2-ب خامساً) */}
      <p className="rounded-card bg-cream p-4 text-ink-soft">{s.grades.privacyNote}</p>

      {/* جدول الحدود */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border-2 border-danger bg-danger-bg p-4">
          <p className="font-bold text-danger">{s.aiSend.staysTitle}</p>
          <p className="mt-1 text-ink-soft">{s.aiSend.staysList}</p>
        </div>
        <div className="rounded-card border-2 border-teal bg-teal-bg p-4">
          <p className="font-bold text-teal-dark">{s.aiSend.maySendTitle}</p>
          <p className="mt-1 text-ink-soft">{s.aiSend.maySendList}</p>
        </div>
      </div>

      {/* الضمانة ٢: سجل الإرسال */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-bold">{s.aiSend.log}</h3>
          <button
            type="button"
            onClick={() => void exportLog()}
            disabled={!log || log.length === 0}
            className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal disabled:opacity-50"
          >
            <Download className="size-5" aria-hidden />
            {s.aiSend.logExport}
          </button>
        </div>
        {!log || log.length === 0 ? (
          <p className="rounded-card bg-cream p-4 text-ink-soft">{s.aiSend.logEmpty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {log.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                <span
                  className={
                    "rounded-pill px-3 py-1 text-sm font-medium " +
                    (e.status === "pending"
                      ? "bg-gold-bg text-gold-dark"
                      : e.status === "sent"
                        ? "bg-teal-bg text-teal-dark"
                        : "bg-cream text-ink-soft")
                  }
                >
                  {s.aiSend.statuses[e.status]}
                </span>
                <span className="me-auto">{e.title}</span>
                <span className="text-sm text-ink-soft">
                  {s.aiSend.kinds[e.kind]} · {fmtNum(Math.ceil(e.sizeBytes / 1024), numerals)} ك.ب ·{" "}
                  {new Date(e.createdAt).toLocaleDateString("ar", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
