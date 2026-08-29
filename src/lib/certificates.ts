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
  { key: "little_scientist", nameAr: "العالمة الصغيرة", defaultReason: "لشغفها العلمي وبحثها المتميّز في دروس العلوم", accent: "#0B534C", accentSoft: "#E6F2F0", icon: "🔭" },
  { key: "science_explorer", nameAr: "مستكشفة العلوم", defaultReason: "لاستكشافها المتميّز وأسئلتها الذكية في مادة العلوم", accent: "#7A5716", accentSoft: "#FCF3E2", icon: "🔍" },
  { key: "lab_star", nameAr: "نجمة المختبر", defaultReason: "لإتقانها العمل في المختبر والتزامها بقواعد السلامة", accent: "#1E3A5F", accentSoft: "#E8EEF5", icon: "🧪" },
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
  { key: "kid1", nameAr: "نجوم مرحة", url: "/cert-art/kid1.jpg" },
  { key: "kid2", nameAr: "شرائط ملونة", url: "/cert-art/kid2.jpg" },
  { key: "sadu", nameAr: "سدو منسوج", url: "/cert-art/sadu.jpg" },
  { key: "gold", nameAr: "إطار ذهبي", url: "/cert-art/gold.jpg" },
  { key: "stitch", nameAr: "تطريز قطري", url: "/cert-art/stitch.jpg" },
  { key: "plain", nameAr: "بسيطة", url: "" },
] as const;

/** نماذج الشهادة — تصاميم كاملة مختلفة قابلة للتبديل من المحرّر */
export interface CertDesignDef {
  key: string;
  nameAr: string;
  defaultBg: string;
}
export const CERT_DESIGNS: CertDesignDef[] = [
  { key: "designer", nameAr: "لوحة المصمم", defaultBg: "" },
  { key: "merha", nameAr: "مرحة", defaultBg: "kid1" },
  { key: "wisam", nameAr: "وسام النجمة", defaultBg: "kid2" },
  { key: "fakhera", nameAr: "فاخرة", defaultBg: "sadu" },
  { key: "sharit", nameAr: "الشريط الذهبي", defaultBg: "gold" },
];

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
  /** مفتاح النموذج من CERT_DESIGNS (الافتراضي «مرحة») */
  designKey?: string;
}

/** معايرة مواضع التركيب فوق لوحات «المصمم» — نسب مئوية، تُضبط لكل ماستر */
interface MasterCal {
  nameTop: number; nameH: number;
  dateTop: number;
  teacherTop: number; teacherRight: number; teacherW: number;
  serialTop: number;
  marksTop: number; marksH: number;
}
const MASTER_CAL_DEFAULT: MasterCal = {
  nameTop: 40, nameH: 11.5,
  dateTop: 65,
  teacherTop: 78, teacherRight: 9, teacherW: 22,
  serialTop: 91.5,
  marksTop: 5.5, marksH: 5.5,
};
const MASTER_CAL: Record<string, Partial<MasterCal>> = {
  excellence: {},
  star_of_month: { nameTop: 43.5, dateTop: 66 },
  most_improved: {},
  best_experiment: { nameTop: 41.5, dateTop: 68, teacherTop: 81 },
  guardian_thanks: {},
  little_scientist: { nameTop: 43.5, dateTop: 68, teacherTop: 79.5 },
  science_explorer: { nameTop: 43.5, dateTop: 67, teacherTop: 74.5 },
  lab_star: { nameTop: 43.5, dateTop: 67.5, teacherTop: 73.5 },
};

const escC = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);

const tinyStar = (color: string, mm = 6.5) =>
  `<svg viewBox="0 0 24 24" style="width:${mm}mm;height:${mm}mm" aria-hidden="true"><path d="M12 1 14.2 6.4 19.8 4.2 17.6 9.8 23 12 17.6 14.2 19.8 19.8 14.2 17.6 12 23 9.8 17.6 4.2 19.8 6.4 14.2 1 12 6.4 9.8 4.2 4.2 9.8 6.4Z" fill="${color}"/></svg>`;

/** الترويسة المنقسمة: الوزارة يمين · المدرسة شمال — قصّتان حقيقيتان من البانر الرسمي */
const splitHeader = () => `
  <img class="mark ministry" src="/cert-art/mark-ministry.png" alt="وزارة التربية والتعليم والتعليم العالي — دولة قطر" />
  <img class="mark school" src="/cert-art/mark-school.png" alt="مدرسة زكريت الابتدائية للبنات" />`;

