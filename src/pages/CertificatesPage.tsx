/**
 * الشهادات: قالب من خمسة + مستفيدات (فصل كامل / فائزات الشهر تلقائياً /
 * اختيار يدوي) → طباعة جماعية صفحة لكل شهادة + PNG لكل واحدة.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import SendPreviewDialog from "@/components/SendPreviewDialog";
import { AiClientError, generateImage } from "@/lib/aiClient";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, Image as ImageIcon, Printer } from "lucide-react";
import { db } from "@/db";
import type { CertificateTemplate } from "@/db/schema";
import { CERT_BACKGROUNDS, CERT_DESIGNS, CERT_TEMPLATES, GRANT_LINE_DEFAULT, certificatesHtml, exportCertificatePng, issueCertificates, type CertData, type CertStyleOpts } from "@/lib/certificates";
import { activeStudentsOf } from "@/lib/students";
import { computeMonthAwards, monthKeyOf } from "@/lib/points";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

type Mode = "class" | "winners" | "custom";

export default function CertificatesPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);

  const [templateKey, setTemplateKey] = useState<CertificateTemplate>("excellence");
  const [classId, setClassId] = useState(0);
  const [mode, setMode] = useState<Mode>("winners");
  const [reason, setReason] = useState(CERT_TEMPLATES[0].defaultReason);
  const [withQr, setWithQr] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastBatch, setLastBatch] = useState<CertData[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  useEffect(() => {
    const t = CERT_TEMPLATES.find((x) => x.key === templateKey);
    if (t) setReason(t.defaultReason);
    if (templateKey === "star_of_month" || templateKey === "most_improved") setMode("winners");
    if (templateKey === "guardian_thanks") setMode("custom");
  }, [templateKey]);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const students = useLiveQuery(
    async () => (classId ? (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber) : []),
    [classId]
  );
  const winners = useLiveQuery(
    async () => (classId ? computeMonthAwards(monthKeyOf(Date.now()), classId) : undefined),
    [classId]
  );

  async function handleGenerate() {
    if (!students) return;
    let recipients: { name: string; studentId?: number }[] = [];
    if (mode === "class") {
      recipients = students.map((st) => ({ name: st.name, studentId: st.id }));
    } else if (mode === "winners" && winners) {
      const names =
        templateKey === "most_improved" && winners.mostImproved
          ? [winners.mostImproved.student]
          : winners.stars.map((x) => x.student);
      recipients = names.map((st) => ({ name: st.name, studentId: st.id }));
    } else {
      recipients = students
        .filter((st) => selected.has(st.id!))
        .map((st) => ({
          name: templateKey === "guardian_thanks" ? st.guardianName || s.certs.guardianOf(st.name) : st.name,
          studentId: st.id,
        }));
    }
    if (recipients.length === 0) {
      show(s.certs.pickSome, { kind: "danger" });
      return;
    }
    setBusy(true);
    const certs = await issueCertificates({ templateKey, recipients, reason, classId: mode === "class" ? classId : undefined, withQr });
    setLastBatch(certs);
    setPreviewCerts(certs); // «كل حاجة تتعرض بريفيو الأول» — الطباعة من المعاينة
    setBusy(false);
    show(s.certs.generated(fmtNum(certs.length, numerals)));
  }

  const [previewCerts, setPreviewCerts] = useState<CertData[] | null>(null);

  /** وصف خلفية الشهادة المولّدة — محتوى تصميمي فقط، بلا أي اسم (§2-هـ) */
  const genBgPrompt = useMemo(() => {
    const tpl = CERT_TEMPLATES.find((x) => x.key === templateKey);
    return `خلفية شهادة تقدير مدرسية أفقية لطالبات المرحلة الابتدائية بروح «${tpl?.nameAr ?? "التقدير"}»: إطار ذهبي رفيع بزوايا مدوّرة قريب من حواف الصفحة، أغصان أوراق مائية في زاويتين متقابلتين، بضع نجيمات ذهبية، ومساحة وسطى فارغة تماماً للنصوص.`;
  }, [templateKey]);

  async function generateBgApproved() {
    setGenPreview(false);
    setGenBusy(true);
    try {
      const r = await generateImage(genBgPrompt, { style: "watercolor", aspect: "3:2" });
      setEdCustomBg(r.dataUrl);
      setEdBg("custom");
      show(s.certs.genBgDone);
    } catch (e) {
      show(e instanceof AiClientError ? e.messageAr : s.certs.genBgFailed, { kind: "danger" });
    } finally {
      setGenBusy(false);
    }
  }

  // ── محرّر الشهادة داخل المعاينة: تخصيصات حيّة تُحفظ لكل قالب ──
  const [edReason, setEdReason] = useState("");
  const [edGrant, setEdGrant] = useState(GRANT_LINE_DEFAULT);
  const [edDate, setEdDate] = useState("");
  const [edAccent, setEdAccent] = useState<string>("");
  const [edNameSize, setEdNameSize] = useState(46);
  const [edSeal, setEdSeal] = useState(true);
  const [edBg, setEdBg] = useState("kid1");
  const [edDesign, setEdDesign] = useState("designer");
  const [edCustomBg, setEdCustomBg] = useState<string | undefined>(undefined);
  const [genPreview, setGenPreview] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [freeEdit, setFreeEdit] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // تحميل تفضيلات القالب المحفوظة عند فتح المعاينة
  useEffect(() => {
    if (!previewCerts) return;
    void (async () => {
      const prefs = (await db.settings.get(1))?.certPrefs?.[templateKey];
      setEdReason(prefs?.reason ?? previewCerts[0]?.reason ?? "");
      setEdGrant(prefs?.grantLine ?? GRANT_LINE_DEFAULT);
      setEdDate(previewCerts[0]?.dateStr ?? "");
      setEdAccent(prefs?.accent ?? "");
      setEdNameSize(prefs?.nameSizePt ?? 46);
      setEdSeal(prefs?.showSeal ?? true);
      const dKey = prefs?.designKey ?? "designer";
      setEdDesign(dKey);
      setEdBg(prefs?.bgKey ?? CERT_DESIGNS.find((d) => d.key === dKey)?.defaultBg ?? "kid1");
      setEdCustomBg(prefs?.customBgDataUrl);
      setFreeEdit(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewCerts]);

  // حفظ تلقائي لتفضيلات القالب (§6: حفظ تلقائي + «تم الحفظ ✓»)
  useEffect(() => {
    if (!previewCerts) return;
    const h = setTimeout(() => {
      void (async () => {
        const settings = await db.settings.get(1);
        const certPrefs = { ...(settings?.certPrefs ?? {}) };
        certPrefs[templateKey] = { reason: edReason, grantLine: edGrant, accent: edAccent || undefined, nameSizePt: edNameSize, showSeal: edSeal, bgKey: edBg, designKey: edDesign, customBgDataUrl: edCustomBg };
        await db.settings.update(1, { certPrefs });
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 1800);
      })();
    }, 700);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edReason, edGrant, edAccent, edNameSize, edSeal, edBg, edDesign, edCustomBg]);

  const editorOpts: CertStyleOpts = useMemo(
    () => ({ grantLine: edGrant, accent: edAccent || undefined, nameSizePt: edNameSize, showSeal: edSeal, bgKey: edBg, designKey: edDesign, customBgDataUrl: edCustomBg }),
    [edGrant, edAccent, edNameSize, edSeal, edBg, edDesign, edCustomBg]
  );
  const shownCerts = useMemo(
    () => (previewCerts ?? []).map((c) => ({ ...c, reason: edReason || c.reason, dateStr: edDate || c.dateStr })),
    [previewCerts, edReason, edDate]
  );
  const previewHtml = useMemo(() => certificatesHtml(shownCerts, editorOpts), [shownCerts, editorOpts]);

  function toggleFreeEdit() {
    const doc = frameRef.current?.contentDocument;
    if (doc) doc.designMode = freeEdit ? "off" : "on";
    setFreeEdit(!freeEdit);
  }

  function printFromPreview() {
    const doc = frameRef.current?.contentDocument;
    if (doc) doc.designMode = "off";
    setFreeEdit(false);
    frameRef.current?.contentWindow?.focus();
    frameRef.current?.contentWindow?.print();
    show(s.certs.sentToPrint);
  }

  const selectCls = "min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Award className="size-7" aria-hidden />
          {s.certs.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.certs.subtitle}</p>
      </div>

      {/* القوالب الخمسة */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" role="group" aria-label={s.certs.template}>
        {CERT_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTemplateKey(t.key)}
            aria-pressed={templateKey === t.key}
            className={
              "card flex min-h-24 flex-col items-center justify-center gap-1 text-center transition-colors " +
              (templateKey === t.key ? "border-2" : "opacity-75 hover:opacity-100")
            }
            style={templateKey === t.key ? { borderColor: t.accent, background: t.accentSoft } : undefined}
          >
            <span className="text-2xl" aria-hidden>{t.icon}</span>
            <span className="font-bold" style={{ color: t.accent }}>{t.nameAr}</span>
          </button>
        ))}
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="font-medium">{s.grades.pickClass}:</span>
            <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className={selectCls}>
              <option value={0}>—</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={s.certs.recipients}>
            {(
              [
                ["winners", s.certs.winners],
                ["class", s.certs.wholeClass],
                ["custom", s.certs.custom],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={"btn px-4 " + (mode === m ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-h-touch items-center gap-2">
            <input type="checkbox" checked={withQr} onChange={(e) => setWithQr(e.target.checked)} className="size-5 accent-teal" />
            {s.certs.withQr}
          </label>
        </div>

        {mode === "winners" && winners && (
          <p className="rounded-card bg-gold-bg px-4 py-2 text-gold-dark">
            {templateKey === "most_improved"
              ? (winners.mostImproved ? `📈 ${winners.mostImproved.student.name}` : s.gradebook.emptyCell)
              : winners.stars.length > 0
                ? `⭐ ${winners.stars.map((x) => x.student.name).join("، ")}`
                : s.points.noneYet}
          </p>
        )}

        {mode === "custom" && (
          <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {students?.map((st) => (
              <li key={st.id}>
                <label className={"btn w-full cursor-pointer px-3 " + (selected.has(st.id!) ? "bg-teal text-white" : "border-2 border-line bg-white text-ink")}>
                  <input
                    type="checkbox"
                    checked={selected.has(st.id!)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(st.id!);
                      else next.delete(st.id!);
                      setSelected(next);
                    }}
                    className="sr-only"
                  />
                  <span className="truncate">{st.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <label className="block space-y-1">
          <span className="font-medium">{s.certs.reason}</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-touch w-full rounded-card border-2 border-line px-3 focus:border-teal" />
        </label>

        <button type="button" onClick={() => void handleGenerate()} disabled={busy || !classId} className="btn-primary min-h-[60px] px-8 text-lg disabled:opacity-50">
          <Printer className="size-6" aria-hidden />
          {busy ? s.common.loading : s.certs.generate}
        </button>
      </section>

      {/* PNG لكل شهادة من آخر دفعة */}
      {lastBatch.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-heading text-lg font-bold">{s.certs.pngOne}</h2>
          <ul className="flex flex-wrap gap-2">
            {lastBatch.map((c) => (
              <li key={c.serial}>
                <button
                  type="button"
                  onClick={() => void exportCertificatePng(c).then(() => show(s.certs.pngDone))}
                  className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal"
                >
                  <ImageIcon className="size-5" aria-hidden />
                  {c.recipientName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* معاينة الشهادات — بريفيو أولاً ثم الصيغ */}
      {previewCerts && (
        <div role="dialog" aria-modal="true" aria-label={s.certs.previewTitle} className="fixed inset-0 z-50 grid place-items-center bg-maroon-deep/60 p-2 backdrop-blur-[2px] md:p-4">
          <div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-card bg-white shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <h2 className="font-heading text-xl font-bold text-maroon">
                {s.certs.editorTitle}
                {savedTick && <span className="ms-3 text-sm font-medium text-ok">{s.certs.savedPrefs}</span>}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={freeEdit ? "btn bg-teal text-white" : "btn-secondary"} aria-pressed={freeEdit} onClick={toggleFreeEdit}>
                  {freeEdit ? s.certs.freeEditOn : s.certs.freeEdit}
                </button>
                <button type="button" className="btn-primary" onClick={printFromPreview}>
                  {s.certs.printPdf}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    void (async () => {
                      for (const c of shownCerts) await exportCertificatePng(c, editorOpts);
                      show(s.certs.pngDone);
                    })()
                  }
                >
                  {s.certs.pngAll}
                </button>
                <button type="button" className="btn border-2 border-line bg-white text-ink" onClick={() => setPreviewCerts(null)}>
                  {s.common.close}
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* لوحة التخصيص — كل تغيير يظهر فوراً ويُحفظ تلقائياً */}
              <aside className="w-full shrink-0 space-y-3 overflow-y-auto border-b border-line p-4 md:w-80 md:border-b-0 md:border-e">
                <div className="space-y-1">
                  <span className="font-medium">{s.certs.designLabel}</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={s.certs.designLabel}>
                    {CERT_DESIGNS.map((d) => (
                      <button key={d.key} type="button" aria-pressed={edDesign === d.key}
                        onClick={() => { setEdDesign(d.key); setEdBg(d.defaultBg); }}
                        className={"min-h-touch rounded-card border-2 px-2 font-bold " + (edDesign === d.key ? "border-gold bg-gold-bg text-gold-dark" : "border-line bg-white text-ink")}>
                        {d.nameAr}
                      </button>
                    ))}
                  </div>
                </div>
                {edDesign === "designer" && <p className="rounded-card bg-gold-bg p-3 text-sm text-gold-dark">{s.certs.designerHint}</p>}
                {edDesign !== "designer" && <div className="space-y-1">
                  <span className="font-medium">{s.certs.bgLabel}</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={s.certs.bgLabel}>
                    {CERT_BACKGROUNDS.map((b) => (
                      <button key={b.key} type="button" aria-pressed={edBg === b.key} onClick={() => setEdBg(b.key)}
                        className={"overflow-hidden rounded-card border-4 text-center " + (edBg === b.key ? "border-gold" : "border-line")}>
                        {b.url ? (
                          <img src={b.url} alt="" className="h-14 w-full object-cover" />
                        ) : (
                          <div className="flex h-14 w-full items-center justify-center bg-cream" />
                        )}
                        <span className="block bg-white py-0.5 text-xs font-bold">{b.nameAr}</span>
                      </button>
                    ))}
                    {edCustomBg && (
                      <button type="button" aria-pressed={edBg === "custom"} onClick={() => setEdBg("custom")}
                        className={"overflow-hidden rounded-card border-4 text-center " + (edBg === "custom" ? "border-gold" : "border-line")}>
                        <img src={edCustomBg} alt="" className="h-14 w-full object-cover" />
                        <span className="block bg-white py-0.5 text-xs font-bold">{s.certs.genBgChip}</span>
                      </button>
                    )}
                  </div>
                  <button type="button" disabled={genBusy} onClick={() => setGenPreview(true)}
                    className="btn-secondary mt-2 w-full disabled:opacity-60">
                    <Sparkles className="size-5" aria-hidden />
                    {genBusy ? s.certs.genBgBusy : s.certs.genBgButton}
                  </button>
                </div>}
                {edDesign !== "designer" && <label className="block space-y-1">
                  <span className="font-medium">{s.certs.reason}</span>
                  <textarea value={edReason} onChange={(e) => setEdReason(e.target.value)} rows={2}
                    className="w-full rounded-card border-2 border-line px-3 py-2 focus:border-teal" />
                </label>}
                {edDesign !== "designer" && <label className="block space-y-1">
                  <span className="font-medium">{s.certs.grantLine}</span>
                  <textarea value={edGrant} onChange={(e) => setEdGrant(e.target.value)} rows={2}
                    className="w-full rounded-card border-2 border-line px-3 py-2 focus:border-teal" />
                </label>}
                <label className="block space-y-1">
                  <span className="font-medium">{s.certs.dateLabel}</span>
                  <input type="text" value={edDate} onChange={(e) => setEdDate(e.target.value)}
                    className="min-h-touch w-full rounded-card border-2 border-line px-3 focus:border-teal" />
                </label>
                {edDesign !== "designer" && <div className="space-y-1">
                  <span className="font-medium">{s.certs.accentLabel}</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={s.certs.accentLabel}>
                    {["", "#8A1538", "#0B534C", "#1E3A5F", "#7A5716", "#5E0E26"].map((c) => (
                      <button key={c || "default"} type="button" aria-pressed={edAccent === c}
                        aria-label={c ? c : s.certs.accentDefault}
                        onClick={() => setEdAccent(c)}
                        className={"flex size-11 items-center justify-center rounded-full border-4 text-[10px] font-bold " + (edAccent === c ? "border-gold" : "border-line")}
                        style={c ? { background: c, color: "#fff" } : { background: "#fff" }}>
                        {c ? "" : s.certs.accentDefaultShort}
                      </button>
                    ))}
                  </div>
                </div>}
                <label className="block space-y-1">
                  <span className="font-medium">{s.certs.nameSize}</span>
                  <select value={edNameSize} onChange={(e) => setEdNameSize(Number(e.target.value))} className="min-h-touch w-full rounded-card border-2 border-line bg-white px-3 focus:border-teal">
                    <option value={38}>{s.certs.sizeNormal}</option>
                    <option value={46}>{s.certs.sizeBig}</option>
                    <option value={56}>{s.certs.sizeHuge}</option>
                  </select>
                </label>
                <label className="flex min-h-touch items-center gap-2">
                  <input type="checkbox" checked={edSeal} onChange={(e) => setEdSeal(e.target.checked)} className="size-5 accent-teal" />
                  <span className="font-medium">{s.certs.showSeal}</span>
                </label>
                <p className="text-sm text-ink-soft">{s.certs.editorHint}</p>
              </aside>
              <iframe ref={frameRef} title={s.certs.previewTitle} srcDoc={previewHtml} className="min-h-[50dvh] w-full flex-1 bg-[#F2ECE0] md:min-h-0" />
            </div>
          </div>
        </div>
      )}
      {genPreview && (
        <SendPreviewDialog
          kind="generation"
          title={s.certs.genBgTitle}
          content={genBgPrompt}
          onApproved={() => void generateBgApproved()}
          onClose={() => setGenPreview(false)}
        />
      )}

    </div>
  );
}
