/**
 * إعدادات الأمر ٠ الدنيا: حجم الخط + شكل الأرقام + البيانات التجريبية.
 * تأكيد قبل المسح باسم ما سيُمسح صراحة (§6) + رسالة «تم ✓».
 */
import { useState } from "react";
import { clearDemo, reseedDemo } from "@/db";
import { useStrings } from "@/hooks/useStrings";
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

      <p className="card bg-teal-bg text-teal-dark">{s.settings.workingOffline}</p>
    </div>
  );
}
