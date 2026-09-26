/**
 * تذكيرات «سابقة بخطوة» الموسمية (§2-د) — دالة نقية قابلة للاختبار:
 * الأحد: حزمة الأسبوع وقائمة التجهيز · الخميس: لوحة الشرف ·
 * آخر الشهر: تقارير أولياء الأمور · أغسطس: مراجعة سياسة التقييم.
 * كلها تُعرض في «تحتاج انتباهك» بالرئيسية — لا تنتظر أن تُطلب.
 */

export interface SeasonalReminder {
  key: "sunday" | "thursday" | "monthEnd" | "august";
  message: string;
  /** وجهة الضغطة — فارغة إن كان الإجراء في الشاشة نفسها */
  to: string;
}

export function seasonalReminders(now: number): SeasonalReminder[] {
  const d = new Date(now);
  const out: SeasonalReminder[] = [];
  const day = d.getDay(); // 0 الأحد … 4 الخميس
  const month = d.getMonth(); // 7 = أغسطس
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - d.getDate();

  if (day === 0)
    out.push({ key: "sunday", message: "اليوم الأحد 🌞 — اطبعي حزمة الأسبوع وقائمة التجهيز من الزرّين أعلاه، وكل شيء جاهز قبل أول حصة", to: "" });
  if (day === 4)
    out.push({ key: "thursday", message: "اليوم الخميس ⭐ — لوحة شرف الأسبوع جاهزة: اعرضيها على الطالبات أو اطبعيها", to: "/points/board" });
  if (daysLeft <= 2)
    out.push({ key: "monthEnd", message: "آخر الشهر 📋 — تقارير أولياء الأمور جاهزة للطباعة والإرسال مع الطالبات", to: "/reports" });
  if (month === 7)
    out.push({ key: "august", message: "تنبيه أغسطس ⚠ — عام دراسي جديد: هل تغيّرت سياسة التقييم؟ راجعي الأرقام قبل أول رصد", to: "/settings/policy" });

  return out;
}
