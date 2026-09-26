/**
 * الملاحظات الصوتية بعد الحصة (§2-ز — المسار الصوتي الأساسي):
 * المعلّمة تتكلم بالعامية دقيقة بعد الحصة، والاستخراج إلى
 * (نجوم لطالبات · طالبات يحتجن متابعة · مهام لي) يجري هنا
 * **محلياً بالكامل بقواعد نصية** — لا يُرسل التفريغ لأي خدمة،
 * لأن فيه أسماء طالبات (القاعدة الذهبية §2-هـ).
 * التفريغ نفسه عبر خدمة المتصفح — والشاشة تنبّه، والكتابة بديل دائم.
 */

export interface RosterStudent {
  id: number;
  name: string;
}

export interface ExtractedItem {
  kind: "star" | "follow" | "task";
  /** الجملة الأصلية — تُعرض للمراجعة وتُحفظ سبباً/نصاً */
  text: string;
  /** الطالبة المطابقة من كشف الفصل — قد تغيب فتختارها المعلّمة */
  studentId?: number;
  studentName?: string;
  /** عدد النجوم (للنوع star) */
  stars?: number;
}

/** توحيد عربي خفيف للمطابقة: همزات، تاء مربوطة، ياء مقصورة، ال التعريف */
function norm(s: string): string {
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .trim();
}

/** هل تحتوي الجملة اسم الطالبة؟ — مطابقة أول اسمين مع التوحيد وتجريد السوابق («لمريم» = مريم) */
export function matchStudent(sentence: string, roster: RosterStudent[]): RosterStudent | undefined {
  const words = sentence.split(/\s+/).flatMap((w) => {
    const n = norm(w);
    // سوابق العربية الملتصقة: و ف ب ل ك لل — نجرب الكلمة كما هي وبعد التجريد
    const stripped = n.replace(/^(لل|وال|بال|فال|كال|[وفبلك])/, "");
    return stripped && stripped !== n ? [n, norm(stripped)] : [n];
  });
  let best: { st: RosterStudent; len: number } | undefined;
  for (const st of roster) {
    const parts = st.name.trim().split(/\s+/).map(norm);
    const first = parts[0];
    if (!first || !words.includes(first)) continue;
    // الاسم الثنائي يتقدّم على الأحادي عند التشابه (نورة المهندي قبل نورة أخرى)
    const two = parts.length > 1 && sentence.includes(st.name.trim().split(/\s+/).slice(0, 2).join(" "));
    const len = two ? 2 : 1;
    if (!best || len > best.len) best = { st, len };
  }
  return best?.st;
}

const STAR_WORDS = /(نجمه|نجمتين|نجمتان|نجوم|شاطره|ممتازه|متميزه|مبدعه|أبدعت|ابدعت|تفوقت|رائعه|احسنت|أحسنت|اجابت|أجابت|جاوبت|فازت|ساعدت)/;
const FOLLOW_WORDS = /(متابعه|متعثره|ضعيفه|ما فهمت|لم تفهم|مش فاهمه|صعوبه|تشتت|شرود|تاخرت|تأخرت|بدون واجب|ما حلت|لم تحل|نسيت|تغيب|غابت كثير|غيابها|اتصلي بولي|كلمي ولي|ولية امر|وليه امر)/;
const TASK_WORDS = /(اطبعي|حضري|حضّري|جهزي|جهّزي|ذكريني|ذكّريني|لازم|لا تنسي|ما تنسي|ارسلي|أرسلي|ابعتي|راجعي|اشتري|احضري|أحضري|اطلبي|صوري|صوّري|انسخي|وزعي|وزّعي)/;

function starCount(s: string): number {
  if (/(نجمتين|نجمتان)/.test(s)) return 2;
  if (/(ثلاث نجوم|٣ نجوم|3 نجوم|تلات نجوم)/.test(s)) return 3;
  return 1;
}

/** تقسيم التفريغ جملاً: علامات الوقف والأسطر ثم فواصل «و» أمام أنماطنا */
export function splitSentences(transcript: string): string[] {
  return transcript
    .split(/[\n.؛;!؟?]+|،\s*(?=و?\s*\S)/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);
}

/** الاستخراج المحلي الكامل — دالة نقية قابلة للاختبار */
export function extractFromTranscript(transcript: string, roster: RosterStudent[]): ExtractedItem[] {
  const out: ExtractedItem[] = [];
  for (const sentence of splitSentences(transcript)) {
    const nsent = norm(sentence.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه"));
    const plain = sentence.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
    const student = matchStudent(sentence, roster);
    const isFollow = FOLLOW_WORDS.test(plain) || FOLLOW_WORDS.test(nsent);
    const isStar = STAR_WORDS.test(plain) || STAR_WORDS.test(nsent);
    const isTask = TASK_WORDS.test(sentence);

    // المتابعة تتقدّم على النجمة عند الالتباس — الانتباه للمتعثّرة أهم
    if (isFollow && (student || !isTask)) {
      out.push({ kind: "follow", text: sentence, studentId: student?.id, studentName: student?.name });
      continue;
    }
    if (isStar && (student || !isTask)) {
      out.push({ kind: "star", text: sentence, studentId: student?.id, studentName: student?.name, stars: starCount(sentence) });
      continue;
    }
    if (isTask) {
      out.push({ kind: "task", text: sentence });
      continue;
    }
    // جملة فيها اسم طالبة بلا نمط واضح ⇒ متابعة مقترحة (المعلّمة تقرر)
    if (student) out.push({ kind: "follow", text: sentence, studentId: student.id, studentName: student.name });
  }
  return out;
}
