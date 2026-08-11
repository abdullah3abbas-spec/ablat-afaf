/**
 * خط أنابيب قراءة ورقة الرصد — محلي بالكامل، لا يغادر الجهاز بايت واحد:
 *
 * ١) كشف علامات الأركان الأربع (OpenCV: عتبة + كنتورات مربعة قرب الأركان)
 * ٢) تصحيح الميلان والمنظور (getPerspectiveTransform إلى A4 قانونية)
 * ٣) اقتطاع كل مربع درجة بإحداثياته المعلومة من sheetLayout — لا قراءة أسماء
 * ٤) قراءة الرقم داخل كل مربع بـTesseract (أرقام فقط) مع درجة الثقة
 */
import type cvReadyType from "@techstark/opencv-js";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { boxPixelRect, CANON, CANON_SCALE, MARK_CENTERS, scoreBoxes } from "./sheetLayout";

type CV = typeof cvReadyType;

let cvPromise: Promise<CV> | null = null;

/**
 * تحميل OpenCV كسولاً (wasm ضخم — عند أول مسح فقط).
 * نمط التهيئة من توثيق @techstark/opencv-js نفسه:
 * قد يكون Promise، أو جاهزاً، أو ينتظر onRuntimeInitialized.
 */
export async function loadCv(): Promise<CV> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js").then(async (m) => {
      const original = (m.default ?? m) as unknown as CV & {
        then?: (cb: (v: unknown) => void) => void;
        onRuntimeInitialized?: () => void;
      };
      let cv = original;
      // Emscripten قد يصدّر thenable يُحل بالوحدة نفسها
      if (typeof cv?.then === "function") {
        const resolved = (await (cv as unknown as Promise<unknown>)) as CV | undefined;
        cv = (resolved ?? original) as typeof original;
      }
      if (!cv?.Mat) {
        // انتظر الجاهزية: خطّاف onRuntimeInitialized + استطلاع احتياطي
        await new Promise<void>((resolve) => {
          const iv = setInterval(() => {
            if (cv?.Mat) {
              clearInterval(iv);
              resolve();
            }
          }, 50);
          try {
            cv.onRuntimeInitialized = () => {
              clearInterval(iv);
              resolve();
            };
          } catch {
            // خاصية للقراءة فقط — الاستطلاع يكفي
          }
        });
      }
      return cv as CV;
    });
  }
  return cvPromise;
}

let workerPromise: Promise<Worker> | null = null;

/** عامل Tesseract من الأصول المحلية في /ocr — لا CDN إطلاقاً */
async function loadOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      gzip: true,
    }).then(async (w) => {
      await w.setParameters({
        tessedit_char_whitelist: "0123456789.,٠١٢٣٤٥٦٧٨٩٫",
        // درجة = رمز واحد (رقم أو رقمان) — وضع «كلمة واحدة» أدق هنا
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
      });
      return w;
    });
  }
  return workerPromise;
}

export interface CellReading {
  /** ترتيب الطالبة (صفرّي) حسب الورقة */
  index: number;
  /** القيمة المقروءة — null = مربع فارغ */
  value: number | null;
  /** الثقة 0..100 — null للفارغ */
  confidence: number | null;
  /** صورة المربع (dataURL) للمراجعة البصرية */
  cellImage: string;
}

export interface ScanResult {
  ok: boolean;
  /** رسالة الخطأ العربية إن فشل كشف العلامات */
  error?: "marks_not_found";
  readings: CellReading[];
  /** الصورة بعد التصحيح (dataURL مصغّرة) للعرض */
  warpedPreview?: string;
}

/** يحمّل صورة (Blob) إلى ImageData عبر canvas */
async function blobToCanvas(blob: Blob, maxDim = 2200): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

interface Pt {
  x: number;
  y: number;
}

/**
 * كشف مراكز علامات الأركان الأربع.
 * الاستراتيجية: عتبة أوتسو معكوسة → كنتورات → مرشّحات مربّعية
 * (مساحة نسبية، نسبة أبعاد، صلابة) → أقرب مرشّح لكل ركن.
 */
