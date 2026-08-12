/**
 * create-certificate — شهادات تقدير (صفحة لكل شهادة، A4 أفقي).
 * منقول من src/lib/certificates.ts. الصيغة مؤنثة · أرقام شرقية · محلي (§2-هـ).
 */
import QRCode from "qrcode";
import { loadData, leafComponents, termTotal, percentOf } from "../_shared/data.mjs";
import { parseArgs, esc, dateLong, fileDateSuffix, writeOutput, finalMessage, toEastern } from "../_shared/format.mjs";
import { printableHtml } from "../_shared/print.mjs";

const CERT_TEMPLATES = [
  { key: "excellence", nameAr: "تفوّق دراسي", defaultReason: "لتفوّقها الدراسي المتميّز في مادة العلوم", accent: "#8A1538", accentSoft: "#F3E2E7", icon: "🏆" },
  { key: "star_of_month", nameAr: "نجمة الشهر", defaultReason: "لحصولها على أعلى نقاط التحفيز هذا الشهر", accent: "#7A5716", accentSoft: "#FCF3E2", icon: "⭐" },
  { key: "most_improved", nameAr: "الأكثر تحسّناً", defaultReason: "لتحسّنها الملموس في مستواها الدراسي", accent: "#0B534C", accentSoft: "#E6F2F0", icon: "📈" },
  { key: "best_experiment", nameAr: "أفضل تجربة علمية", defaultReason: "لتميّزها في تنفيذ التجربة العملية وعرض نتائجها", accent: "#1E3A5F", accentSoft: "#E8EEF5", icon: "🔬" },
  { key: "guardian_thanks", nameAr: "شكر لولية الأمر", defaultReason: "لتعاونها المثمر ومتابعتها الدائمة لابنتها", accent: "#5E0E26", accentSoft: "#F3E2E7", icon: "🌷" },
];

const args = parseArgs();
const data = loadData(typeof args.data === "string" ? args.data : undefined);

const tArg = typeof args.template === "string" ? args.template : "excellence";
const template = CERT_TEMPLATES.find((t) => t.key === tArg) ?? CERT_TEMPLATES.find((t) => t.nameAr.includes(tArg)) ?? CERT_TEMPLATES[0];
const reason = typeof args.reason === "string" ? args.reason : template.defaultReason;
const withQr = Boolean(args.qr);
const term = args.term === "2" ? 2 : 1;

// تحديد المستفيدات
let recipients = [];
if (typeof args.student === "string") {
  const st = data.resolveStudent(args.student);
  if (!st) {
    console.error(`لم أجد طالبة باسم «${args.student}».`);
    process.exit(1);
  }
  recipients = [st.name];
} else if (typeof args.class === "string") {
  const cls = data.resolveClass(args.class);
  if (!cls) {
    console.error(`لم أجد فصلاً باسم «${args.class}».`);
    process.exit(1);
  }
  let students = data.studentsOf(cls.id);
  if (!args.all && args.top) {
    const by = args.by === "points" ? "points" : "grades";
    const leaves = leafComponents(data.gradeComponents(term));
    const ranked = students
      .map((st) => {
        const score =
          by === "points"
            ? data.cumulativePoints(st.id)
            : (() => {
                const tt = termTotal(data.gradesOf(st.id, term), leaves);
                return percentOf(tt.total, tt.countedOutOf || tt.outOf);
              })();
        return { st, score };
      })
      .sort((a, b) => b.score - a.score);
    students = ranked.slice(0, +args.top).map((r) => r.st);
  }
  recipients = students.map((st) => st.name);
} else {
  console.error("حدّدي المستفيدة: --student \"الاسم\" أو --class \"خامس ١\" مع --top N أو --all.");
  process.exit(1);
}

if (recipients.length === 0) {
  console.error("لا توجد مستفيدات مطابقات.");
  process.exit(1);
}

const now = Date.now();
const dateStr = dateLong(now, "eastern");
const ymo = `${new Date(now).getFullYear()}${String(new Date(now).getMonth() + 1).padStart(2, "0")}`;

