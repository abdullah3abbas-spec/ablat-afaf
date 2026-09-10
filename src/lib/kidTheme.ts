/**
 * نظام «دفتر المستكشفة — بعثة زكريت» للمنتجات الصفية الموجهة للطالبات
 * (١٠ سنوات): ورقة العمل، كرت الخروج، بطاقات اللعبة، رصد المشاركة، الشرائح.
 *
 * المبدأ: البهجة تسكن الإطار (خيط سدو، شارات، لآلئ) والمحتوى الوزاري
 * الحرفي يسكن القلب نظيفاً بخط Tajawal. الاختبارات الرسمية والشهادات
 * والتقارير خارج هذا النظام كلياً — تبقى على شكلها الرسمي.
 * Baloo Bhaijaan 2 للعناوين القصيرة فقط (≤ ٦ كلمات) — ليس خط نصوص.
 */
import { getBrand } from "./brand";
import { storedLessonArt } from "./artStore";

const esc = (s: string) => s.replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);

/** رسمة الدرس — المولّدة ذاتياً من البوابة أولاً، ثم الأصل الثابت المرفق */
export function lessonArtUrl(lessonCode?: string): string | null {
  if (!lessonCode || !/^\d+\.\d+$/.test(lessonCode)) return null;
  return storedLessonArt(lessonCode) ?? `/lesson-art/${lessonCode.replace(".", "-")}.jpg`;
}

export const KID_FONTS_CSS = `
  @font-face { font-family: "Baloo"; src: url("/fonts/baloo-arabic-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: "Baloo"; src: url("/fonts/baloo-arabic-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: "Baloo"; src: url("/fonts/baloo-arabic-800.woff2") format("woff2"); font-weight: 800; font-display: swap; }
`;

/** نجمة ثمانية (سدو) قابلة للتلوين — تُستخدم مفرغة في ختام الأوراق */
export function star8Svg(cls = "", filled = false): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1 14.2 6.4 19.8 4.2 17.6 9.8 23 12 17.6 14.2 19.8 19.8 14.2 17.6 12 23 9.8 17.6 4.2 19.8 6.4 14.2 1 12 6.4 9.8 4.2 4.2 9.8 6.4Z"
      fill="${filled ? "#C08A2E" : "none"}" stroke="#C08A2E" stroke-width="1.4" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * توكِنات وأدوات النظام — تُحقن مع PRINT_FONTS_CSS وIDENTITY_HEADER_CSS.
 * الحبر محكوم: كل التعبئات ≤ 12٪، لا خلفية صفحة مصمتة.
 */
