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
import { printHtmlNow } from "./sheetPrint";

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

/** نجمة السدو — شعار المدرسة (SVG داخلي، يلوَّن بلون القالب أو الذهب) */
function starSvg(cls: string): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1.5 14.6 7l5.9-1.5L17 10.4l4.5 4-6-.4-1 5.9-2.5-5.5-5.4 2.7 2.7-5.4L3.8 9.2l6 .3L11 3.6Z" opacity=".3"/>
    <path d="M12 3.5 13.9 9l5.6.2-4.4 3.4 1.6 5.4L12 14.8 7.3 18l1.6-5.4L4.5 9.2 10.1 9Z"/>
    <circle cx="12" cy="11.6" r="1.7" class="star-eye"/>
  </svg>`;
}

/** صفحة شهادة واحدة (HTML داخلي) — تصميم زكريت الاحتفالي */
function certPage(c: CertData): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);
  return `<div class="cert" style="--accent:${c.template.accent};--accent-soft:${c.template.accentSoft}">
    <div class="frame">
      <div class="sadu top"></div>
      <div class="inner">
        ${starSvg("watermark")}
        <div class="cert-head">
          <img class="letterhead" src="/letterhead.png" alt="${esc(c.schoolName)} — وزارة التربية والتعليم والتعليم العالي، دولة قطر" />
          <div class="cert-kind">شهادة ${esc(c.template.nameAr)}</div>
          <div class="kind-rule"><span></span>${c.template.icon}<span></span></div>
        </div>
        <p class="grant-line">تتشرّف إدارة المدرسة ومعلّمة العلوم بإهداء هذه الشهادة إلى</p>
        <p class="recipient">${esc(c.recipientName)}</p>
        <svg class="flourish" viewBox="0 0 300 12" aria-hidden="true"><path d="M4 6 H120 M180 6 H296" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M150 1 l5 5 -5 5 -5 -5 Z" fill="currentColor"/><circle cx="132" cy="6" r="1.8" fill="currentColor"/><circle cx="168" cy="6" r="1.8" fill="currentColor"/></svg>
        <p class="reason">${esc(c.reason)}</p>
        <p class="date-line">حُررت بتاريخ ${esc(toEastern(c.dateStr))}</p>
        <div class="cert-footer">
          <span class="sig">توقيع المعلّمة<br/><b>${esc(c.teacherName ?? "")}</b></span>
          <div class="seal">
            ${c.qrDataUrl ? `<img class="qr" src="${c.qrDataUrl}" alt="${esc(c.serial)}" />` : starSvg("seal-star")}
            <span class="serial">${esc(c.serial)}</span>
          </div>
          <span class="sig">توقيع مديرة المدرسة<br/><b>&nbsp;</b></span>
        </div>
      </div>
      <div class="sadu bottom"></div>
    </div>
  </div>`;
}

const CERT_CSS = `
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-700.woff2") format("woff2"); font-weight: 700; }
  :root { --gold: #C08A2E; --gold-soft: #E5C98F; --ivory: #FFFDF6; }
  body { font-family: "Amiri", serif; }
  .cert { width: 297mm; height: 210mm; padding: 9mm; page-break-after: always;
          background: var(--ivory);
          background-image: radial-gradient(ellipse at 50% 42%, #fff 0%, var(--ivory) 55%, #F7F0E2 100%); }
  .frame { position: relative; height: 100%; border: 0.5mm solid var(--gold);
           outline: 1.6mm solid var(--accent); outline-offset: 1.6mm;
           display: flex; flex-direction: column; overflow: hidden; background: transparent; }
  .sadu { height: 5.5mm; flex: none;
          background: repeating-conic-gradient(from 45deg at 50% 50%, var(--gold) 0 25%, transparent 0 50%) 0 0 / 5.5mm 5.5mm,
                      linear-gradient(to left, var(--accent), color-mix(in srgb, var(--accent) 70%, #000)); }
  .inner { position: relative; flex: 1; display: flex; flex-direction: column; text-align: center;
           padding: 8mm 18mm 7mm; }
  .watermark { position: absolute; inset: 0; margin: auto; width: 120mm; height: 120mm;
               fill: var(--accent); opacity: 0.035; }
  .watermark .star-eye { fill: var(--ivory); }
  .cert-head { position: relative; }
  .letterhead { width: 170mm; max-height: 20mm; object-fit: contain; display: block; margin: 0 auto 1mm;
                mix-blend-mode: multiply; }
  .cert-kind { font-size: 30pt; font-weight: 700; color: var(--accent); margin-top: 1mm; }
  .kind-rule { display: flex; align-items: center; justify-content: center; gap: 4mm; color: var(--gold);
               font-size: 13pt; margin-top: 1mm; }
  .kind-rule span { display: inline-block; width: 42mm; height: 0.35mm; background: linear-gradient(to left, transparent, var(--gold), transparent); }
  .grant-line { font-size: 14.5pt; margin-top: 6mm; color: #3a3a3a; }
  .recipient { font-family: "Amiri", serif; font-size: 46pt; font-weight: 700; color: var(--accent);
               margin-top: 1mm; line-height: 1.5; }
  .flourish { width: 86mm; height: 4mm; margin: 0.5mm auto 0; color: var(--gold); }
  .reason { font-size: 15.5pt; max-width: 195mm; margin: 4mm auto 0; line-height: 1.9; color: #262626; }
  .date-line { font-size: 12.5pt; margin-top: 4mm; color: #4a4a4a; }
  .cert-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { font-family: "Tajawal", sans-serif; font-size: 11.5pt; line-height: 2.1; color: #333; min-width: 46mm; }
  .sig b { display: inline-block; min-width: 40mm; border-top: 0.3mm dotted #8a8a8a; padding-top: 1mm; font-weight: 700; }
  .seal { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
  .seal-star, .qr { width: 17mm; height: 17mm; padding: 2mm; border-radius: 50%;
                    border: 0.55mm solid var(--gold); outline: 0.25mm solid var(--gold); outline-offset: 1mm;
                    background: radial-gradient(circle at 35% 30%, #fff, var(--ivory)); }
  .seal-star { fill: var(--accent); }
  .seal-star .star-eye { fill: var(--ivory); }
  .serial { font-family: "Tajawal", sans-serif; font-size: 8.5pt; color: #777; direction: ltr; }
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
  // صفحة الشهادات تعرض معاينتها الخاصة (مع PNG لكل شهادة) — الطباعة هنا مباشرة
  printHtmlNow(certificatesHtml(certs));
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
