/**
 * مولّد الشهادات — ٥ قوالب (§ الأمر ٥):
 * طباعة A4 أفقية بإطار مزخرف واسم بخط Amiri ضخم وتوقيعين وQR اختياري،
 * توليد جماعي (صفحة لكل شهادة) + تصدير PNG لكل شهادة للواتساب.
 * الأرقام شرقية في الشهادات (§5).
 */
import QRCode from "qrcode";
import { db } from "@/db";
import type { CertificateTemplate } from "@/db/schema";
import { toEastern } from "./numerals";
import { printHtml } from "./sheetPrint";

export interface CertTemplateDef {
  key: CertificateTemplate;
  nameAr: string;
  /** سطر السبب الافتراضي — قابل للتعديل قبل التوليد */
  defaultReason: string;
  /** لون التمييز */
  accent: string;
  accentSoft: string;
  icon: string;
}

export const CERT_TEMPLATES: CertTemplateDef[] = [
  { key: "excellence", nameAr: "تفوّق دراسي", defaultReason: "لتفوّقها الدراسي المتميّز في مادة العلوم", accent: "#8A1538", accentSoft: "#F3E2E7", icon: "🏆" },
  { key: "star_of_month", nameAr: "نجمة الشهر", defaultReason: "لحصولها على أعلى نقاط التحفيز هذا الشهر", accent: "#7A5716", accentSoft: "#FCF3E2", icon: "⭐" },
  { key: "most_improved", nameAr: "الأكثر تحسّناً", defaultReason: "لتحسّنها الملموس في مستواها الدراسي", accent: "#0B534C", accentSoft: "#E6F2F0", icon: "📈" },
  { key: "best_experiment", nameAr: "أفضل تجربة علمية", defaultReason: "لتميّزها في تنفيذ التجربة العملية وعرض نتائجها", accent: "#1E3A5F", accentSoft: "#E8EEF5", icon: "🔬" },
  { key: "guardian_thanks", nameAr: "شكر لولية الأمر", defaultReason: "لتعاونها المثمر ومتابعتها الدائمة لابنتها", accent: "#5E0E26", accentSoft: "#F3E2E7", icon: "🌷" },
];

export interface CertData {
  template: CertTemplateDef;
  /** اسم الطالبة أو ولية الأمر */
  recipientName: string;
  reason: string;
  schoolName: string;
  teacherName?: string;
  dateStr: string;
  serial: string;
  qrDataUrl?: string;
}

/** رقم تسلسلي بسيط للشهادة */
export function certSerial(templateKey: string, id: number, dateMs: number): string {
  const d = new Date(dateMs);
  return `AA-${templateKey.slice(0, 3).toUpperCase()}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${id}`;
}

/** صفحة شهادة واحدة (HTML داخلي) */
function certPage(c: CertData): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);
  return `<div class="cert" style="--accent:${c.template.accent};--accent-soft:${c.template.accentSoft}">
    <div class="border-outer"><div class="border-inner">
      <div class="cert-head">
        <div class="school-logo">${esc(c.schoolName.slice(0, 1) || "م")}</div>
        <div>
          <div class="school-name">${esc(c.schoolName)}</div>
          <div class="cert-kind">${c.template.icon} شهادة ${esc(c.template.nameAr)}</div>
        </div>
      </div>
      <p class="grant-line">تُهدى هذه الشهادة إلى</p>
      <p class="recipient">${esc(c.recipientName)}</p>
      <p class="reason">${esc(c.reason)}</p>
      <p class="date-line">حُررت بتاريخ ${esc(toEastern(c.dateStr))}</p>
      <div class="cert-footer">
        <span>توقيع المعلّمة<br/>${esc(c.teacherName ?? "................")}</span>
        ${c.qrDataUrl ? `<img class="qr" src="${c.qrDataUrl}" alt="${esc(c.serial)}" />` : `<span class="serial">${esc(c.serial)}</span>`}
        <span>توقيع مديرة المدرسة<br/>................</span>
      </div>
    </div></div>
  </div>`;
}

