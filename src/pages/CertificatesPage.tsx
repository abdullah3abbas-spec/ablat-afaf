/**
 * الشهادات: قالب من خمسة + مستفيدات (فصل كامل / فائزات الشهر تلقائياً /
 * اختيار يدوي) → طباعة جماعية صفحة لكل شهادة + PNG لكل واحدة.
 */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, Image as ImageIcon, Printer } from "lucide-react";
import { db } from "@/db";
import type { CertificateTemplate } from "@/db/schema";
import { CERT_TEMPLATES, exportCertificatePng, issueCertificates, printCertificates, type CertData } from "@/lib/certificates";
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
    printCertificates(certs);
    setBusy(false);
    show(s.certs.generated(fmtNum(certs.length, numerals)));
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
    </div>
  );
}