const footerHtml = (c: CertData, o: CertStyleOpts) => `
  <div class="cert-footer">
    <span class="sig">توقيع المعلّمة<br/><b>${escC(c.teacherName ?? "")}</b></span>
    ${o.showSeal === false ? "<span></span>" : `<div class="seal">
      ${c.qrDataUrl ? `<img class="qr" src="${c.qrDataUrl}" alt="${escC(c.serial)}" />` : starSvg("seal-star")}
      <span class="serial">${escC(c.serial)}</span>
    </div>`}
    <span class="sig">توقيع مديرة المدرسة<br/><b>&nbsp;</b></span>
  </div>`;

const middleHtml = (c: CertData, o: CertStyleOpts) => `
  <div class="middle"><div class="panel">
    <p class="grant-line">${escC(o.grantLine ?? GRANT_LINE_DEFAULT)}</p>
    <p class="recipient"${o.nameSizePt ? ` style="font-size:${o.nameSizePt}pt"` : ""}>${escC(c.recipientName)}</p>
    <p class="reason">${escC(c.reason)}</p>
    <p class="date-line">حُررت بتاريخ ${escC(toEastern(c.dateStr))}</p>
  </div></div>`;

/** صفحة شهادة — أربعة نماذج كاملة قابلة للتبديل، فوق خلفيات مرسومة */
function certPage(c: CertData, o: CertStyleOpts = {}): string {
  const design = CERT_DESIGNS.find((d) => d.key === (o.designKey ?? "merha")) ?? CERT_DESIGNS[0];
  const bg = CERT_BACKGROUNDS.find((b) => b.key === (o.bgKey ?? design.defaultBg)) ?? CERT_BACKGROUNDS[0];
  const kindTitle = `شهادة ${escC(c.template.nameAr)}`;

  let body = "";
  if (design.key === "designer") {
    const cal = { ...MASTER_CAL_DEFAULT, ...(MASTER_CAL[c.template.key] ?? {}) };
    return `<div class="cert d-designer" style="--accent:${o.accent ?? c.template.accent}">
      <img class="bg" src="/cert-art/master-${c.template.key}.jpg" alt="شهادة ${escC(c.template.nameAr)}" />
      <span class="m-markwrap" style="top:${cal.marksTop}%;height:${cal.marksH}%;right:8%"><img class="m-mark" src="/cert-art/mark-ministry.png" alt="وزارة التربية والتعليم والتعليم العالي" /></span>
      <span class="m-markwrap" style="top:${cal.marksTop}%;height:${cal.marksH}%;left:8%"><img class="m-mark" src="/cert-art/mark-school.png" alt="مدرسة زكريت الابتدائية للبنات" /></span>
      <div class="m-name" style="top:${cal.nameTop}%;height:${cal.nameH}%${o.nameSizePt ? `;font-size:${o.nameSizePt}pt` : ""}">${escC(c.recipientName)}</div>
      <div class="m-date" style="top:${cal.dateTop}%">حُررت بتاريخ ${escC(toEastern(c.dateStr))}</div>
      <div class="m-teacher" style="top:${cal.teacherTop}%;right:${cal.teacherRight}%;width:${cal.teacherW}%">${escC(c.teacherName ?? "")}</div>
      ${o.showSeal === false ? "" : `<div class="m-serial" style="top:${cal.serialTop}%">${escC(c.serial)}</div>`}
    </div>`;
  }
  if (design.key === "fakhera") {
    body = `
      <img class="letterhead" src="/letterhead.png" alt="مدرسة زكريت الابتدائية للبنات — وزارة التربية والتعليم والتعليم العالي، دولة قطر" />
      <div class="cert-kind">${kindTitle}</div>
      <svg class="flourish" viewBox="0 0 300 14" aria-hidden="true"><path d="M8 7 H118 M182 7 H292" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M150 1 l6 6 -6 6 -6 -6 Z" fill="currentColor"/><circle cx="132" cy="7" r="2" fill="currentColor"/><circle cx="168" cy="7" r="2" fill="currentColor"/></svg>
      ${middleHtml(c, o)}${footerHtml(c, o)}`;
  } else if (design.key === "wisam") {
    body = `
      <div class="hdr">${splitHeader()}</div>
      <div class="medal">
        <span class="ribbon r1"></span><span class="ribbon r2"></span>
        <span class="medal-stars">${tinyStar("#C08A2E", 32)}<span class="inner">${tinyStar("#FBF7EC", 17)}</span></span>
      </div>
      <div class="cert-kind">${kindTitle}</div>
      ${middleHtml(c, o)}${footerHtml(c, o)}`;
  } else if (design.key === "sharit") {
    body = `
      <div class="hdr">${splitHeader()}</div>
      <div class="band"><span class="band-star">${tinyStar("#FBF7EC", 9)}</span>${kindTitle}<span class="band-star">${tinyStar("#FBF7EC", 9)}</span></div>
      ${middleHtml(c, o)}${footerHtml(c, o)}`;
  } else {
    body = `
      <div class="hdr">${splitHeader()}</div>
      <div class="kind-wrap">
        <div class="cert-kind">${kindTitle}</div>
        <div class="star-row">${tinyStar("#0F6B62")}${tinyStar("#C08A2E")}${tinyStar("#C2456B")}</div>
      </div>
      ${middleHtml(c, o)}${footerHtml(c, o)}`;
  }

  return `<div class="cert d-${design.key}${bg.url ? "" : " plain"}" style="--accent:${o.accent ?? c.template.accent}">
    ${bg.url ? `<img class="bg" src="${bg.url}" alt="" />` : ""}
    <div class="content">${body}</div>
  </div>`;
}