export const KID_CSS = `
  ${KID_FONTS_CSS}
  :root {
    --zk-annabi: #8A1538; --zk-tooti: #C2456B; --zk-teal: #0F6B62;
    --zk-mint: #BFE3DC; --zk-gold: #C08A2E; --zk-lulu: #F4C7D4;
    --zk-shamsi: #F4C95D; --zk-samawi: #4FA3D1; --zk-ink: #2B2118;
  }
  .k-baloo { font-family: "Baloo", "Cairo", sans-serif; }

  /* خيط السدو — توقيع الهوية بين الترويسة والمحتوى */
  .k-sadu { height: 2.6mm; margin: 1.5mm 0 3mm;
    background: repeating-conic-gradient(from 45deg at 50% 50%, var(--zk-gold) 0 25%, transparent 0 50%) 0 0 / 2.6mm 2.6mm,
                linear-gradient(to left, var(--zk-annabi), var(--zk-teal)); }
  .k-sadu.foot { margin: 5mm 0 2mm; }

  /* الترويسة الرسمية مصغّرة */
  .k-banner { display: block; width: 100%; max-height: 12mm; object-fit: contain; }

  /* البانر البطولي — رسمة الدرس بعرض الصفحة خلف بطاقة الرحلة */
  .k-hero { position: relative; height: 34mm; border-radius: 4mm; overflow: hidden; margin: 0 1mm; }
  .k-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 45%; }
  .k-hero::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(to top, #fff 4%, rgba(255,255,255,.55) 34%, transparent 62%); }

  /* «بطاقة الرحلة» — عنوان الدرس كتذكرة سفر مع عدسة البوصلة */
  .k-trip { display: flex; align-items: center; gap: 5mm; padding: 3.5mm 5mm;
    border: 0.7mm dashed var(--zk-gold); border-radius: 4mm; transform: rotate(-0.6deg);
    margin: 1mm 1mm 5mm; background: #fff; }
  .k-hero + .k-trip { margin-top: -11mm; margin-inline: 8mm; position: relative;
    box-shadow: 0 1mm 3mm rgba(43,33,24,.12); }
  .k-trip .t { flex: 1; }
  .k-trip h1 { font-family: "Baloo", "Cairo", sans-serif; font-weight: 800; font-size: 19pt;
    color: var(--zk-annabi); line-height: 1.5; }
  .k-trip .m { font-size: 10pt; color: #6B5E58; margin-top: 0.5mm; }
  .k-lens { width: 30mm; height: 30mm; border-radius: 50%; object-fit: cover; flex: none;
    border: 1.1mm solid var(--zk-teal); outline: 0.5mm dashed var(--zk-gold); outline-offset: 1.4mm; }

  /* حقول الطالبة — كبسولات */
  .k-fields { display: flex; gap: 4mm; justify-content: center; font-size: 10.5pt; margin: 0 0 4mm; }
  .k-fields span { border: 0.4mm dashed #B9AFA4; border-radius: 6mm; padding: 1mm 4mm; min-width: 34mm; }

  /* بطاقة محطة السؤال + شارة سداسية + لؤلؤة الهامش */
  .k-station { position: relative; border: 0.6mm solid var(--zk-teal); border-radius: 3.5mm;
    padding: 4mm 5mm 3.5mm 12mm; margin: 7mm 0 0; break-inside: avoid; page-break-inside: avoid; }
  .k-station .k-hex { position: absolute; top: -4mm; inset-inline-start: 4mm; width: 8.6mm; height: 8.6mm;
    clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
    background: var(--zk-annabi); color: #fff; font-family: "Baloo", sans-serif; font-weight: 800;
    font-size: 13pt; display: flex; align-items: center; justify-content: center; }
  .k-station.treasure { border-color: var(--zk-gold); border-width: 0.8mm; }
  
  .k-treasure-tag { position: absolute; top: -4mm; inset-inline-end: 5mm; background: #fff;
    color: var(--zk-gold); font-family: "Baloo", sans-serif; font-weight: 800; font-size: 10pt;
    padding: 0 3mm; }
  .k-pearl { position: absolute; inset-inline-end: -8.5mm; top: 50%; margin-top: -3.5mm;
    width: 7mm; height: 7mm; border-radius: 50%; border: 0.5mm dotted var(--zk-gold); }
  .k-marks { font-family: "Baloo", sans-serif; font-weight: 700; color: var(--zk-annabi); font-size: 10.5pt; white-space: nowrap; }
  .k-ansline { border-bottom: 0.5mm dotted #9A8F88; height: 10.5mm; }
  .k-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 5mm; padding-inline-start: 4mm; margin-top: 1.5mm; }
  .k-opts span { border: 0.4mm solid var(--zk-mint); border-radius: 6mm; padding: 0.5mm 3.5mm; }
  .k-tf { display: flex; gap: 8mm; margin-top: 2mm; padding-inline-start: 4mm; align-items: center; }
  .k-tf span { display: flex; align-items: center; gap: 2mm; }
  .k-tf i { width: 5.5mm; height: 5.5mm; border-radius: 50%; border: 0.5mm solid var(--zk-teal); display: inline-block; }
  .k-chain { display: flex; align-items: center; gap: 2.5mm; margin-top: 2.5mm; flex-wrap: wrap; }
  .k-chain b { width: 30mm; height: 13mm; border: 0.5mm dashed var(--zk-gold); border-radius: 2.5mm; display: inline-block; }
  .k-chain span { color: var(--zk-teal); font-weight: 700; font-size: 14pt; }

  /* ختام الورقة — نجمة التلوين */
  .k-finish { text-align: center; margin-top: 6mm; color: #6B5E58; font-size: 10.5pt; }
  .k-finish svg { width: 11mm; height: 11mm; vertical-align: middle; margin-inline-start: 2mm; }

  /* تذاكر الخروج */
  .k-tickets { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .k-ticket { position: relative; border: 0.6mm solid var(--zk-teal); border-radius: 3mm;
    display: flex; overflow: hidden; break-inside: avoid; page-break-inside: avoid; min-height: 52mm; }
  .k-ticket::before, .k-ticket::after { content: ""; position: absolute; width: 6mm; height: 6mm;
    background: #fff; border: 0.6mm solid var(--zk-teal); border-radius: 50%; top: 50%; margin-top: -3mm; }
  .k-ticket::before { inset-inline-start: -3.6mm; }
  .k-ticket::after { inset-inline-end: -3.6mm; }
  .k-stub { width: 34mm; flex: none; background: color-mix(in srgb, var(--zk-lulu) 34%, #fff);
    border-inline-end: 0.5mm dashed var(--zk-teal); padding: 3mm 2.5mm; text-align: center; font-size: 8.5pt; color: #5A4B50; }
  .k-nameline { border-bottom: 0.4mm dotted #9A8F88; height: 6mm; margin-top: 1mm; }
  .k-stub img { width: 15mm; height: 15mm; border-radius: 50%; object-fit: cover; border: 0.6mm solid var(--zk-gold); margin-bottom: 1.5mm; }
  .k-tbody { flex: 1; padding: 2.5mm 4mm 3mm; }
  .k-thead { font-family: "Baloo", sans-serif; font-weight: 800; color: var(--zk-annabi); font-size: 11.5pt; }
  .k-tq { font-size: 10.5pt; line-height: 1.7; margin-top: 1mm; }
  .k-tans { border-bottom: 0.4mm dotted #9A8F88; height: 9.5mm; }
  .k-scale { display: flex; gap: 3mm; margin-top: 2mm; font-size: 8pt; color: #5A4B50; }
  .k-scale span { display: flex; align-items: center; gap: 1.2mm; }
  .k-dot { width: 4.5mm; height: 4.5mm; border-radius: 50%; border: 0.45mm solid var(--zk-teal); display: inline-block; }
  .k-stamp { margin-top: 1.5mm; font-size: 8pt; color: var(--zk-gold); display: flex; align-items: center; gap: 1.5mm; }
  .k-stamp i { width: 7mm; height: 7mm; border: 0.5mm dotted var(--zk-gold); border-radius: 50%; display: inline-block; }

  /* بطاقات الكنز (اللعبة) — مقاس لعب ٦٣×٨٨مم */
  .k-deck { display: grid; grid-template-columns: repeat(3, 63mm); gap: 4mm; justify-content: center; }
  .k-card { width: 63mm; height: 88mm; border-radius: 4mm; border: 1mm solid var(--team, var(--zk-teal));
    position: relative; padding: 3mm; display: flex; flex-direction: column; break-inside: avoid; page-break-inside: avoid; }
  .k-card::before { content: ""; position: absolute; inset: 2mm; border: 0.3mm dashed var(--zk-gold);
    border-radius: 2.5mm; pointer-events: none; }
  .k-team { display: flex; align-items: center; gap: 2mm; font-family: "Baloo", sans-serif; font-weight: 700;
    font-size: 9.5pt; color: var(--team, var(--zk-teal));
    background: color-mix(in srgb, var(--team, var(--zk-teal)) 12%, #fff);
    border-radius: 2mm; padding: 1mm 2.5mm; position: relative; z-index: 1; }
  .k-team i { width: 3.5mm; height: 3.5mm; border-radius: 50%; background: var(--team, var(--zk-teal)); display: inline-block; }
  .k-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.1; }
  .k-watermark svg { width: 26mm; height: 26mm; }
  .k-qtext { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 12pt; font-weight: 700; line-height: 1.7; padding: 2mm 1mm; position: relative; z-index: 1; }
  .k-cfoot { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
  .k-cnum { font-family: "Baloo", sans-serif; font-weight: 800; font-size: 13pt; color: var(--team, var(--zk-teal)); }
  .k-cut { color: #3A342A; font-size: 11pt; font-weight: 500; text-align: center; margin: 2.5mm 0; }

  /* رصد المشاركة — جدول نظيف بزيبرا منت */
  .k-ptable { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .k-ptable th { background: var(--zk-teal); color: #fff; font-family: "Cairo", sans-serif; font-size: 10.5pt; padding: 2mm; border: 0.3mm solid var(--zk-teal); }
  .k-ptable td { border: 0.3mm solid #C9BFB4; padding: 1.6mm 2.5mm; font-size: 11pt; height: 11.5mm; }
  .k-ptable tr:nth-child(even) td { background: color-mix(in srgb, var(--zk-mint) 22%, #fff); }
  .k-roll { display: inline-flex; width: 6.5mm; height: 6.5mm; border-radius: 50%; background: var(--zk-annabi);
    color: #fff; align-items: center; justify-content: center; font-size: 9pt; font-weight: 700; }
  .k-weekstar { border: 0.6mm solid var(--zk-gold); border-radius: 3mm; padding: 3mm 5mm; margin-top: 4mm;
    display: flex; align-items: center; gap: 3mm; font-size: 11pt; }
  .k-notes { border: 0.5mm dashed var(--zk-gold); border-radius: 3mm; min-height: 28mm; margin-top: 4mm;
    padding: 2.5mm 4mm; color: #6B5E58; font-size: 10.5pt; }
  .k-bingo { border-collapse: collapse; display: inline-table; margin: 2mm; break-inside: avoid; }
  .k-bingo td { width: 27mm; height: 21mm; border: 0.5mm solid var(--zk-teal); }
  .k-bingo caption { font-family: "Baloo", sans-serif; font-weight: 700; color: var(--zk-teal); font-size: 10.5pt; padding-bottom: 1mm; }
`;

