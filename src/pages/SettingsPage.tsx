/**
 * الإعدادات: حجم الخط + شكل الأرقام + البيانات التجريبية
 * + الذكاء الاصطناعي والخصوصية (§2-هـ): قطع الاتصال، الحدود، سجل الإرسال.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Lock, Plug, PlugZap, Save, Scale, ShieldCheck, Upload } from "lucide-react";
import { clearDemo, db, reseedDemo } from "@/db";
import { downloadDataJson } from "@/lib/dataExport";
import { downloadFullBackup, restoreFromBackup, silentBackup, daysSinceBackup, latestRestorePoint, restoreFromPoint, type FullBackup } from "@/lib/backup";
import { setPin as setPinLib, removePin, isLockEnabled } from "@/lib/lock";
import { AiClientError, DEFAULT_GATEWAY_URL, fetchHealth, type GatewayHealth } from "@/lib/aiClient";
import { fmtNum } from "@/lib/numerals";
import { loadBrand } from "@/lib/brand";
import type { Settings } from "@/db/schema";
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

  async function handleExportData() {
    setBusy(true);
    try {
      const { fileName, sizeKb } = await downloadDataJson();
      setMessage(s.settings.skillsDataDone(fileName, fmtNum(sizeKb, numerals)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-maroon">{s.settings.title}</h1>

      {/* سياسة التقييم (§4) */}
      <Link
        to="/settings/policy"
        className="card flex min-h-[64px] items-center gap-3 font-bold transition-colors hover:border-teal hover:bg-teal-bg"
      >
        <Scale className="size-7 text-teal-dark" aria-hidden />
        <span className="me-auto">{s.policy.openFromSettings}</span>
        <span className="text-sm font-normal text-ink-soft">{s.policy.subtitle}</span>
      </Link>

      {/* بيانات المدرسة والمعلّمة — تظهر في ترويسات المستندات والتحضير الوزاري */}
      <SchoolIdentitySection />

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

      {/* تصدير بيانات للمهارات (§10) — جسر يقرأه Claude Code لتوليد المخرجات */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Download className="size-6 text-teal-dark" aria-hidden />
          {s.settings.skillsData}
        </h2>
        <p className="text-ink-soft">{s.settings.skillsDataHint}</p>
        <button type="button" onClick={() => void handleExportData()} disabled={busy} className="btn-secondary">
          <Download className="size-5" aria-hidden />
          {busy ? s.common.loading : s.settings.skillsDataButton}
        </button>
      </section>

      <BackupSection />

      <LockSection />

      <AiPrivacySection />

      <p className="card bg-teal-bg text-teal-dark">{s.settings.workingOffline}</p>
    </div>
  );
}