function detectMarks(cv: CV, src: InstanceType<CV["Mat"]>): Pt[] | null {
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  const bin = new cv.Mat();
  cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(bin, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  const imgArea = src.cols * src.rows;
  // مساحة العلامة النسبية: (8مم/210مم)² ≈ 0.00145 من الصفحة — نسمح بمدى واسع
  const minArea = imgArea * 0.0004;
  const maxArea = imgArea * 0.006;

  interface Cand extends Pt {
    area: number;
  }
  const cands: Cand[] = [];
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area < minArea || area > maxArea) {
      cnt.delete();
      continue;
    }
    const rect = cv.boundingRect(cnt);
    const ratio = rect.width / rect.height;
    const solidity = area / (rect.width * rect.height);
    if (ratio > 0.6 && ratio < 1.6 && solidity > 0.75) {
      cands.push({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, area });
    }
    cnt.delete();
  }
  contours.delete();
  hierarchy.delete();
  gray.delete();
  bin.delete();

  if (cands.length < 4) return null;

  // أقرب مرشّح لكل ركن من أركان الصورة
  const corners: Pt[] = [
    { x: src.cols, y: 0 }, // أعلى-يمين
    { x: 0, y: 0 }, // أعلى-يسار
    { x: src.cols, y: src.rows }, // أسفل-يمين
    { x: 0, y: src.rows }, // أسفل-يسار
  ];
  const chosen: Pt[] = [];
  for (const corner of corners) {
    let best: Cand | null = null;
    let bestD = Infinity;
    for (const c of cands) {
      const d = (c.x - corner.x) ** 2 + (c.y - corner.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return null;
    chosen.push({ x: best.x, y: best.y });
  }
  // لا يجوز أن يتكرر مرشّح لركنين (صورة سيئة)
  const uniq = new Set(chosen.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
  if (uniq.size < 4) return null;
  return chosen;
}

/**
 * عزل حبر الرقم من المربع:
 * ١) عتبة معكوسة (الحبر أبيض) ٢) مسح شريط الحواف (بقايا إطار المربع
 * كانت تُقرأ صفراً زائداً: 3←30) ٣) صندوق إحاطة الحبر (يستعيد الخانة
 * الأولى للرقم الملاصق للحافة: 16←6) ٤) قص + تكبير + هامش أبيض واسع.
 * يعيد null إن كان المربع فارغاً فعلاً.
 */
function extractInkCanvas(
  cv: CV,
  warped: InstanceType<CV["Mat"]>,
  rect: { x: number; y: number; w: number; h: number }
): { canvas: HTMLCanvasElement; inkArea: number } | null {
  const roi = warped.roi(new cv.Rect(rect.x, rect.y, rect.w, rect.h));
  const gray = new cv.Mat();
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
  const inv = new cv.Mat();
  cv.threshold(gray, inv, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  roi.delete();
  gray.delete();

  // مسح شريط الحواف: 6 بكسل (≈1مم) من كل جهة — يقتل بقايا الإطار
  const strip = 6;
  const black = new cv.Scalar(0);
  cv.rectangle(inv, new cv.Point(0, 0), new cv.Point(inv.cols, strip), black, -1);
  cv.rectangle(inv, new cv.Point(0, inv.rows - strip), new cv.Point(inv.cols, inv.rows), black, -1);
  cv.rectangle(inv, new cv.Point(0, 0), new cv.Point(strip, inv.rows), black, -1);
  cv.rectangle(inv, new cv.Point(inv.cols - strip, 0), new cv.Point(inv.cols, inv.rows), black, -1);

  const inkArea = cv.countNonZero(inv);
  // أقل من ~40 بكسل حبر = فارغ (ضجيج فقط)
  if (inkArea < 40) {
    inv.delete();
    return null;
  }

  // صندوق إحاطة الحبر: دمج صناديق كل الكنتورات
  // (findNonZero غير متوفرة في هذه النسخة من opencv.js)
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(inv, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  let minX = inv.cols;
  let minY = inv.rows;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const r = cv.boundingRect(cnt);
    // تجاهل النقاط الدقيقة (ضجيج)
    if (r.width * r.height >= 9) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }
    cnt.delete();
  }
  contours.delete();
  hierarchy.delete();
  if (maxX <= minX || maxY <= minY) {
    inv.delete();
    return null;
  }
  const bb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  // قص الحبر بهامش 4 بكسل داخل الحدود
  const pad = 4;
  const bx = Math.max(0, bb.x - pad);
  const by = Math.max(0, bb.y - pad);
  const bw = Math.min(inv.cols - bx, bb.width + pad * 2);
  const bh = Math.min(inv.rows - by, bb.height + pad * 2);
  const inkRoi = inv.roi(new cv.Rect(bx, by, bw, bh));

  // إعادة للأسود على أبيض + تكبير ×3 + هامش أبيض 30 بكسل
  const back = new cv.Mat();
  cv.bitwise_not(inkRoi, back);
  const big = new cv.Mat();
  cv.resize(back, big, new cv.Size(bw * 3, bh * 3), 0, 0, cv.INTER_CUBIC);
  const padded = new cv.Mat();
  cv.copyMakeBorder(big, padded, 30, 30, 30, 30, cv.BORDER_CONSTANT, new cv.Scalar(255));

  const canvas = document.createElement("canvas");
  cv.imshow(canvas, padded);
  inkRoi.delete();
  inv.delete();
  back.delete();
  big.delete();
  padded.delete();
  return { canvas, inkArea };
}

/** تطبيع النص المقروء إلى رقم: أرقام شرقية ← غربية، فواصل ← نقطة */
export function parseReadNumber(raw: string): number | null {
  const western = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫,]/g, ".")
    .replace(/[^0-9.]/g, "");
  if (!western) return null;
  const n = Number(western);
  return Number.isFinite(n) ? n : null;
}

