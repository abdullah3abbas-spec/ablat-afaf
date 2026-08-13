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
        // القيم الفعلية في src/index.css ‏(:root) — توكِنات قابلة للتخصيص
        // لهوية مدرسة زكريت لاحقاً دون إعادة بناء الصفحات (المرحلة ١)
        // العنّابي القطري — لون الهوية والشريط العلوي (deep لعمق التدرجات)
        maroon: {
          DEFAULT: "rgb(var(--c-maroon) / <alpha-value>)",
          dark: "rgb(var(--c-maroon-dark) / <alpha-value>)",
          deep: "rgb(var(--c-maroon-deep) / <alpha-value>)",
        },
        // التركوازي — لون الإجراء الأساسي
        teal: {
          DEFAULT: "rgb(var(--c-teal) / <alpha-value>)",
          dark: "rgb(var(--c-teal-dark) / <alpha-value>)",
          bg: "rgb(var(--c-teal-bg) / <alpha-value>)",
        },
        // الذهبي — لون التنبيه والانتباه (dark للنص على الخلفية الذهبية — تباين AA)
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          dark: "rgb(var(--c-gold-dark) / <alpha-value>)",
          bg: "rgb(var(--c-gold-bg) / <alpha-value>)",
        },
        // خلفية الصفحات
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        // خطوط الفصل والحدود
        line: "rgb(var(--c-line) / <alpha-value>)",
        // نص أساسي وثانوي
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", soft: "rgb(var(--c-ink-soft) / <alpha-value>)" },
        // ألوان الحالات (لا نعتمد على اللون وحده — دائماً مع نص ورمز §6)
        ok: "rgb(var(--c-ok) / <alpha-value>)",
        danger: { DEFAULT: "rgb(var(--c-danger) / <alpha-value>)", bg: "rgb(var(--c-danger-bg) / <alpha-value>)" },
      },
      borderRadius: { card: "16px", pill: "999px" },
      // الحد الأدنى لارتفاع الأزرار والحقول (§6)
      minHeight: { touch: "48px" },
      minWidth: { touch: "48px" },
      boxShadow: {
        // ظلال دافئة بصبغة العنّابي — عمق ورقي لا رمادي
        card: "0 1px 2px rgba(74,9,29,.05), 0 4px 14px rgba(74,9,29,.07)",
        lift: "0 2px 4px rgba(74,9,29,.1), 0 10px 28px rgba(74,9,29,.16)",
        bar: "0 2px 14px rgba(74,9,29,.22)",
        nav: "0 -3px 18px rgba(74,9,29,.12)",
      },
    },
  },
  plugins: [],
};
