/**
 * منصّة قياس دقة القراءة (للمطوّر — /dev/ocr، غير مربوطة بالواجهة):
 * تولّد ٥ أوراق اصطناعية بأنماط كتابة مختلفة، تشوّه منظورها عمداً،
 * ثم تمرّرها عبر الخط الكامل (كشف العلامات ← تصحيح ← قص ← قراءة)
 * وتقارن بالحقيقة الأرضية وتعرض الدقة بالأرقام.
 */
import { useEffect, useState } from "react";
import { CANON, CANON_SCALE, MARK, MARK_CENTERS, scoreBoxes } from "@/lib/sheetLayout";
import { loadCv, scanSheet } from "@/lib/scanPipeline";

interface SheetSpec {
  name: string;
  font: string;
  sizePx: number;
  jitter: number;
  rotate: number;
  weight: string;
}

const SPECS: SheetSpec[] = [
  { name: "خط ١ — Chalkboard", font: "Chalkboard, 'Comic Sans MS', cursive", sizePx: 52, jitter: 2, rotate: 3, weight: "400" },
  { name: "خط ٢ — Marker عريض", font: "'Marker Felt', 'Comic Sans MS', cursive", sizePx: 60, jitter: 3, rotate: 5, weight: "700" },
  { name: "خط ٣ — Bradley مائل", font: "'Bradley Hand', cursive", sizePx: 48, jitter: 4, rotate: 8, weight: "700" },
  { name: "خط ٤ — Noteworthy صغير", font: "Noteworthy, cursive", sizePx: 40, jitter: 3, rotate: 4, weight: "400" },
  { name: "خط ٥ — رقعة مهتزة", font: "Georgia, serif", sizePx: 54, jitter: 6, rotate: 10, weight: "400" },
];

const STUDENTS = 25;
const MAX_MARK = 25;

interface SheetResult {
  name: string;
  total: number;
  correct: number;
  emptyOk: number;
  emptyTotal: number;
  wrong: { index: number; truth: number | null; read: number | null }[];
  ms: number;
}

/** يرسم ورقة قانونية كاملة ويملأ المربعات بأرقام «بخط اليد» */
function drawSheet(spec: SheetSpec, truths: (number | null)[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CANON.w;
  c.height = CANON.h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);

  // علامات الأركان
  ctx.fillStyle = "#000";
  for (const m of MARK_CENTERS) {
    const s = MARK.size * CANON_SCALE;
    ctx.fillRect(m.x * CANON_SCALE - s / 2, m.y * CANON_SCALE - s / 2, s, s);
  }

  // المربعات والأرقام
  for (const box of scoreBoxes(STUDENTS)) {
    const x = box.x * CANON_SCALE;
    const y = box.y * CANON_SCALE;
    const w = box.w * CANON_SCALE;
    const h = box.h * CANON_SCALE;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    const truth = truths[box.index];
    if (truth === null) continue;
    ctx.save();
    const jx = (Math.random() - 0.5) * spec.jitter * 2 * CANON_SCALE * 0.4;
    const jy = (Math.random() - 0.5) * spec.jitter * 2 * CANON_SCALE * 0.4;
    ctx.translate(x + w / 2 + jx, y + h / 2 + jy);
    ctx.rotate(((Math.random() - 0.5) * spec.rotate * Math.PI) / 180);
    ctx.font = `${spec.weight} ${spec.sizePx}px ${spec.font}`;
    ctx.fillStyle = "#1a1a6e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(truth), 0, 0);
    ctx.restore();
  }
  return c;
}