/** النسخ الاحتياطي والاستعادة (§7 · الأمر ٩) */
/** هوية المنصّة والمدرسة — «أي أبلة، نفس المميزات»: كل الترويسات والمطبوعات تتبع هذا القسم */
function SchoolIdentitySection() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const settings = useLiveQuery(() => db.settings.get(1));

  async function save(patch: Partial<Settings>) {
    await db.settings.update(1, { ...patch, updatedAt: Date.now() });
    await loadBrand();
    show(s.settings.identitySaved);
  }

  /** صورة مخصّصة → Data URL محلية مصغّرة (لا شيء يغادر الجهاز) */
  async function pickImage(field: "letterheadDataUrl" | "ministryMarkDataUrl" | "schoolMarkDataUrl", file: File | undefined) {
    if (!file) return;
    const url = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxW = field === "letterheadDataUrl" ? 1600 : 700;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    await save({ [field]: url });
  }

  const textField = (
    label: string,
    value: string,
    placeholder: string,
    onSave: (v: string) => void
  ) => (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type="text"
        key={`${label}-${value}`}
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => onSave(e.target.value.trim())}
        className="w-full rounded-card border-2 border-line p-3 focus:border-teal"
      />
    </label>
  );

  const imageField = (label: string, field: "letterheadDataUrl" | "ministryMarkDataUrl" | "schoolMarkDataUrl", current?: string) => (
    <div className="flex items-center justify-between gap-3 rounded-card border-2 border-line p-3">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {current ? (
          <button type="button" className="btn border-2 border-line bg-white text-maroon hover:bg-danger-bg" onClick={() => void save({ [field]: undefined })}>
            استعيدي الافتراضية
          </button>
        ) : (
          <span className="text-ink-soft">الافتراضية (زكريت)</span>
        )}
        <label className="btn-secondary min-h-[48px] cursor-pointer">
          اختاري صورة
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(field, e.target.files?.[0])} />
        </label>
      </span>
    </div>
  );

  return (
    <section className="card space-y-3">
      <h2 className="font-heading text-xl font-bold">{s.settings.identityTitle}</h2>
      <p className="text-ink-soft">
        المنصّة مرنة: غيّري الأسماء والمادة والترويسة من هنا فتتبعها كل الشاشات والمطبوعات — لأبلة عفاف أو أي معلّمة أخرى.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {textField(s.settings.school, settings?.schoolName ?? "", "مدرسة زكريت الابتدائية للبنات", (v) => void save({ schoolName: v }))}
        {textField(s.settings.teacher, settings?.teacherName ?? "عفاف حسين", "عفاف حسين", (v) => void save({ teacherName: v }))}
        {textField("اسم المنصّة", settings?.platformName ?? "", "منصّة أبلة عفاف", (v) => void save({ platformName: v || undefined }))}
        {textField("المادة", settings?.subjectName ?? "", "العلوم", (v) => void save({ subjectName: v || undefined }))}
      </div>
      <div className="grid gap-3">
        {imageField("ترويسة المطبوعات (صورة بعرض الصفحة)", "letterheadDataUrl", settings?.letterheadDataUrl)}
        {imageField("شعار الوزارة (يمين الشهادة)", "ministryMarkDataUrl", settings?.ministryMarkDataUrl)}
        {imageField("شعار المدرسة (يسار الشهادة)", "schoolMarkDataUrl", settings?.schoolMarkDataUrl)}
      </div>
    </section>
  );
}

