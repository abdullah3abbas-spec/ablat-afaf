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

/** سطر الإهداء الافتراضي — قابل للتخصيص من محرّر الشهادات */
export const GRANT_LINE_DEFAULT = "تتشرّف إدارة المدرسة ومعلّمة العلوم بإهداء هذه الشهادة إلى";

/** خلفيات الشهادة الفاخرة — لوحات مرسومة (بلا أي نص داخلها) مخزّنة محلياً */
export const CERT_BACKGROUNDS = [
  { key: "sadu", nameAr: "سدو منسوج", url: "/cert-art/sadu.jpg" },
  { key: "gold", nameAr: "إطار ذهبي", url: "/cert-art/gold.jpg" },
  { key: "stitch", nameAr: "تطريز قطري", url: "/cert-art/stitch.jpg" },
  { key: "plain", nameAr: "بسيطة", url: "" },
] as const;

/** تخصيصات المعلّمة على مستوى الدفعة — تُحفظ في الإعدادات لكل قالب */
export interface CertStyleOpts {
  grantLine?: string;
  /** يطغى على لون القالب */
  accent?: string;
  /** حجم اسم الطالبة بالنقاط (الافتراضي 46) */
  nameSizePt?: number;
  /** إظهار الختم والرقم التسلسلي (الافتراضي نعم) */
  showSeal?: boolean;
  /** مفتاح الخلفية من CERT_BACKGROUNDS (الافتراضي sadu) */
  bgKey?: string;
}

/** صفحة شهادة واحدة — خلفية فاخرة مرسومة (بلا نص) + النص العربي الحقيقي فوقها */
function certPage(c: CertData, o: CertStyleOpts = {}): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);
  const bg = CERT_BACKGROUNDS.find((b) => b.key === (o.bgKey ?? "sadu")) ?? CERT_BACKGROUNDS[0];
  return `<div class="cert${bg.url ? "" : " plain"}" style="--accent:${o.accent ?? c.template.accent}">
    ${bg.url ? `<img class="bg" src="${bg.url}" alt="" />` : ""}
    <div class="content">
      <img class="letterhead" src="/letterhead.png" alt="${esc(c.schoolName)} — وزارة التربية والتعليم والتعليم العالي، دولة قطر" />
      <div class="cert-kind">شهادة ${esc(c.template.nameAr)}</div>
      <svg class="flourish" viewBox="0 0 300 14" aria-hidden="true"><path d="M8 7 H118 M182 7 H292" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M150 1 l6 6 -6 6 -6 -6 Z" fill="currentColor"/><circle cx="132" cy="7" r="2" fill="currentColor"/><circle cx="168" cy="7" r="2" fill="currentColor"/></svg>
      <p class="grant-line">${esc(o.grantLine ?? GRANT_LINE_DEFAULT)}</p>
      <p class="recipient"${o.nameSizePt ? ` style="font-size:${o.nameSizePt}pt"` : ""}>${esc(c.recipientName)}</p>
      <p class="reason">${esc(c.reason)}</p>
      <p class="date-line">حُررت بتاريخ ${esc(toEastern(c.dateStr))}</p>
      <div class="cert-footer">
        <span class="sig">توقيع المعلّمة<br/><b>${esc(c.teacherName ?? "")}</b></span>
        ${o.showSeal === false ? "<span></span>" : `<div class="seal">
          ${c.qrDataUrl ? `<img class="qr" src="${c.qrDataUrl}" alt="${esc(c.serial)}" />` : starSvg("seal-star")}
          <span class="serial">${esc(c.serial)}</span>
        </div>`}
        <span class="sig">توقيع مديرة المدرسة<br/><b>&nbsp;</b></span>
      </div>
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
  :root { --gold: #C08A2E; --gold-deep: #8A6A1F; --ivory: #FBF7EC; }
  body { font-family: "Amiri", serif; }
  .cert { position: relative; width: 297mm; height: 210mm; overflow: hidden;
          background: var(--ivory); page-break-after: always;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
  .cert.plain::before { content: ""; position: absolute; inset: 8mm;
    border: 0.5mm solid var(--gold); outline: 1.4mm solid var(--accent); outline-offset: 1.6mm; }
  .content { position: absolute; inset: 25mm 37mm 28mm; text-align: center;
             display: flex; flex-direction: column; }
  .letterhead { width: 128mm; max-height: 16mm; object-fit: contain; display: block; margin: 0 auto;
                mix-blend-mode: multiply; }
  .cert-kind { font-family: "Amiri", serif; font-weight: 700; font-size: 33pt; color: var(--accent);
               margin-top: 3.5mm; line-height: 1.35;
               text-shadow: 0 0.3mm 0.6mm rgba(255,255,255,.9); }
  .flourish { width: 78mm; height: 4mm; margin: 1mm auto 0; color: var(--gold); }
  .grant-line { font-size: 14.5pt; margin-top: 6mm; color: #4A4238; }
  .recipient { font-family: "Amiri", serif; font-weight: 700; font-size: 46pt; color: var(--gold-deep);
               margin-top: 1mm; line-height: 1.45;
               text-shadow: 0 0.3mm 0.8mm rgba(255,255,255,.95); }
  .reason { font-size: 16pt; max-width: 172mm; margin: 3.5mm auto 0; line-height: 1.85; color: #33291F; }
  .date-line { font-family: "Tajawal", sans-serif; font-size: 11.5pt; margin-top: 3.5mm; color: #6B5B4A; }
  .cert-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { font-family: "Tajawal", sans-serif; font-size: 11.5pt; line-height: 2; color: #4A4238; min-width: 46mm; }
  .sig b { display: inline-block; min-width: 42mm; border-top: 0.3mm solid var(--gold); padding-top: 1.2mm; font-weight: 700; color: #33291F; }
  .seal { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
  .seal-star, .qr { width: 16mm; height: 16mm; padding: 1.8mm; border-radius: 50%;
                    background: #fff; border: 0.5mm solid var(--gold); fill: var(--accent); }
  .seal-star .star-eye { fill: #fff; }
  .serial { font-family: "Tajawal", sans-serif; font-size: 8pt; color: #8A7B66; direction: ltr; }
`;

/** بناء مستند شهادات كامل (صفحة لكل شهادة) */
export function certificatesHtml(certs: CertData[], opts: CertStyleOpts = {}): string {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>شهادات — ${certs[0]?.template.nameAr ?? ""}</title><style>${CERT_CSS}</style></head><body>${certs
    .map((c) => certPage(c, opts))
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
export async function exportCertificatePng(cert: CertData, opts: CertStyleOpts = {}): Promise<void> {
  const { toPng } = await import("html-to-image");
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.width = "1123px"; // 297mm @96dpi
  iframe.style.height = "794px";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(certificatesHtml([cert], opts).replace("page-break-after: always;", ""));
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
