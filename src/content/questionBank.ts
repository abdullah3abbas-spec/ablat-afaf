/**
 * بنك الأسئلة الحقيقي — منقول من كتاب العلوم الرسمي (ف١ ج١، طبعة ٢٠٢٥):
 * أسئلة «أتحقق مما تعلمت» بخياراتها + مشتقات أمينة من «ماذا تعلمت؟»
 * وتعريفات القاموس الختامي. المصطلحات حرفية من الكتاب (§ لغة المادة).
 *
 * كل سؤال مربوط بـ: رمز الدرس (1.1…) + ناتج التعلم الرسمي (B05xx.n) + صفحة الكتاب.
 * الأسئلة المعتمدة على صور الكتاب أُعيدت صياغتها نصياً أو استُبعدت.
 */
import type { CognitiveLevel, Question, QuestionOption, QuestionType } from "@/db/schema";

interface BookQ {
  /** رمز الدرس في الكتاب */
  lesson: string;
  /** ناتج التعلم الرسمي */
  outcome: string;
  /** صفحة الكتاب المطبوع (للاستشهاد) */
  page: number;
  type: QuestionType;
  cog: CognitiveLevel;
  marks: number;
  minutes: number;
  text: string;
  options?: QuestionOption[];
  answer: string;
}

const Q: BookQ[] = [
  // ═══ الدرس 1.1 — على ماذا تتغذى الكائنات الحية؟ ═══
  { lesson: "1.1", outcome: "B0501.1", page: 14, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما المصطلح الذي يشير إلى الحيوان الذي يتغذى على النباتات فقط؟",
    options: [{ key: "أ", text: "آكل العشب" }, { key: "ب", text: "آكل اللحوم" }, { key: "ج", text: "مفترس" }, { key: "د", text: "قارت" }],
    answer: "أ" },
  { lesson: "1.1", outcome: "B0501.1", page: 14, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "أي جملة من الجمل الآتية تصف القارت؟",
    options: [
      { key: "أ", text: "حيوان يتغذى على النباتات ولحوم الحيوانات الأخرى معاً" },
      { key: "ب", text: "حيوان يتغذى فقط على النباتات" },
      { key: "ج", text: "حيوان يتغذى فقط على الأعشاب" },
      { key: "د", text: "حيوان يتغذى فقط على لحوم الحيوانات الأخرى" },
    ],
    answer: "أ" },
  { lesson: "1.1", outcome: "B0501.1", page: 13, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "يُعد الإنسان من القوارت لأنه يتغذى على النباتات واللحوم.",
    answer: "صواب" },
  { lesson: "1.1", outcome: "B0501.2", page: 7, type: "matching", cog: "apply", marks: 3, minutes: 3,
    text: "صِلي كل حيوان بمجموعته الغذائية: (المها العربي · الصقر · الدب البني)",
    answer: "المها العربي ↔ آكل العشب · الصقر ↔ آكل اللحوم · الدب البني ↔ قارت" },
  { lesson: "1.1", outcome: "B0501.1", page: 146, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: آكل العشب.",
    answer: "حيوان يتغذى على النباتات." },
  { lesson: "1.1", outcome: "B0501.1", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: القارت.",
    answer: "حيوان يتغذى على النباتات والحيوانات." },
  { lesson: "1.1", outcome: "B0501.1", page: 18, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "الحيوانات آكلة اللحوم تتغذى على —— فقط.",
    answer: "لحوم الحيوانات الأخرى" },
  { lesson: "1.1", outcome: "B0501.2", page: 13, type: "justify", cog: "apply", marks: 2, minutes: 3,
    text: "هل يُعد الإنسان من آكلي اللحوم أم آكلي العشب أم القوارت؟ علّلي إجابتك.",
    answer: "من القوارت — لأنه يتغذى على النباتات مثل الخضروات، ويتغذى أيضاً على لحوم الحيوانات مثل الدواجن." },

  // ═══ الدرس 1.2 — ما السلاسل الغذائية؟ ═══
  { lesson: "1.2", outcome: "B0501.3", page: 27, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "ماذا تبين السلسلة الغذائية؟",
    options: [
      { key: "أ", text: "جميع ما يتغذى عليه الحيوان" },
      { key: "ب", text: "جميع الحيوانات الموجودة في الموطن" },
      { key: "ج", text: "العلاقات الغذائية بين الكائنات الحية" },
      { key: "د", text: "عدد النباتات التي يتغذى عليها الحيوان" },
    ],
    answer: "ج" },
  { lesson: "1.2", outcome: "B0502.1", page: 27, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "تبدأ السلاسل الغذائية بالنبات.",
    answer: "صواب" },
  { lesson: "1.2", outcome: "B0502.1", page: 27, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "تسمى النباتات المنتجات لأنها:",
    options: [
      { key: "أ", text: "تصنع غذاءها بنفسها" },
      { key: "ب", text: "تؤكل من الحيوانات فقط" },
      { key: "ج", text: "توجد في نهاية السلسلة الغذائية" },
      { key: "د", text: "تتغذى على الحيوانات" },
    ],
    answer: "أ" },
  { lesson: "1.2", outcome: "B0502.1", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: الفريسة.",
    answer: "حيوان يتم اصطياده من حيوانات أخرى." },
  { lesson: "1.2", outcome: "B0502.1", page: 149, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: المفترس.",
    answer: "حيوان يصطاد ويقتل حيوانات أخرى." },
  { lesson: "1.2", outcome: "B0502.2", page: 19, type: "order", cog: "apply", marks: 3, minutes: 2,
    text: "رتّبي مكونات هذه السلسلة الغذائية من بدايتها: (عصفور — أوراق النبات — خنفساء)",
    answer: "أوراق النبات ← خنفساء ← عصفور" },
  { lesson: "1.2", outcome: "B0501.3", page: 27, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "توجد الحيوانات آكلة العشب في —— السلاسل الغذائية.",
    answer: "منتصف" },
  { lesson: "1.2", outcome: "B0502.1", page: 27, type: "shortessay", cog: "higher", marks: 3, minutes: 4,
    text: "لماذا لا يمكن أن تبدأ السلسلة الغذائية بحيوان؟",
    answer: "لأن السلاسل الغذائية تبدأ بالمنتجات، والنباتات هي التي تصنع غذاءها بنفسها، أما الحيوانات فتتغذى على غيرها." },

  { lesson: "1.2", outcome: "B0501.3", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: العلاقة الغذائية.",
    answer: "طريقة ارتباط الحيوانات بعضها ببعض تبعاً لما تتغذى عليه." },

  // ═══ الدرس 1.3 — كيف أستطيع أن أبني سلاسل غذائية؟ ═══
  { lesson: "1.3", outcome: "B0502.2", page: 36, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما المفترسات؟",
    options: [
      { key: "أ", text: "حيوانات يتم اصطيادها من حيوانات أخرى" },
      { key: "ب", text: "أحد أنواع النبات" },
      { key: "ج", text: "حيوانات تصطاد الحيوانات الأخرى" },
      { key: "د", text: "حيوانات تتغذى فقط على النباتات" },
    ],
    answer: "ج" },
  { lesson: "1.3", outcome: "B0502.2", page: 36, type: "mcq", cog: "understand", marks: 1, minutes: 2,
    text: "أي جملة من الجمل الآتية خاطئة؟",
    options: [
      { key: "أ", text: "يمكن للمنتجات أن تكون من النباتات أو الحيوانات" },
      { key: "ب", text: "تصنع المنتجات غذاءها بنفسها" },
      { key: "ج", text: "توجد المنتجات في المستوى الأول من السلسلة الغذائية" },
      { key: "د", text: "يتم التغذي على المنتجات من الحيوانات آكلة العشب والقوارت" },
    ],
    answer: "أ" },
  { lesson: "1.3", outcome: "B0502.2", page: 33, type: "matching", cog: "apply", marks: 3, minutes: 3,
    text: "حدّدي دور كل كائن حي في السلسلة الغذائية: نبات ← أرنب ← ثعلب",
    answer: "النبات ↔ منتج · الأرنب ↔ فريسة · الثعلب ↔ مفترس" },
  { lesson: "1.3", outcome: "B0502.3", page: 35, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "تتكون السلاسل الغذائية دائماً من منتجات وفرائس ومفترسات.",
    answer: "صواب" },
  { lesson: "1.3", outcome: "B0502.3", page: 35, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "يمكن للعديد من القوارت أن تكون من المفترسات في بعض السلاسل الغذائية، ومن الفرائس في سلاسل غذائية أخرى.",
    answer: "صواب" },
  { lesson: "1.3", outcome: "B0502.3", page: 31, type: "order", cog: "apply", marks: 3, minutes: 2,
    text: "كوّني سلسلة غذائية صحيحة من هذه الكائنات الحية: (جرادة — نبات — ضفدع)",
    answer: "نبات ← جرادة ← ضفدع" },
  { lesson: "1.3", outcome: "B0502.2", page: 36, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "توجد المنتجات في المستوى —— من السلسلة الغذائية.",
    answer: "الأول" },

  // ═══ الدرس 1.4 — كيف أستطيع أن أبني سلاسل غذائية أكثر تعقيداً؟ ═══
  { lesson: "1.4", outcome: "B0502.3", page: 45, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "ما الوصف الصحيح للكائن الحي في السلسلة الغذائية؟",
    options: [
      { key: "أ", text: "يمكن أن يتواجد في أكثر من سلسلة غذائية واحدة" },
      { key: "ب", text: "يتواجد في سلسلة غذائية واحدة فقط" },
      { key: "ج", text: "يكون منتجاً ومفترساً معاً" },
      { key: "د", text: "يتواجد في السلسلة الغذائية نفسها أكثر من مرة" },
    ],
    answer: "أ" },
  { lesson: "1.4", outcome: "B0502.3", page: 45, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "كم مستوى يمكن أن تتضمن السلسلة الغذائية؟",
    options: [
      { key: "أ", text: "ما يصل إلى ثلاثة مستويات" },
      { key: "ب", text: "بين ثلاثة وسبعة مستويات" },
      { key: "ج", text: "ما يصل إلى تسعة مستويات" },
      { key: "د", text: "بين ثلاثة وخمسة مستويات" },
    ],
    answer: "د" },
  { lesson: "1.4", outcome: "B0502.3", page: 45, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "لا تحتوي السلاسل الغذائية على أكثر من خمسة كائنات حية.",
    answer: "صواب" },
  { lesson: "1.4", outcome: "B0501.3", page: 45, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "في السلاسل الغذائية التي تتكون من أكثر من ثلاثة مستويات، تكون بعض الحيوانات فيها من الفرائس والمفترسات معاً.",
    answer: "صواب" },
  { lesson: "1.4", outcome: "B0502.3", page: 43, type: "order", cog: "apply", marks: 3, minutes: 3,
    text: "رتّبي هذه الكائنات الحية في سلسلة غذائية من أربعة مستويات: (عنكبوت — بلح — صقر — ذبابة)",
    answer: "بلح ← ذبابة ← عنكبوت ← صقر" },
  { lesson: "1.4", outcome: "B0501.3", page: 45, type: "inquiry", cog: "higher", marks: 4, minutes: 5,
    text: "ماذا يحدث في غياب جميع المفترسات في السلسلة الغذائية؟ فسّري أثر ذلك على الموطن.",
    answer: "تزداد أعداد الفرائس كثيراً فتستهلك المنتجات (النباتات) بشدة، فيختل التوازن الغذائي في الموطن." },
  { lesson: "1.4", outcome: "B0502.3", page: 40, type: "shortessay", cog: "higher", marks: 3, minutes: 4,
    text: "كوّني سلسلتين غذائيتين بحيث يكون فيهما القرد مفترساً مرة، ومفترساً وفريسة معاً مرة أخرى.",
    answer: "ثمار ← قرد (القرد مفترس) · ثمار ← قرد ← نمر (القرد مفترس للثمار وفريسة للنمر)." },

  { lesson: "1.4", outcome: "B0502.3", page: 45, type: "readchart", cog: "apply", marks: 3, minutes: 4,
    text: "الجدول يبين ثلاث سلاسل غذائية: السلسلة أ (3 مستويات) · السلسلة ب (4 مستويات) · السلسلة ج (5 مستويات). أي السلاسل تحتوي حيواناً يُعد مفترساً وفريسة معاً؟ وكم عدد هذه الحيوانات في السلسلة ج؟",
    answer: "السلسلتان ب و ج (أكثر من ثلاثة مستويات) — وفي السلسلة ج ثلاثة حيوانات تكون مفترسة وفريسة معاً (المستويات الوسطى الثلاثة)." },

  // ═══ الدرس 1.5 — كيف تكون الأسنان والمناقير متخصصة؟ ═══
  { lesson: "1.5", outcome: "B0503.1", page: 57, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما أنواع الحيوانات التي لديها غالباً قواطع عريضة ومسطحة؟",
    options: [
      { key: "أ", text: "الحيوانات آكلة اللحوم والحيوانات آكلة العشب" },
      { key: "ب", text: "القوارت والمنتجات" },
      { key: "ج", text: "الحيوانات آكلة العشب والقوارت" },
      { key: "د", text: "المنتجات والحيوانات آكلة اللحوم" },
    ],
    answer: "ج" },
  { lesson: "1.5", outcome: "B0503.1", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: القاطع.",
    answer: "نوع من الأسنان حاد ورفيع، ويستخدم لقطع أجزاء من الطعام وسحبها." },
  { lesson: "1.5", outcome: "B0503.1", page: 149, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: الناب.",
    answer: "سن حادة ومدببة تستخدم لتمزيق اللحوم وتقطيعها." },
  { lesson: "1.5", outcome: "B0503.1", page: 147, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: الطاحن.",
    answer: "نوع من الأسنان كبير ومسطح، ويستخدم لطحن الغذاء." },
  { lesson: "1.5", outcome: "B0503.2", page: 57, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "لبعض الحيوانات آكلة اللحوم، مثل النسور، مناقير حادة تساعدها على اصطياد الحيوانات الأخرى والتغذي عليها.",
    answer: "صواب" },
  { lesson: "1.5", outcome: "B0503.2", page: 57, type: "matching", cog: "apply", marks: 3, minutes: 3,
    text: "صِلي كل نوع منقار أو أسنان بأصحابه: (منقار عريض ومسطح · منقار حاد · ضواحك)",
    answer: "منقار عريض ومسطح ↔ آكلة العشب مثل الأوز · منقار حاد ↔ آكلة اللحوم مثل النسور · ضواحك ↔ القوارت" },
  { lesson: "1.5", outcome: "B0503.2", page: 57, type: "justify", cog: "understand", marks: 2, minutes: 3,
    text: "لماذا تحتاج القوارت إلى مناقير أو أسنان تناسب النباتات واللحوم معاً؟",
    answer: "لأنها تتغذى على النباتات ولحوم الحيوانات الأخرى معاً، ومن أنواع أسنانها الضواحك التي تستخدم لقضم الطعام وطحنه." },
  { lesson: "1.5", outcome: "B0503.2", page: 57, type: "inquiry", cog: "higher", marks: 4, minutes: 4,
    text: "لاحظتِ حيواناً له أنياب طويلة وحادة — توقّعي علاقته الغذائية مع التعليل.",
    answer: "أتوقع أنه من آكلة اللحوم (مفترس)، لأن الأنياب الحادة والمدببة تساعده على اصطياد الحيوانات وتمزيق اللحوم — ملاحظة أسنان الحيوان تساعدنا على توقع علاقته الغذائية." },

  { lesson: "1.5", outcome: "B0503.2", page: 57, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "من أنواع أسنان القوارت الضواحك التي تستخدم لقضم الطعام وطحنه.",
    answer: "صواب" },

  // ═══ الدرس 1.6 — كيف ترتبط خصائص الحيوانات بغذائها؟ ═══
  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما الخصائص الجسمية التي تمتلكها العديد من الحيوانات آكلة العشب؟",
    options: [
      { key: "أ", text: "مخالب وأسنان حادة" },
      { key: "ب", text: "عينان تقعان في مقدمة الرأس" },
      { key: "ج", text: "لا تمتلك عينين" },
      { key: "د", text: "عينان تقعان على جانبي الرأس" },
    ],
    answer: "د" },
  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "كيف تصنَّف الطيور ذات المناقير والمخالب الحادة؟",
    options: [
      { key: "أ", text: "حيوانات آكلة اللحوم أو قوارت" },
      { key: "ب", text: "حيوانات آكلة العشب فقط" },
      { key: "ج", text: "منتجات" },
      { key: "د", text: "فرائس دائماً" },
    ],
    answer: "أ" },
  { lesson: "1.6", outcome: "B0503.3", page: 146, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: الحوافر.",
    answer: "الأقدام المسطحة والقاسية لبعض الحيوانات، مثل الحصان." },
  { lesson: "1.6", outcome: "B0503.3", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: المخالب.",
    answer: "أجزاء من الجسم حادة، توجد على أيدي أو أقدام بعض الحيوانات مثل الدببة." },
  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "للعديد من الحيوانات التي تكوّن العلاقات الغذائية نفسها خصائص جسمية متشابهة.",
    answer: "صواب" },
  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "justify", cog: "higher", marks: 3, minutes: 4,
    text: "لماذا تقع عينا الفريسة غالباً على جانبي رأسها؟",
    answer: "لترى في اتجاهات واسعة حولها، فتساعدها هذه الخاصية الجسمية على حماية نفسها من الحيوانات المفترسة." },
  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "shortessay", cog: "understand", marks: 3, minutes: 3,
    text: "اذكري ثلاث فوائد للخصائص الجسمية للحيوانات في العلاقات الغذائية.",
    answer: "تساعد الحيوانات على التغذي، أو إيجاد الغذاء، أو حماية نفسها من الحيوانات المفترسة." },

  { lesson: "1.6", outcome: "B0503.3", page: 67, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "تقع عينا الحيوان المفترس غالباً في —— الرأس.",
    answer: "مقدمة" },

  // ═══ الدرس 1.7 — ما آكلات الرمم والمحلّلات؟ ═══
  { lesson: "1.7", outcome: "B0504.1", page: 78, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما آكل الرمم؟",
    options: [
      { key: "أ", text: "حيوان يتغذى على النباتات" },
      { key: "ب", text: "حيوان يتغذى على النباتات والحيوانات الأخرى" },
      { key: "ج", text: "كائن حي يتغذى على الكائنات الحية الأخرى" },
      { key: "د", text: "حيوان يتغذى على الحيوانات الميتة" },
    ],
    answer: "د" },
  { lesson: "1.7", outcome: "B0504.1", page: 148, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: المحلّل.",
    answer: "كائن حي يقوم بتحليل الأجزاء الصغيرة من الحيوانات والنباتات الميتة." },
  { lesson: "1.7", outcome: "B0504.1", page: 78, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "آكلات الرمم حيوانات تتغذى على الحيوانات الميتة التي لم تصطدها بنفسها.",
    answer: "صواب" },
  { lesson: "1.7", outcome: "B0504.1", page: 78, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "من المحلّلات:",
    options: [
      { key: "أ", text: "بعض البكتيريا وبعض الفطريات" },
      { key: "ب", text: "الصقور والنسور" },
      { key: "ج", text: "الأرانب والماعز" },
      { key: "د", text: "النباتات الخضراء" },
    ],
    answer: "أ" },
  { lesson: "1.7", outcome: "B0504.2", page: 78, type: "fillblank", cog: "understand", marks: 2, minutes: 2,
    text: "تقوم المحلّلات بتحليل أجسام الكائنات الميتة فتستخرج —— وتعيدها إلى التربة.",
    answer: "المواد الغذائية البسيطة" },
  { lesson: "1.7", outcome: "B0504.2", page: 87, type: "justify", cog: "understand", marks: 2, minutes: 3,
    text: "لماذا تعد المحلّلات مهمة في السلاسل الغذائية؟",
    answer: "لأنها تعيد المواد الغذائية إلى التربة، مما يساعد النباتات الجديدة على النمو." },
  { lesson: "1.7", outcome: "B0504.2", page: 79, type: "inquiry", cog: "higher", marks: 4, minutes: 5,
    text: "ماذا قد يحدث لو أزيلت آكلات الرمم والمحلّلات من موطن ما؟",
    answer: "تتراكم أجسام الكائنات الميتة في الموطن، ولا تعود المواد الغذائية إلى التربة، فتضعف النباتات الجديدة وتتأثر السلاسل الغذائية كلها." },

  // ═══ الدرس 1.8 — مشروع الوحدة: ماذا أعرف عن السلاسل الغذائية؟ ═══
  { lesson: "1.8", outcome: "B0502.3", page: 81, type: "inquiry", cog: "higher", marks: 4, minutes: 6,
    text: "أعدّي سلسلة غذائية من أربعة مستويات أو أكثر لكائنات حية تعيش في دولة قطر، وسمّي دور كل كائن فيها.",
    answer: "مثال: نبات (منتج) ← جرادة (آكلة عشب/فريسة) ← ضب (مفترس وفريسة) ← صقر (مفترس). تُقبل كل سلسلة صحيحة تبدأ بمنتج وتتسلسل منطقياً." },
  { lesson: "1.8", outcome: "B0501.3", page: 87, type: "shortessay", cog: "understand", marks: 3, minutes: 3,
    text: "كيف تساعدنا السلاسل الغذائية على تصنيف الحيوانات إلى آكلات عشب أو قوارت أو آكلات لحوم؟",
    answer: "موقع الحيوان في السلسلة الغذائية وما يتغذى عليه يبين نوع غذائه، فيمكن تصنيف الكائنات الحية كمنتجات وفرائس ومفترسات باستخدام السلاسل الغذائية." },
  { lesson: "1.8", outcome: "B0504.2", page: 89, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "يمكن أن تُضاف المحلّلات وآكلات الرمم إلى السلسلة الغذائية بعد مستواها الأخير.",
    answer: "صواب" },

  // ═══ الدرس 2.1 — ما الدوائر الكهربائية؟ ═══
  { lesson: "2.1", outcome: "P0504.1", page: 102, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "أي المكونات الآتية يمكن استخدامه لتوصيل الدائرة الكهربائية أو قطعها؟",
    options: [
      { key: "أ", text: "مقاومة كهربائية" },
      { key: "ب", text: "بطارية" },
      { key: "ج", text: "مفتاح كهربائي" },
      { key: "د", text: "محرك كهربائي" },
    ],
    answer: "ج" },
  { lesson: "2.1", outcome: "P0504.1", page: 102, type: "mcq", cog: "apply", marks: 1, minutes: 2,
    text: "اختاري مجموعة مكونات الدائرة الكهربائية التي يمكن استخدامها لبناء دائرة كهربائية مغلقة من دون الحاجة إلى إضافة أي مكونات أخرى:",
    options: [
      { key: "أ", text: "بطارية، مفتاح كهربائي، محرك كهربائي، مصباح كهربائي" },
      { key: "ب", text: "أسلاك توصيل، مفتاح كهربائي، مقاومة كهربائية، مصباح كهربائي" },
      { key: "ج", text: "مفتاح كهربائي، مقاومة كهربائية، بطارية، مصباح كهربائي" },
      { key: "د", text: "بطارية، محرك كهربائي، مفتاح كهربائي، أسلاك توصيل" },
    ],
    answer: "د" },
  { lesson: "2.1", outcome: "P0504.1", page: 146, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: الخلية الكهربائية.",
    answer: "مصدر للطاقة الكهربائية، تستخدم لتزويد مكونات الدائرة الكهربائية بالطاقة. عند توصيل خليتين كهربائيتين أو أكثر معاً تتكون البطارية." },
  { lesson: "2.1", outcome: "P0504.1", page: 101, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "تعيق المقاومات الكهربائية مرور التيار الكهربائي من خلالها.",
    answer: "صواب" },
  { lesson: "2.1", outcome: "P0504.1", page: 101, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "تستخدم المحركات الكهربائية الطاقة الكهربائية لتنتج ——.",
    answer: "الحركة" },
  { lesson: "2.1", outcome: "P0504.1", page: 101, type: "matching", cog: "understand", marks: 3, minutes: 3,
    text: "صِلي كل مكوّن كهربائي بما ينتجه من الطاقة: (المصباح · الجرس · المحرك · السخان)",
    answer: "المصباح ↔ الضوء · الجرس ↔ الصوت · المحرك ↔ الحركة · السخان ↔ الحرارة" },
  { lesson: "2.1", outcome: "P0504.1", page: 101, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ماذا تقيس أجهزة الأميتر؟",
    options: [
      { key: "أ", text: "شدة التيار الكهربائي" },
      { key: "ب", text: "درجة الحرارة" },
      { key: "ج", text: "الكتلة" },
      { key: "د", text: "الزمن" },
    ],
    answer: "أ" },

  // ═══ الدرس 2.2 — كيف أبني الدوائر الكهربائية؟ ═══
  { lesson: "2.2", outcome: "P0504.2", page: 111, type: "mcq", cog: "understand", marks: 1, minutes: 2,
    text: "دائرة كهربائية فيها بطارية وأسلاك سليمة ومصابيح، لكن المصابيح غير مضاءة — ما السبب الأرجح؟",
    options: [
      { key: "أ", text: "لا توجد خلية كهربائية أو بطارية" },
      { key: "ب", text: "المفتاح الكهربائي مفتوح" },
      { key: "ج", text: "المفتاح الكهربائي مغلق" },
      { key: "د", text: "المصابيح تنتج حرارة فقط" },
    ],
    answer: "ب" },
  { lesson: "2.2", outcome: "P0504.2", page: 111, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "لماذا تعد الدائرة الكهربائية دائرة متصلة على التوالي؟",
    options: [
      { key: "أ", text: "تتضمن مصباحاً كهربائياً واحداً" },
      { key: "ب", text: "لا يوجد انفصال ضمن الدائرة الكهربائية" },
      { key: "ج", text: "المفتاح الكهربائي مغلق" },
      { key: "د", text: "تتضمن مساراً واحداً" },
    ],
    answer: "د" },
  { lesson: "2.2", outcome: "P0504.2", page: 147, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: دائرة التوالي الكهربائية.",
    answer: "دائرة كهربائية تتضمن حلقة واحدة أو مساراً واحداً." },
  { lesson: "2.2", outcome: "P0504.2", page: 147, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: دائرة التوازي الكهربائية.",
    answer: "دائرة كهربائية تتضمن أكثر من حلقة واحدة أو مسار واحد." },
  { lesson: "2.2", outcome: "P0504.2", page: 110, type: "truefalse", cog: "understand", marks: 1, minutes: 1,
    text: "تعمل المكونات في المسارات المختلفة لدائرة التوازي الكهربائية بشكل مستقل.",
    answer: "صواب" },
  { lesson: "2.2", outcome: "P0504.2", page: 110, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "ينبغي أن يكون كل مسار من المسارات الموجودة في الدائرة الكهربائية —— كي يعمل.",
    answer: "مغلقاً" },
  { lesson: "2.2", outcome: "P0504.2", page: 110, type: "justify", cog: "apply", marks: 2, minutes: 3,
    text: "في لعبة تمرير الحلقة المعدنية على السلك: لماذا يصدر الجرس الكهربائي صوتاً عند ملامسة الحلقة للسلك؟",
    answer: "لأنه عند ملامسة الحلقة المعدنية للسلك المعدني تتكون دائرة كهربائية مغلقة، فيسري التيار الكهربائي ويتسبب في إصدار صوت الجرس." },

  { lesson: "2.2", outcome: "P0504.2", page: 107, type: "readchart", cog: "apply", marks: 3, minutes: 4,
    text: "جدول تجربة: دائرة توالٍ بمصباحين — عند فك مصباح واحد: (توقعي: يبقى الآخر مضيئاً · ملاحظتي: انطفأ الاثنان). دائرة توازٍ بمصباحين — عند فك مصباح واحد: (توقعي: ينطفئ الاثنان · ملاحظتي: بقي الآخر مضيئاً). فسّري الملاحظتين.",
    answer: "في التوالي مسار واحد، ففك أي مكوّن يفتح الدائرة كلها فينطفئ الجميع. في التوازي أكثر من مسار، والمسارات تعمل بشكل مستقل، فيبقى مصباح المسار المغلق مضيئاً." },

  // ═══ الدرس 2.3 — كيف أستطيع أن أرسم مخططات الدوائر الكهربائية؟ ═══
  { lesson: "2.3", outcome: "P0505.1", page: 119, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "يمكن تمثيل كل مكوّن كهربائي برمز.",
    answer: "صواب" },
  { lesson: "2.3", outcome: "P0505.1", page: 119, type: "mcq", cog: "understand", marks: 1, minutes: 1,
    text: "لماذا نستخدم الرموز الموحدة نفسها للمكونات في كل دائرة كهربائية؟",
    options: [
      { key: "أ", text: "لتسهيل فهم الدوائر الكهربائية وبنائها" },
      { key: "ب", text: "لتجميل شكل المخطط" },
      { key: "ج", text: "لتقليل عدد المكونات" },
      { key: "د", text: "لزيادة شدة التيار" },
    ],
    answer: "أ" },
  { lesson: "2.3", outcome: "P0505.1", page: 147, type: "define", cog: "remember", marks: 2, minutes: 2,
    text: "عرّفي: رموز الدائرة الكهربائية.",
    answer: "رموز تستخدم في مخططات الدوائر الكهربائية لتمثيل المكونات الكهربائية." },
  { lesson: "2.3", outcome: "P0505.2", page: 119, type: "fillblank", cog: "remember", marks: 2, minutes: 1,
    text: "تُمثَّل الأسلاك في مخطط الدائرة الكهربائية باستخدام الخطوط ——.",
    answer: "المستقيمة" },
  { lesson: "2.3", outcome: "P0505.2", page: 119, type: "shortessay", cog: "understand", marks: 3, minutes: 3,
    text: "كيف تُرسم الدائرة الكهربائية بالرموز رسماً صحيحاً؟",
    answer: "من خلال وضع الرمز الصحيح في الموقع الصحيح في الدائرة الكهربائية، واستخدام الخطوط المستقيمة لتمثيل الأسلاك." },
  { lesson: "2.3", outcome: "P0505.1", page: 115, type: "shortessay", cog: "remember", marks: 3, minutes: 3,
    text: "اذكري ثلاثة مكونات كهربائية لها رموز موحدة في مخططات الدوائر الكهربائية.",
    answer: "من بينها: البطارية (الخلية الكهربائية)، المفتاح الكهربائي، المصباح الكهربائي، المحرك الكهربائي، المقاومة الكهربائية، جهاز الأميتر، سلك التوصيل — تُقبل أي ثلاثة." },
  { lesson: "2.3", outcome: "P0505.2", page: 119, type: "drawlabel", cog: "apply", marks: 3, minutes: 4,
    text: "ارسمي مخطط دائرة كهربائية على التوالي فيها: خلية كهربائية ومفتاح كهربائي مغلق ومصباح كهربائي، مستخدمة الرموز.",
    answer: "رسم حلقة واحدة بخطوط مستقيمة تصل رمز الخلية ثم المفتاح المغلق ثم المصباح." },

  { lesson: "2.3", outcome: "P0505.1", page: 115, type: "mcq", cog: "remember", marks: 1, minutes: 1,
    text: "ما المكوّن الذي يمثله رمز الدائرة التي بداخلها علامة (✕)؟",
    options: [
      { key: "أ", text: "مصباح كهربائي" },
      { key: "ب", text: "محرك كهربائي" },
      { key: "ج", text: "جهاز الأميتر" },
      { key: "د", text: "مقاومة كهربائية" },
    ],
    answer: "أ" },

  // ═══ الدرس 2.4 — كيف أستطيع أن أستخدم مخطط دائرة كهربائية لأبنيها؟ ═══
  { lesson: "2.4", outcome: "P0505.3", page: 131, type: "mcq", cog: "apply", marks: 1, minutes: 1,
    text: "دائرة كهربائية مكتملة التوصيل ومفتاحها الكهربائي مفتوح — ما اللازم لجعلها تعمل؟",
    options: [
      { key: "أ", text: "إزالة مصباح كهربائي واحد" },
      { key: "ب", text: "إضافة بطارية ثانية" },
      { key: "ج", text: "إضافة مفتاح كهربائي آخر" },
      { key: "د", text: "إغلاق المفتاح الكهربائي" },
    ],
    answer: "د" },
  { lesson: "2.4", outcome: "P0505.3", page: 130, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "ينبغي أن تحتوي جميع الدوائر الكهربائية على خلية كهربائية أو بطارية.",
    answer: "صواب" },
  { lesson: "2.4", outcome: "P0505.3", page: 130, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "لن تعمل المكونات الموجودة في الدوائر الكهربائية المفتوحة.",
    answer: "صواب" },
  { lesson: "2.4", outcome: "P0505.3", page: 130, type: "fillblank", cog: "understand", marks: 2, minutes: 1,
    text: "يمكن إصلاح الدوائر الكهربائية عبر إضافة خلية كهربائية و—— جميع نقاط الانفصال.",
    answer: "إغلاق" },
  { lesson: "2.4", outcome: "P0505.3", page: 125, type: "order", cog: "apply", marks: 3, minutes: 3,
    text: "رتّبي خطوات بناء دائرة كهربائية من مخططها: (أوصّل المكونات بالأسلاك كما في المخطط — أقرأ المخطط وأحدد الرموز — أختبر الدائرة بإغلاق المفتاح — أجمع المكونات المطابقة للرموز)",
    answer: "أقرأ المخطط وأحدد الرموز ← أجمع المكونات المطابقة للرموز ← أوصّل المكونات بالأسلاك كما في المخطط ← أختبر الدائرة بإغلاق المفتاح" },
  { lesson: "2.4", outcome: "P0505.3", page: 133, type: "inquiry", cog: "higher", marks: 4, minutes: 5,
    text: "لعبة طائرة مروحية تستخدم بطارية لتدور شفرات مروحيتها وتصدر الأصوات — ما المكونات اللازمة لدائرتها الكهربائية؟",
    answer: "بطارية، ومفتاح كهربائي، ومحرك كهربائي (لدوران الشفرات)، وجرس كهربائي أو مكبر صوت (لإصدار الأصوات)، وأسلاك توصيل." },

  // ═══ الدرس 2.5 — مشروع الوحدة: ماذا أعرف عن الدوائر الكهربائية؟ ═══
  { lesson: "2.5", outcome: "P0504.1", page: 135, type: "shortessay", cog: "apply", marks: 3, minutes: 4,
    text: "عدّدي أربعة أجهزة كهربائية منزلية، وبيّني مكوّناً كهربائياً داخل كل جهاز منها.",
    answer: "مثال: الفرن الكهربائي (سخان/مقاومة كهربائية)، المروحة (محرك كهربائي)، جرس الباب (جرس كهربائي)، المصباح (مصباح كهربائي) — تُقبل كل إجابة صحيحة." },
  { lesson: "2.5", outcome: "P0505.2", page: 137, type: "drawlabel", cog: "higher", marks: 4, minutes: 6,
    text: "ارسمي مخطط الدائرة الكهربائية للفرن الكهربائي مستخدمة الرموز، وسمّي مكوناته.",
    answer: "مخطط فيه: خلية كهربائية أو مصدر كهرباء + مفتاح كهربائي + مقاومة كهربائية (السخان) موصولة بخطوط مستقيمة (الأسلاك)." },
  { lesson: "2.5", outcome: "P0505.2", page: 135, type: "truefalse", cog: "remember", marks: 1, minutes: 1,
    text: "في مشروع الوحدة تُعدّ لوحة حائط تُظهر الدوائر الكهربائية الموجودة في أربعة أجهزة كهربائية مختلفة على الأقل.",
    answer: "صواب" },
];