function certSerial(i) {
  return `AA-${template.key.slice(0, 3).toUpperCase()}-${ymo}-${i + 1}`;
}

async function certPage(name, i) {
  const serial = certSerial(i);
  const qr = withQr ? await QRCode.toDataURL(serial, { margin: 0, width: 120 }) : null;
  return `<div class="cert" style="--accent:${template.accent};--accent-soft:${template.accentSoft}">
    <div class="border-outer"><div class="border-inner">
      <div class="cert-head">
        <div class="school-logo">${esc(data.schoolName().slice(0, 1) || "م")}</div>
        <div><div class="school-name">${esc(data.schoolName())}</div><div class="cert-kind">${template.icon} شهادة ${esc(template.nameAr)}</div></div>
      </div>
      <p class="grant-line">تشهد المدرسة بأن الطالبة</p>
      <p class="recipient">${esc(name)}</p>
      <p class="reason">قد حصلت على هذه الشهادة ${esc(reason)}</p>
      <p class="date-line">حُررت بتاريخ ${esc(dateStr)}</p>
      <div class="cert-footer">
        <span>توقيع المعلّمة<br/>................</span>
        ${qr ? `<img class="qr" src="${qr}" alt="${esc(serial)}" />` : `<span class="serial">${esc(serial)}</span>`}
        <span>توقيع مديرة المدرسة<br/>................</span>
      </div>
    </div></div>
  </div>`;
}

const pages = [];
for (let i = 0; i < recipients.length; i++) pages.push(await certPage(recipients[i], i));

const css = `
  @page{size:A4 landscape;margin:0}
  body{font-family:"Amiri",serif}
  .cert{width:297mm;height:210mm;padding:10mm;page-break-after:always;background:#FFFDF8}
  .border-outer{height:100%;border:1.2mm solid var(--accent);border-radius:4mm;padding:3mm}
  .border-inner{height:100%;border:0.4mm solid var(--accent);border-radius:2.5mm;padding:10mm 16mm;display:flex;flex-direction:column;text-align:center;
    background:radial-gradient(circle at 0% 0%,var(--accent-soft) 0,transparent 28%),radial-gradient(circle at 100% 100%,var(--accent-soft) 0,transparent 28%)}
  .cert-head{display:flex;align-items:center;gap:6mm;justify-content:center}
  .school-logo{width:18mm;height:18mm;border:0.6mm solid var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22pt;font-weight:700;color:var(--accent)}
  .school-name{font-size:15pt;font-weight:700}
  .cert-kind{font-size:20pt;font-weight:700;color:var(--accent)}
  .grant-line{font-size:15pt;margin-top:9mm}
  .recipient{font-size:44pt;font-weight:700;color:var(--accent);margin:3mm 0;line-height:1.4}
  .reason{font-size:16pt;max-width:200mm;margin:0 auto;line-height:1.9}
  .date-line{font-size:13pt;margin-top:5mm;color:#333}
  .cert-footer{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-family:"Tajawal",sans-serif;font-size:11.5pt;line-height:2}
  .qr{width:16mm;height:16mm}
  .serial{font-size:9pt;color:#666;direction:ltr}
`;

const html = printableHtml({ title: `شهادات — ${template.nameAr}`, css, body: pages.join(""), autoPrint: true });
const path = writeOutput(`شهادات-${template.nameAr}-${fileDateSuffix()}.html`, html);

console.log(
  finalMessage({
    done: `جهّزت ${toEastern(recipients.length)} شهادة «${template.nameAr}»${recipients.length === 1 ? ` لـ${recipients[0]}` : ""}.`,
    howTo: `الملف «${path.split("/").pop()}» في مجلد المخرجات — افتحيه واطبعي (كل شهادة في صفحة A4 أفقية).`,
    next: withQr ? "الشهادات تحمل رمز تحقق QR." : "تريدين رمز تحقق QR على كل شهادة؟ أضيفي --qr.",
  })
);