/** يشوّه الورقة بمنظور عشوائي خفيف + خلفية رمادية (كأنها مصوّرة على طاولة) */
async function distort(canvas: HTMLCanvasElement): Promise<Blob> {
  const cv = await loadCv();

  const src = cv.imread(canvas);
  const pad = 120;
  const W = canvas.width + pad * 2;
  const H = canvas.height + pad * 2;
  const r = () => (Math.random() - 0.5) * 70;
  const dstPts = [
    { x: pad + r(), y: pad + r() },
    { x: W - pad + r(), y: pad + r() },
    { x: W - pad + r(), y: H - pad + r() },
    { x: pad + r(), y: H - pad + r() },
  ];
  const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, canvas.width, 0, canvas.width, canvas.height, 0, canvas.height]);
  const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPts.flatMap((p) => [p.x, p.y]));
  const M = cv.getPerspectiveTransform(srcMat, dstMat);
  const out = new cv.Mat();
  cv.warpPerspective(src, out, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(190, 190, 190, 255));

  const outCanvas = document.createElement("canvas");
  cv.imshow(outCanvas, out);
  src.delete();
  srcMat.delete();
  dstMat.delete();
  M.delete();
  out.delete();

  return new Promise((res) => outCanvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export default function DevOcrPage() {
  const [results, setResults] = useState<SheetResult[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      setRunning(true);
      const all: SheetResult[] = [];
      for (const spec of SPECS) {
        setStatus(`جارٍ: ${spec.name}…`);
        // حقيقة أرضية: 22 قيمة + 3 خانات فارغة
        const truths: (number | null)[] = Array.from({ length: STUDENTS }, (_, i) =>
          i % 9 === 4 ? null : Math.floor(Math.random() * (MAX_MARK + 1))
        );
        const sheet = drawSheet(spec, truths);
        const photo = await distort(sheet);
        const t0 = performance.now();
        const scan = await scanSheet(photo, STUDENTS);
        const ms = Math.round(performance.now() - t0);

        let correct = 0;
        let emptyOk = 0;
        const wrong: SheetResult["wrong"] = [];
        const emptyTotal = truths.filter((t) => t === null).length;
        for (let i = 0; i < STUDENTS; i++) {
          const truth = truths[i];
          const read = scan.readings.find((r) => r.index === i)?.value ?? null;
          if (truth === null) {
            if (read === null) emptyOk++;
            else wrong.push({ index: i, truth, read });
          } else if (read === truth) {
            correct++;
          } else {
            wrong.push({ index: i, truth, read });
          }
        }
        all.push({ name: spec.name, total: STUDENTS - emptyTotal, correct, emptyOk, emptyTotal, wrong, ms });
        setResults([...all]);
      }
      setStatus("انتهى القياس");
      setRunning(false);
      // للنسخ الآلي من الكونسول
      console.log("OCR_RESULTS", JSON.stringify(all));
    })();
  }, []);

  const totalDigits = results.reduce((s, r) => s + r.total, 0);
  const totalCorrect = results.reduce((s, r) => s + r.correct, 0);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="font-heading text-2xl font-bold text-maroon">قياس دقة القراءة — ٥ أوراق اصطناعية</h1>
      <p className="text-ink-soft">{running ? status : "اكتمل"}</p>
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-b-2 border-line text-start">
            <th className="p-2 text-start">الورقة</th>
            <th className="p-2">قراءة صحيحة</th>
            <th className="p-2">الدقة</th>
            <th className="p-2">الفارغ المكتشف</th>
            <th className="p-2">الزمن</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name} className="border-b border-line">
              <td className="p-2">{r.name}</td>
              <td className="p-2 text-center tabular-nums">
                {r.correct}/{r.total}
              </td>
              <td className="p-2 text-center font-bold tabular-nums">{Math.round((r.correct / r.total) * 100)}%</td>
              <td className="p-2 text-center tabular-nums">
                {r.emptyOk}/{r.emptyTotal}
              </td>
              <td className="p-2 text-center tabular-nums">{(r.ms / 1000).toFixed(1)}ث</td>
            </tr>
          ))}
        </tbody>
        {results.length > 0 && (
          <tfoot>
            <tr className="font-bold">
              <td className="p-2">الإجمالي</td>
              <td className="p-2 text-center tabular-nums">
                {totalCorrect}/{totalDigits}
              </td>
              <td className="p-2 text-center tabular-nums">
                {totalDigits ? Math.round((totalCorrect / totalDigits) * 100) : 0}%
              </td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
      {results.some((r) => r.wrong.length > 0) && (
        <details className="card">
          <summary className="cursor-pointer font-medium">تفاصيل الأخطاء</summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {results.flatMap((r) =>
              r.wrong.map((w) => (
                <li key={`${r.name}-${w.index}`}>
                  {r.name} — خانة {w.index + 1}: الحقيقة {w.truth ?? "فارغ"} · قرأ {w.read ?? "فارغ"}
                </li>
              ))
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