export interface KidHeadOpts {
  docTitle: string;
  lessonTitle: string;
  unitTitle?: string;
  className?: string;
  lessonCode?: string;
  /** حقول اسم الطالبة/التاريخ */
  studentFields?: boolean;
}

/** ترويسة المنتج الصفي: بانر مصغّر ← خيط سدو ← بطاقة الرحلة (+ عدسة الرسمة) */
export function kidHeader(o: KidHeadOpts): string {
  const art = lessonArtUrl(o.lessonCode);
  const meta = [`${getBrand().subjectName} · المستوى الخامس`, o.unitTitle, o.className ? `الفصل: ${o.className}` : ""]
    .filter(Boolean).join(" · ");
  return `<img class="k-banner" src="${getBrand().letterheadUrl}" alt="${esc(getBrand().schoolName)} — وزارة التربية والتعليم والتعليم العالي"/>
  <div class="k-sadu"></div>
  ${art ? `<div class="k-hero"><img src="${art}" alt="" onerror="this.parentElement.remove()"/></div>` : ""}
  <div class="k-trip">
    <div class="t"><h1>${esc(o.docTitle)}: ${esc(o.lessonTitle)}</h1><div class="m">${esc(meta)}</div></div>
  </div>
  ${o.studentFields ? `<div class="k-fields"><span>اسمي: </span><span>الرقم: </span><span>التاريخ: </span></div>` : ""}`;
}

/** ختام الورقة: خيط سدو + نجمة التلوين */
export function kidFinish(line = "أنهيتِ؟ لوّني نجمتكِ!"): string {
  return `<div class="k-sadu foot"></div><div class="k-finish">${esc(line)} ${star8Svg()}</div>`;
}
