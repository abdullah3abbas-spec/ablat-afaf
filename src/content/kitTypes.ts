/**
 * أنواع عناصر حزمة الدرس السبعة (§2-ج) — محتوى مبنى مسبقاً كبيانات.
 */

/** الألعاب المعتمدة الاثنتا عشرة فقط (§2-ج) — لا غيرها */
export const APPROVED_GAMES = [
  "سباق التصنيف",
  "من أنا؟",
  "صح وخطأ بالحركة",
  "بينجو المصطلحات",
  "كرت الخروج",
  "المحطات العلمية",
  "مسرح العلوم",
  "الخريطة الذهنية",
  "صندوق الأسئلة",
  "سباق السبورة",
  "لغز اليوم",
  "كنز المفردات",
] as const;

export type ApprovedGame = (typeof APPROVED_GAMES)[number];

export interface KitSlide {
  title: string;
  bullets: string[];
  /** ملاحظة للمعلّمة تظهر في ملاحظات الشريحة */
  note?: string;
}

export type WsKind = "define" | "fill" | "truefalse" | "classify" | "justify" | "draw";

export interface WsQuestion {
  kind: WsKind;
  text: string;
  answer: string;
}

export interface KitGame {
  name: ApprovedGame;
  /** دقائق ≤ 20 */
  minutes: number;
  howTo: string[];
  /** بطاقات اللعبة الجاهزة للطباعة والقص */
  cards: string[];
}

export interface KitExperiment {
  title: string;
  tools: string[];
  steps: string[];
  safety: string[];
  conclusionQuestion: string;
}

export interface LessonKit {
  /** يطابق عنوان الدرس المزروع في قاعدة البيانات حرفياً */
  lessonTitle: string;
  unitTitle: string;
  slides: KitSlide[];
  worksheet: WsQuestion[];
  game: KitGame;
  experiment: KitExperiment;
  /** ٣ أسئلة قصيرة تُجاب في دقيقتين آخر الحصة */
  exitCard: string[];
  /** حقول خطة الدرس بنموذج المدرسة */
  plan: {
    objectives: string[];
    warmup: string;
    strategies: string[];
    activities: string[];
    materials: string[];
    assessment: string;
    homework: string;
    differentiation: string;
  };
  /** معايير ورقة رصد المشاركة */
  participationCriteria: string[];
}