/**
 * بناء صفوف البنك — تُربط بالدروس الحقيقية برمز الدرس (1.1…).
 * أسئلة الكتاب حقيقية لا تجريبية (isDemo: false) — تنجو من «مسح البيانات التجريبية».
 */
export function buildBankQuestions(
  lessonByCode: Map<string, { id: number; unitId: number }>
): Question[] {
  const now = Date.now();
  const rows: Question[] = [];
  for (const q of Q) {
    const lesson = lessonByCode.get(q.lesson);
    if (!lesson) continue;
    rows.push({
      unitId: lesson.unitId,
      lessonId: lesson.id,
      learningOutcomeCode: q.outcome,
      text: q.text,
      type: q.type,
      options: q.options,
      answerKey: q.answer,
      marks: q.marks,
      difficulty: q.cog === "higher" ? "hard" : q.cog === "apply" ? "medium" : "easy",
      cognitiveLevel: q.cog,
      estimatedMinutes: q.minutes,
      usageCount: 0,
      tags: ["من-الكتاب", `ص${q.page}`],
      isDemo: false,
      createdAt: now,
    });
  }
  return rows;
}

/** عدد أسئلة البنك المؤلّفة من الكتاب — للاختبارات */
export const BOOK_BANK_COUNT = Q.length;