/**
 * المسح الكامل لصورة ورقة: يعيد قراءة كل مربع مع الثقة.
 * studentCount يحدد عدد المربعات المتوقعة (من ترتيب الفصل المعروف).
 */
export async function scanSheet(imageBlob: Blob, studentCount: number): Promise<ScanResult> {
  const cv = await loadCv();
  const canvas = await blobToCanvas(imageBlob);
  const src = cv.imread(canvas);

  try {
    const marks = detectMarks(cv, src);
    if (!marks) {
      return { ok: false, error: "marks_not_found", readings: [] };
    }

    // وجهة التحويل: مراكز العلامات في الصورة القانونية (مم × مقياس)
    const dstPts = MARK_CENTERS.map((c) => ({ x: c.x * CANON_SCALE, y: c.y * CANON_SCALE }));
    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, marks.flatMap((p) => [p.x, p.y]));
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPts.flatMap((p) => [p.x, p.y]));
    const M = cv.getPerspectiveTransform(srcMat, dstMat);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(CANON.w, CANON.h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
    srcMat.delete();
    dstMat.delete();
    M.delete();

    // معاينة مصغّرة للشاشة
    const previewCanvas = document.createElement("canvas");
    const pScale = 500 / CANON.w;
    previewCanvas.width = 500;
    previewCanvas.height = Math.round(CANON.h * pScale);
    const tmp = document.createElement("canvas");
    cv.imshow(tmp, warped);
    previewCanvas.getContext("2d")!.drawImage(tmp, 0, 0, previewCanvas.width, previewCanvas.height);
    const warpedPreview = previewCanvas.toDataURL("image/jpeg", 0.7);

    const worker = await loadOcrWorker();
    const readings: CellReading[] = [];

    for (const cell of scoreBoxes(studentCount)) {
      const rect = boxPixelRect(cell, 1.2);
      const extracted = extractInkCanvas(cv, warped, rect);

      if (!extracted) {
        // فارغ فعلاً — لا نقرأه
        const empty = document.createElement("canvas");
        empty.width = 60;
        empty.height = 40;
        empty.getContext("2d")!.fillStyle = "#fff";
        empty.getContext("2d")!.fillRect(0, 0, 60, 40);
        readings.push({ index: cell.index, value: null, confidence: null, cellImage: empty.toDataURL("image/png") });
        continue;
      }

      const cellImage = extracted.canvas.toDataURL("image/png");
      // المحاولة ١: «كلمة واحدة» — وإن رفض، المحاولة ٢: سطر خام
      let res = await worker.recognize(extracted.canvas);
      let value = parseReadNumber(res.data.text.trim());
      if (value === null) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });
        res = await worker.recognize(extracted.canvas);
        value = parseReadNumber(res.data.text.trim());
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD });
      }
      const confidence = value === null ? 0 : Math.round(res.data.confidence);
      readings.push({ index: cell.index, value, confidence, cellImage });
    }

    warped.delete();
    return { ok: true, readings, warpedPreview };
  } finally {
    src.delete();
  }
}

/** تحرير عامل OCR عند مغادرة الشاشة (اختياري) */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