const CERT_CSS = `
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  body { font-family: "Amiri", serif; }
  .cert { width: 297mm; height: 210mm; padding: 10mm; page-break-after: always; background: #FFFDF8; }
  .border-outer { height: 100%; border: 1.2mm solid var(--accent); border-radius: 4mm; padding: 3mm; }
  .border-inner { height: 100%; border: 0.4mm solid var(--accent); border-radius: 2.5mm; padding: 10mm 16mm;
                  display: flex; flex-direction: column; text-align: center;
                  background:
                    radial-gradient(circle at 0% 0%, var(--accent-soft) 0, transparent 28%),
                    radial-gradient(circle at 100% 100%, var(--accent-soft) 0, transparent 28%); }
  .cert-head { display: flex; align-items: center; gap: 6mm; justify-content: center; }
  .school-logo { width: 18mm; height: 18mm; border: 0.6mm solid var(--accent); border-radius: 50%;
                 display: flex; align-items: center; justify-content: center; font-size: 22pt; font-weight: 700; color: var(--accent); }
  .school-name { font-size: 15pt; font-weight: 700; }
  .cert-kind { font-size: 20pt; font-weight: 700; color: var(--accent); }
  .grant-line { font-size: 15pt; margin-top: 9mm; }
  .recipient { font-family: "Amiri", serif; font-size: 44pt; font-weight: 700; color: var(--accent); margin: 3mm 0;
               line-height: 1.4; }
  .reason { font-size: 16pt; max-width: 200mm; margin: 0 auto; line-height: 1.9; }
  .date-line { font-size: 13pt; margin-top: 5mm; color: #333; }
  .cert-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
                 font-family: "Tajawal", sans-serif; font-size: 11.5pt; line-height: 2; }
  .qr { width: 16mm; height: 16mm; }
  .serial { font-size: 9pt; color: #666; direction: ltr; }
`;

/** بناء مستند شهادات كامل (صفحة لكل شهادة) */
export function certificatesHtml(certs: CertData[]): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>شهادات — ${certs[0]?.template.nameAr ?? ""}</title><style>${CERT_CSS}</style></head><body>${certs
    .map(certPage)
    .join("")}</body></html>`;
}

export interface IssueInput {
  templateKey: CertificateTemplate;
  recipients: { name: string; studentId?: number }[];
  reason: string;
  classId?: number;
  withQr: boolean;
}

/** إصدار شهادات: تسجيل + مستند طباعة واحد. يعيد بيانات الشهادات للPNG */
export async function issueCertificates(input: IssueInput): Promise<CertData[]> {
  const template = CERT_TEMPLATES.find((t) => t.key === input.templateKey)!;
  const settings = await db.settings.get(1);
  const now = Date.now();
  const dateStr = new Date(now).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" });

  const certs: CertData[] = [];
  for (const r of input.recipients) {
    const id = await db.certificates.add({
      templateKey: input.templateKey,
      scope: input.classId ? "class" : "student",
      studentId: r.studentId,
      classId: input.classId,
      reason: input.reason,
      date: now,
      createdAt: now,
    });
    const serial = certSerial(input.templateKey, id, now);
    await db.certificates.update(id, { serial });
    certs.push({
      template,
      recipientName: r.name,
      reason: input.reason,
      schoolName: settings?.schoolName ?? "",
      dateStr,
      serial,
      qrDataUrl: input.withQr ? await QRCode.toDataURL(serial, { margin: 0, width: 120 }) : undefined,
    });
  }
  return certs;
}

/** طباعة دفعة شهادات */
export function printCertificates(certs: CertData[]): void {
  printHtml(certificatesHtml(certs));
}

/**
 * تصدير شهادة PNG (للواتساب): تُركَّب الصفحة في iframe مخفي
 * ثم تُلتقط عبر html-to-image وتُنزَّل.
 */
export async function exportCertificatePng(cert: CertData): Promise<void> {
  const { toPng } = await import("html-to-image");
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "1123px"; // 297mm @96dpi
  iframe.style.height = "794px";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(certificatesHtml([cert]).replace("page-break-after: always;", ""));
  doc.close();
  await new Promise((r) => setTimeout(r, 600)); // مهلة تحميل الخطوط
  const node = doc.querySelector(".cert") as HTMLElement;
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#FFFDF8" });
  iframe.remove();
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `شهادة-${cert.template.nameAr}-${cert.recipientName}.png`;
  a.click();
}