function BackupSection() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [days, setDays] = useState<number | null>(null);
  const [point, setPoint] = useState<{ id: number; createdAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const pendingFile = useRef<FullBackup | null>(null);

  useEffect(() => {
    void (async () => {
      setDays(await daysSinceBackup());
      setPoint(await latestRestorePoint());
    })();
  }, [busy]);

  async function backupNow() {
    setBusy(true);
    try {
      const { fileName } = await downloadFullBackup("manual");
      show(s.backup.backupDone(fileName));
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      pendingFile.current = JSON.parse(await f.text()) as FullBackup;
      setStep(1);
    } catch {
      show(s.backup.restoreError, { kind: "danger" });
    }
  }

  async function doRestore() {
    if (!pendingFile.current) return;
    setBusy(true);
    setStep(0);
    try {
      await silentBackup("before_import");
      const r = await restoreFromBackup(pendingFile.current);
      if (r.ok) {
        show(s.backup.restored);
        setTimeout(() => location.reload(), 1200);
      } else show(r.error ?? s.backup.restoreError, { kind: "danger" });
    } finally {
      setBusy(false);
      pendingFile.current = null;
    }
  }

  async function goToPoint() {
    if (!point) return;
    setBusy(true);
    try {
      const r = await restoreFromPoint(point.id);
      if (r.ok) {
        show(s.backup.restored);
        setTimeout(() => location.reload(), 1200);
      } else show(r.error ?? s.backup.restoreError, { kind: "danger" });
    } finally {
      setBusy(false);
    }
  }

  const overdue = days != null && days >= 7;

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <ShieldCheck className="size-6 text-teal-dark" aria-hidden />
        {s.backup.title}
      </h2>
      <p className="text-ink-soft">{s.backup.hint}</p>
      <p className={"rounded-card px-3 py-2 " + (overdue ? "bg-gold-bg text-gold-dark" : "bg-cream text-ink-soft")}>
        {days == null ? s.common.loading : days === Infinity ? s.backup.lastBackupNever : s.backup.lastBackup(fmtNum(days, numerals))}
        {overdue && ` — ${s.backup.reminder}`}
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void backupNow()} disabled={busy} className="btn-primary disabled:opacity-50">
          <Save className="size-5" aria-hidden />
          {s.backup.backupNow}
        </button>
        <label className="btn cursor-pointer border-2 border-line bg-white text-ink hover:border-teal">
          <Upload className="size-5" aria-hidden />
          {s.backup.restore}
          <input type="file" accept="application/json,.json" onChange={(e) => void onPickFile(e)} className="hidden" />
        </label>
      </div>
      <p className="text-sm text-ink-soft">{s.backup.restoreHint}</p>

      {point && (
        <div className="rounded-card border border-line p-3">
          <p className="text-ink-soft">{s.backup.restorePoint(fmtNum(Math.max(0, Math.floor((Date.now() - point.createdAt) / 86400000)), numerals))}</p>
          <button type="button" onClick={() => void goToPoint()} disabled={busy} className="btn-secondary mt-2 px-4">{s.backup.restorePointNow}</button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2 rounded-card border-2 border-danger bg-danger-bg p-4">
          <p className="font-bold">{s.backup.restoreConfirm1}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn-danger">{s.common.continue}</button>
            <button type="button" onClick={() => { setStep(0); pendingFile.current = null; }} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-2 rounded-card border-2 border-danger bg-danger-bg p-4">
          <p className="font-bold">{s.backup.restoreConfirm2}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void doRestore()} disabled={busy} className="btn-danger">{s.backup.restore}</button>
            <button type="button" onClick={() => { setStep(0); pendingFile.current = null; }} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** قفل التطبيق برقم سرّي (§7 · الأمر ٩) */
function LockSection() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => setEnabled(await isLockEnabled()))();
  }, [editing]);

  async function save() {
    if (!/^\d{4,6}$/.test(pin)) return setErr(s.backup.lock.tooShort);
    if (pin !== confirm) return setErr(s.backup.lock.mismatch);
    await setPinLib(pin);
    setEditing(false);
    setPin(""); setConfirm(""); setErr("");
    show(s.backup.lock.setDone);
  }
  async function remove() {
    await removePin();
    show(s.backup.lock.removed, { kind: "info" });
    setEnabled(false);
  }

  const field = "min-h-touch w-full rounded-card border-2 border-line bg-white px-4 text-center text-xl tracking-widest focus:border-teal focus:outline-none";

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <Lock className="size-6 text-teal-dark" aria-hidden />
        {s.backup.lock.title}
      </h2>
      <p className="text-ink-soft">{s.backup.lock.hint}</p>
      <p className={"rounded-pill inline-block px-3 py-1 text-sm " + (enabled ? "bg-teal-bg text-teal-dark" : "bg-cream text-ink-soft")}>
        {enabled ? s.backup.lock.enabled : s.backup.lock.disabled}
      </p>

      {!editing ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
            {enabled ? s.backup.lock.change : s.backup.lock.set}
          </button>
          {enabled && (
            <button type="button" onClick={() => void remove()} className="btn border-2 border-danger bg-white text-danger hover:bg-danger-bg">
              {s.backup.lock.remove}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} placeholder={s.backup.lock.enter} aria-label={s.backup.lock.enter} className={field} />
          <input type="password" inputMode="numeric" value={confirm} onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} placeholder={s.backup.lock.confirm} aria-label={s.backup.lock.confirm} className={field} />
          {err && <p className="font-medium text-danger">{err}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} className="btn-primary">{s.common.save}</button>
            <button type="button" onClick={() => { setEditing(false); setPin(""); setConfirm(""); setErr(""); }} className="btn border-2 border-line bg-white text-ink">{s.common.cancel}</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** إعدادات البوابة (زكريت م٢): الرابط ورمز الربط واختبار مجاني للاتصال */
function GatewayPanel() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const settings = useLiveQuery(() => db.settings.get(1));

  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  async function saveField(patch: { aiGatewayUrl?: string; aiGatewayToken?: string }) {
    await db.settings.update(1, { ...patch, updatedAt: Date.now() });
    show(s.aiGateway.saved);
  }

  async function testConnection() {
    setTesting(true);
    setTestError(null);
    setHealth(null);
    try {
      setHealth(await fetchHealth());
    } catch (e) {
      setTestError(e instanceof AiClientError ? e.messageAr : s.errors.generic);
    } finally {
      setTesting(false);
    }
  }

  const money = (v: number) => fmtNum(Math.round(v * 100) / 100, numerals);

  return (
    <div className="space-y-3 rounded-card border-2 border-line p-4">
      <p className="font-bold">{s.aiGateway.title}</p>
      <p className="text-sm text-ink-soft">{s.aiGateway.explainZero}</p>

      <button type="button" onClick={() => void testConnection()} disabled={testing} className="btn-secondary disabled:opacity-50">
        <PlugZap className="size-5" aria-hidden />
        {testing ? s.common.loading : s.aiGateway.test}
      </button>

      {/* الحقول التقنية — لعبد الله فقط، مطوية حتى لا تربك المعلّمة */}
      <details className="rounded-card border border-line bg-cream/60 p-3">
        <summary className="cursor-pointer font-medium text-ink-soft">{s.aiGateway.advanced}</summary>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block font-medium">{s.aiGateway.url}</span>
            <input
              type="url"
              dir="ltr"
              defaultValue={settings?.aiGatewayUrl ?? DEFAULT_GATEWAY_URL}
              onBlur={(e) => void saveField({ aiGatewayUrl: e.target.value.trim() })}
              className="w-full rounded-card border-2 border-line p-3 text-start focus:border-teal"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">{s.aiGateway.token}</span>
            <input
              type="password"
              dir="ltr"
              defaultValue={settings?.aiGatewayToken ?? ""}
              onBlur={(e) => void saveField({ aiGatewayToken: e.target.value.trim() })}
              className="w-full rounded-card border-2 border-line p-3 text-start focus:border-teal"
            />
            <span className="mt-1 block text-sm text-ink-soft">{s.aiGateway.tokenHintZero}</span>
          </label>
        </div>
      </details>

      {testError && (
        <p role="alert" className="rounded-card bg-danger-bg p-3 font-medium text-danger">
          {testError}
        </p>
      )}

      {health && (
        <div className="space-y-2">
          <p className="rounded-card bg-teal-bg p-3 font-medium text-teal-dark">{s.aiGateway.ok}</p>
          {(["gemini", "openai"] as const).map((p) => {
            const u = health.providers[p];
            return (
              <div key={p} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line p-3">
                <span className="font-bold">{s.ask.providers[p]}</span>
                <span className={"rounded-pill px-3 py-1 font-medium " + (u.configured ? "bg-teal-bg text-teal-dark" : "bg-gold-bg text-gold-dark")}>
                  {u.configured ? s.aiGateway.providerReady : s.aiGateway.providerMissing}
                </span>
                <span className="w-full text-sm text-ink-soft">
                  {s.aiGateway.budgetLine(money(u.totalUsd), money(u.budgetUsd))} · {s.aiGateway.todayLine(money(u.todayUsd), money(u.dailyCapUsd))}
                </span>
              </div>
            );
          })}
        </div>
      )}
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

      {/* إعدادات البوابة: الرابط ورمز الربط والفحص المجاني (زكريت م٢) */}
      <GatewayPanel />

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
