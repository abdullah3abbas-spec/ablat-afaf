/** @type {import('tailwindcss').Config} */
// لوحة الألوان مستخرجة من نماذج الشاشات في مواصفات/ — هوية المشروع المعتمدة
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // الواجهة العامة
        sans: ["Tajawal", "Segoe UI", "Tahoma", "sans-serif"],
        // العناوين
        heading: ["Cairo", "Tajawal", "sans-serif"],
        // الشهادات والاختبارات الرسمية
        amiri: ["Amiri", "serif"],
      },
      colors: {
        // العنّابي القطري — لون الهوية والشريط العلوي
        maroon: { DEFAULT: "#8A1538", dark: "#5E0E26" },
        // التركوازي — لون الإجراء الأساسي
        teal: { DEFAULT: "#0F6B62", dark: "#0B534C", bg: "#E6F2F0" },
        // الذهبي — لون التنبيه والانتباه
        gold: { DEFAULT: "#C08A2E", bg: "#FCF3E2" },
        // خلفية الصفحات
        cream: "#FBF8F3",
        // خطوط الفصل والحدود
        line: "#E6DFD4",
        // نص أساسي وثانوي
        ink: { DEFAULT: "#1E2430", soft: "#4A5568" },
        // ألوان الحالات (لا نعتمد على اللون وحده — دائماً مع نص ورمز §6)
        ok: "#2E7D4F",
        danger: { DEFAULT: "#B3261E", bg: "#FDECEA" },
      },
      borderRadius: { card: "16px", pill: "999px" },
      // الحد الأدنى لارتفاع الأزرار والحقول (§6)
      minHeight: { touch: "48px" },
      minWidth: { touch: "48px" },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.05)",
        bar: "0 2px 10px rgba(0,0,0,.18)",
      },
    },
  },
  plugins: [],
};