const CERT_CSS = `
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Amiri"; src: url("/fonts/amiri-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-400.woff2") format("woff2"); font-weight: 400; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-500.woff2") format("woff2"); font-weight: 500; }
  @font-face { font-family: "Tajawal"; src: url("/fonts/tajawal-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Ruqaa"; src: url("/fonts/ruqaa-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Baloo"; src: url("/fonts/baloo-arabic-700.woff2") format("woff2"); font-weight: 700; }
  @font-face { font-family: "Baloo"; src: url("/fonts/baloo-arabic-800.woff2") format("woff2"); font-weight: 800; }
  :root { --gold: #C08A2E; --gold-deep: #8A6A1F; --ivory: #FBF7EC; }
  body { font-family: "Tajawal", sans-serif; }
  .cert { position: relative; width: 297mm; height: 210mm; overflow: hidden;
          background: var(--ivory); page-break-after: always;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
  .cert.plain::before { content: ""; position: absolute; inset: 8mm; border-radius: 6mm;
    border: 0.8mm solid var(--gold); outline: 1.6mm solid var(--accent); outline-offset: 1.8mm; }
  .content { position: absolute; inset: 18mm 32mm 22mm; display: flex; flex-direction: column; text-align: center; }

  /* ── الترويسة المنقسمة: كل شعار بحجمه الكامل على وسادة قراءة ── */
  .hdr { display: flex; align-items: center; justify-content: space-between; gap: 6mm; }
  .mark { flex: none; height: 19mm; object-fit: contain;
          background: rgba(255,255,255,.88); border-radius: 3mm; padding: 2mm 4mm; }
  .mark.ministry { order: -1; width: 88mm; }
  .mark.school { width: 62mm; }

  /* ── العنوان: حاضر وواضح فوق أي خلفية ── */
  .kind-wrap { margin-top: 4mm; }
  .cert-kind { font-family: "Baloo", "Tajawal", sans-serif; font-weight: 800; font-size: 34pt;
               color: var(--accent); line-height: 1.35; display: inline-block;
               background: rgba(255,255,255,.72); border-radius: 5mm; padding: 0.5mm 9mm; }
  .star-row { display: flex; justify-content: center; gap: 3.5mm; margin-top: 1.5mm; }

  /* ── الوسط: لوحة قراءة ناعمة تعطي كل سطر حقه ── */
  .middle { flex: 1; display: flex; align-items: center; justify-content: center; }
  .panel { background: rgba(255,255,255,.6); border-radius: 6mm; padding: 5mm 12mm 6mm;
           max-width: 205mm; display: flex; flex-direction: column; gap: 3.5mm; }
  .grant-line { font-family: "Tajawal", sans-serif; font-weight: 500; font-size: 15pt; color: #40372E; }
  .recipient { font-family: "Baloo", "Tajawal", sans-serif; font-weight: 800; font-size: 46pt;
               color: var(--gold-deep); line-height: 1.4; }
  .reason { font-family: "Tajawal", sans-serif; font-size: 16.5pt; font-weight: 500;
            max-width: 175mm; margin: 0 auto; line-height: 1.8; color: #33291F; }
  .date-line { font-family: "Tajawal", sans-serif; font-size: 12.5pt; font-weight: 500; color: #5C4E3D; }

  /* ── التذييل ── */
  .cert-footer { display: flex; justify-content: space-between; align-items: flex-end; }
  .sig { font-family: "Tajawal", sans-serif; font-size: 12pt; line-height: 2; color: #40372E; min-width: 50mm;
    background: rgba(255,255,255,.85); border-radius: 3.5mm; padding: 1.5mm 4mm 2.5mm; }
  .sig b { display: inline-block; min-width: 44mm; border-top: 0.3mm solid var(--gold); padding-top: 1.2mm; font-weight: 700; color: #33291F; font-size: 12.5pt; }
  .seal { display: flex; flex-direction: column; align-items: center; gap: 1mm;
    background: rgba(255,255,255,.85); border-radius: 3.5mm; padding: 2mm 4mm; }
  .seal-star, .qr { width: 17mm; height: 17mm; padding: 1.8mm; border-radius: 50%;
                    background: #fff; border: 0.5mm solid var(--gold); fill: var(--accent); }
  .seal-star .star-eye { fill: #fff; }
  .serial { font-family: "Tajawal", sans-serif; font-size: 8.5pt; color: #6B5B4A; direction: ltr; }

  /* ═══ نموذج «لوحة المصمم»: الماستر المرسوم + تركيب مدموج (§ قواعد عبد الله) ═══ */
  /* اللوجو مطبوع في الورق مباشرة — دمج ضربي بلا أي رقعة */
  .d-designer .m-markwrap { position: absolute; display: flex; align-items: center; justify-content: center; }
  .d-designer .m-mark { height: 100%; object-fit: contain; mix-blend-mode: multiply; opacity: 0.92; }
  /* اسم الطالبة بحروف ذهبية متدرجة كأنها مرسومة مع حروف اللوحة */
  .d-designer .m-name { position: absolute; left: 18%; right: 18%;
    display: flex; align-items: flex-end; justify-content: center; padding-bottom: 1mm;
    font-family: "Baloo", "Cairo", sans-serif; font-weight: 800; font-size: 27pt; line-height: 1.3;
    color: #97782B; }
  .d-designer .m-date { position: absolute; left: 0; right: 0; text-align: center;
    font-family: "Tajawal", sans-serif; font-size: 10.5pt; font-weight: 500; color: #7A6A55; }
  /* توقيع المعلّمة بخط الرقعة — إمضاءة حقيقية مائلة فوق السطر */
  .d-designer .m-teacher { position: absolute; text-align: center;
    font-family: "Ruqaa", "Amiri", serif; font-weight: 700; font-size: 17pt; color: #4A3520;
    transform: rotate(-2.5deg); }
  .d-designer .m-serial { position: absolute; left: 0; right: 0; text-align: center;
    font-family: "Tajawal", sans-serif; font-size: 8pt; color: #8A7B66; direction: ltr; }

  /* ═══ نموذج «فاخرة»: البانر كاملاً في الوسط وخط أميري احتفالي ═══ */
  .d-fakhera .letterhead { width: 150mm; max-height: 19mm; object-fit: contain; display: block;
    margin: 0 auto; mix-blend-mode: multiply; }
  .d-fakhera .cert-kind { font-family: "Amiri", serif; font-weight: 700; font-size: 32pt;
    background: none; padding: 0; margin-top: 3mm; }
  .d-fakhera .flourish { width: 82mm; height: 4mm; margin: 1mm auto 0; color: var(--gold); }
  .d-fakhera .recipient { font-family: "Amiri", serif; font-size: 44pt; }
  .d-fakhera .grant-line, .d-fakhera .reason { font-family: "Amiri", serif; }
  .d-fakhera .panel { background: none; padding: 0; }

  /* ═══ نموذج «وسام النجمة»: ميدالية كبيرة بشريطين ═══ */
  .d-wisam .medal { position: relative; height: 36mm; margin-top: 2mm; display: flex;
    align-items: center; justify-content: center; }
  .d-wisam .medal-stars { position: relative; display: inline-flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 1mm 1.5mm rgba(43,33,24,.28)); }
  .d-wisam .medal-stars .inner { position: absolute; display: inline-flex; }
  .d-wisam .ribbon { position: absolute; top: 3mm; width: 7mm; height: 27mm; border-radius: 1mm; }
  .d-wisam .ribbon.r1 { background: var(--accent); transform: translateX(7mm) rotate(15deg); }
  .d-wisam .ribbon.r2 { background: #0F6B62; transform: translateX(-7mm) rotate(-15deg); }
  .d-wisam .cert-kind { font-size: 30pt; margin-top: 2mm; }
  .d-wisam .panel { padding-top: 3mm; }

  /* ═══ نموذج «الشريط الذهبي»: عنوان على شريط ملوّن عريض ═══ */
  .d-sharit .band { margin: 5mm auto 0; display: flex; align-items: center; justify-content: center; gap: 6mm;
    width: 190mm; padding: 3mm 6mm; border-radius: 5mm;
    background: linear-gradient(to left, var(--accent), color-mix(in srgb, var(--accent) 72%, #000));
    font-family: "Baloo", "Tajawal", sans-serif; font-weight: 800; font-size: 31pt; color: #FBF7EC;
    box-shadow: 0 1mm 2.5mm rgba(43,33,24,.22); }
  .d-sharit .band-star { display: inline-flex; }
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
