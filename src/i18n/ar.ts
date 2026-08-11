/**
 * كل النصوص الظاهرة للمستخدمة — في ملف واحد، لا مبعثرة في الكود (§1).
 *
 * قاعدتان:
 * ١) المعلّمة تُخاطَب بصيغة المؤنث دائماً («جرّبي، اطبعي») — لا تُقلَب أبداً.
 * ٢) مفردات الطالبات فقط هي التي يقلبها studentGender (الافتراضي female)،
 *    فإن دُرّست فصول بنين مستقبلاً تتغيّر الصياغة تلقائياً دون إعادة بناء.
 */
import type { Gender } from "@/db/schema";

/** مفردات الطالبات — الشيء الوحيد الذي يقلبه studentGender (§1) */
export function genderedVocab(g: Gender) {
  const f = g === "female";
  return {
    student: f ? "الطالبة" : "الطالب",
    students: f ? "الطالبات" : "الطلاب",
    studentsCount: f ? "عدد الطالبات" : "عدد الطلاب",
    aStudent: f ? "طالبة" : "طالب",
    studentsPlural: f ? "طالبات" : "طلاب",
    present: f ? "حاضرة" : "حاضر",
    presented: f ? "حضرت" : "حضر",
    absent: f ? "غائبة" : "غائب",
    absented: f ? "غابت" : "غاب",
    late: f ? "متأخّرة" : "متأخّر",
    wasLate: f ? "تأخّرت" : "تأخّر",
    excused: f ? "غائبة بعذر" : "غائب بعذر",
    passed: f ? "ناجحة" : "ناجح",
    struggling: f ? "متعثّرة" : "متعثّر",
    strugglingPlural: f ? "المتعثّرات" : "المتعثّرون",
    topStudents: f ? "المتفوقات" : "المتفوقون",
    guardian: "ولية / ولي الأمر",
    classmate: f ? "زميلة" : "زميل",
    helpClassmate: f ? "مساعدة زميلة" : "مساعدة زميل",
  } as const;
}

/** نصوص التطبيق — المعلّمة مؤنثة دائماً، لا تُقلب */
export const ar = {
  appName: "منصّة أبلة عفاف",
  tagline: "منصّة معلّمة العلوم — تعمل على جهازك، بلا إنترنت",
  subject: "العلوم",
  gradeLevel: "المستوى الخامس",

  common: {
    save: "احفظي",
    cancel: "إلغاء",
    confirm: "تأكيد",
    delete: "احذفي",
    edit: "عدّلي",
    open: "افتحي",
    print: "اطبعي",
    back: "رجوع",
    home: "الرئيسية",
    settings: "الإعدادات",
    loading: "لحظات…",
    class: "الفصل",
    classes: "الفصول",
    term1: "الفصل الدراسي الأول",
    term2: "الفصل الدراسي الثاني",
    average: "المتوسط",
    total: "المجموع",
    soon: "قريباً",
  },

  toast: {
    saved: "تم الحفظ ✓",
    done: "تم ✓",
    undo: "تراجع",
    demoCleared: "مُسحت البيانات التجريبية ✓",
    demoReseeded: "أُعيدت البيانات التجريبية ✓",
  },

  home: {
    title: "منصّة أبلة عفاف",
    welcome: "أهلاً بك يا أبلة عفاف 🌿",
    foundationReady: "الأساس جاهز — قاعدة البيانات تعمل على جهازك",
    summaryLine: (classes: string, students: string) => `الفصول: ${classes} · الطالبات: ${students}`,
    unitsLine: (units: string, lessons: string) => `الوحدات الدراسية: ${units} · الدروس الجاهزة: ${lessons}`,
    policyLine: "سياسة التقييم القطرية محفوظة وقابلة للتعديل من الإعدادات",
    nextStep: "الخطوة التالية: شاشات الفصول والطالبات (الأمر رقم ١)",
    sections: {
      classes: "الفصول",
      grades: "الدرجات",
      attendance: "الحضور",
      points: "النقاط",
      exams: "الاختبارات",
      certificates: "الشهادات",
      reports: "التقارير",
      settings: "الإعدادات",
    },
    emptyTitle: "لا توجد بيانات بعد",
    emptyAction: "أعيدي البيانات التجريبية للتجربة",
  },

  settings: {
    title: "الإعدادات",
    fontSize: "حجم الخط",
    fontSizeHint: "كبّري الخط ليناسب راحة عينيك — يُحفظ تلقائياً",
    fontSmaller: "أصغر",
    fontLarger: "أكبر",
    numerals: "شكل الأرقام في الجداول",
    numeralsWestern: "غربية (0123)",
    numeralsEastern: "عربية (٠١٢٣)",
    demoData: "البيانات التجريبية",
    demoDataHint: "بيانات للتجربة فقط — امسحيها متى شئتِ وستبقى بياناتك الحقيقية سليمة",
    clearDemo: "مسح البيانات التجريبية",
    reseedDemo: "إعادة البيانات التجريبية",
    confirmClearTitle: "هل تريدين مسح البيانات التجريبية؟",
    confirmClearBody: "سيُحذف كل ما هو تجريبي فقط (الفصول والطالبات والوحدات التجريبية). يمكنك إعادتها بضغطة واحدة.",
    school: "اسم المدرسة",
    workingOffline: "المنصّة تعمل بلا إنترنت — بياناتك على جهازك فقط 🔒",
  },

  errors: {
    generic: "حدث خطأ بسيط — أعيدي المحاولة، وإن تكرّر أخبري ابنك",
    gradeOutOfRange: (max: number) => `لم أستطع حفظ الدرجة — تأكّدي أن الرقم بين 0 و ${max}`,
  },

  a11y: {
    increaseFont: "تكبير الخط",
    decreaseFont: "تصغير الخط",
    mainNav: "التنقّل الرئيسي",
  },
} as const;
