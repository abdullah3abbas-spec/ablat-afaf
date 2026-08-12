/**
 * تحميل بيانات المنصّة المصدّرة والوصول إليها + حساب الدرجات.
 * تقرأ ملف JSON الذي تصدّره المعلّمة من «الإعدادات ← تصدير بيانات للمهارات».
 *
 * القاعدة الأمنية (§2-هـ): كل شيء محلي. المهارة تقرأ الملف على الجهاز
 * وتولّد المستند على الجهاز — لا اتصال بأي خدمة خارجية إطلاقاً.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { PROJECT_ROOT } from "./format.mjs";

const DEFAULT_GRADE_SCALE = [
  { min: 90, label: "امتياز" },
  { min: 80, label: "جيد جداً" },
  { min: 70, label: "جيد" },
  { min: 60, label: "مقبول" },
  { min: 50, label: "ضعيف" },
  { min: 0, label: "دون الحد" },
];

/** يبحث عن أحدث ملف بيانات في المواضع المعتادة */
function findDataFile() {
  const candidates = [];
  const dirs = [resolve(PROJECT_ROOT, "data"), PROJECT_ROOT, join(homedir(), "Downloads")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (/منصة-عفاف-بيانات.*\.json$/.test(f) || f === "منصة-عفاف-بيانات.json") {
        const full = join(dir, f);
        try {
          candidates.push({ full, mtime: statSync(full).mtimeMs });
        } catch {
          /* تجاهل */
        }
      }
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.full ?? null;
}

/**
 * يحمّل البيانات. يقبل مساراً صريحاً، وإلا يبحث تلقائياً.
 * يرمي رسالة عربية واضحة إن لم يجد الملف.
 */
export function loadData(explicitPath) {
  const path = explicitPath ?? findDataFile();
  if (!path) {
    throw new Error(
      "لم أجد ملف بيانات المنصّة. من التطبيق: الإعدادات ← «تصدير بيانات للمهارات» ← احفظي الملف داخل مجلد data في مجلد المنصّة."
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (raw.app !== "منصة-عفاف" || !raw.tables) {
    throw new Error(`الملف «${path}» ليس ملف بيانات صالحاً للمنصّة.`);
  }
  return new AppData(raw, path);
}

/** واجهة وصول مريحة فوق الجداول المصدّرة */
export class AppData {
  constructor(raw, path) {
    this.raw = raw;
    this.path = path;
    this.t = raw.tables;
  }

  table(name) {
    return this.t[name] ?? [];
  }

  settings() {
    return this.table("settings")[0] ?? {};
  }

  schoolName() {
    return this.settings().schoolName || "مدرستي";
  }

  /** شكل أرقام الجداول/الدرجات (غربية افتراضياً) */
  numeralsTable() {
    return this.settings().numeralsTable ?? "western";
  }

  /** شكل أرقام الشهادات/المستندات الرسمية (شرقية افتراضياً) */
  numeralsCert() {
    return this.settings().numeralsCert ?? "eastern";
  }

  currentYear() {
    const years = this.table("academicYears");
    return years.find((y) => y.isCurrent) ?? years[0] ?? { id: 1, name: "" };
  }

  subject() {
    return this.table("subjects")[0] ?? { nameAr: "العلوم", grade: 5 };
  }

  gradeName() {
    const g = this.subject().grade ?? 5;
    const names = { 5: "الخامس", 6: "السادس", 7: "السابع", 8: "الثامن", 9: "التاسع" };
    return `المستوى ${names[g] ?? g}`;
  }

  activeClasses() {
    return this.table("classes")
      .filter((c) => !c.deletedAt)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
  }

  /** يطابق فصلاً بالاسم (تطابق جزئي) أو بالمعرّف؛ وإلا أول فصل */
  resolveClass(nameOrId) {
    const classes = this.activeClasses();
    if (nameOrId == null) return classes[0] ?? null;
    if (typeof nameOrId === "number") return classes.find((c) => c.id === nameOrId) ?? null;
    const q = String(nameOrId).trim();
    return (
      classes.find((c) => c.name === q) ??
      classes.find((c) => c.name.includes(q) || q.includes(c.name)) ??
      null
    );
  }

  studentsOf(classId) {
    return this.table("students")
      .filter((s) => !s.deletedAt && s.classId === classId)
      .sort((a, b) => a.rollNumber - b.rollNumber);
  }

  student(id) {
    return this.table("students").find((s) => s.id === id) ?? null;
  }

  /** يطابق طالبة بالاسم داخل فصل (أو في كل الفصول) */
  resolveStudent(name, classId) {
    const q = String(name).trim();
    const pool = this.table("students").filter((s) => !s.deletedAt && (classId == null || s.classId === classId));
    return pool.find((s) => s.name === q) ?? pool.find((s) => s.name.includes(q)) ?? null;
  }

  units() {
    return this.table("units")
      .filter((u) => !u.deletedAt)
      .sort((a, b) => a.order - b.order);
  }

  resolveUnits(spec) {
    const units = this.units();
    if (!spec || spec === "all" || spec === "الكل") return units;
    const wanted = Array.isArray(spec) ? spec : [spec];
    const out = [];
    for (const w of wanted) {
      if (typeof w === "number") {
        const u = units.find((x) => x.id === w);
        if (u) out.push(u);
      } else {
        const q = String(w).trim();
        const u = units.find((x) => x.title === q) ?? units.find((x) => x.title.includes(q) || q.includes(x.title));
        if (u) out.push(u);
      }
    }
    return out.length ? out : units;
  }

  lessonsOf(unitId) {
    return this.table("lessons")
      .filter((l) => !l.deletedAt && l.unitId === unitId)
      .sort((a, b) => a.order - b.order);
  }

  resolveLesson(name) {
    const q = String(name).trim();
    const lessons = this.table("lessons").filter((l) => !l.deletedAt);
    return lessons.find((l) => l.title === q) ?? lessons.find((l) => l.title.includes(q) || q.includes(l.title)) ?? null;
  }

  questionsOfUnits(unitIds) {
    const set = new Set(unitIds);
    return this.table("questions").filter((q) => !q.deletedAt && set.has(q.unitId));
  }

  policy() {
    const pols = this.table("assessmentPolicy");
    return pols.find((p) => p.isActive) ?? pols[0] ?? null;
  }

  gradeScale() {
    return this.policy()?.gradeScale ?? DEFAULT_GRADE_SCALE;
  }

  /** مكوّنات الدرجات المجسّدة لفصل دراسي (term) */
  gradeComponents(term) {
    return this.table("gradeComponents").filter((c) => c.term === term);
  }

  gradesOf(studentId, term) {
    return this.table("grades").filter((g) => !g.deletedAt && g.studentId === studentId && g.term === term);
  }

  parentContactsOf(studentId) {
    return this.table("parentContacts")
      .filter((p) => !p.deletedAt && p.studentId === studentId)
      .sort((a, b) => b.date - a.date);
  }

  pointsOf(studentId) {
    return this.table("points").filter((p) => !p.deletedAt && p.studentId === studentId);
  }

  cumulativePoints(studentId) {
    return this.pointsOf(studentId).reduce((s, p) => s + (p.points ?? 0), 0);
  }

  monthlyPoints(studentId, monthKey) {
    return this.pointsOf(studentId)
      .filter((p) => monthKeyOf(p.createdAt) === monthKey)
      .reduce((s, p) => s + (p.points ?? 0), 0);
  }

  /** المستوى التحفيزي من نقاطها التراكمية (شرائح من الإعدادات) */
  levelOf(cumulative) {
    return levelOf(cumulative, this.settings().pointLevels ?? []);
  }

  attendanceSummary(studentId, monthKey) {
    const att = this.table("attendance").filter(
      (a) => !a.deletedAt && a.studentId === studentId && (monthKey == null || monthKeyOf(a.date) === monthKey)
    );
    const count = (x) => att.filter((a) => a.status === x).length;
    return { present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused") };
  }
}

/** مفتاح الشهر YYYY-MM */
export function monthKeyOf(dateMs) {
  const d = new Date(dateMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** المستوى التحفيزي من قائمة الشرائح (منقول من points.ts) */
export function levelOf(cumulative, levels) {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let current;
  for (const lv of sorted) if (cumulative >= lv.min && (lv.max === null || cumulative <= lv.max)) current = lv;
  if (!current) current = sorted.find((lv) => lv.max === null && cumulative >= lv.min) ?? sorted[0];
  return current;
}

/** توصيات آلية بصيغة مؤنثة — منقولة من reportData.ts */
export function buildRecommendations({ pct, absent, late, weakest, monthlyPoints }) {
  const recs = [];
  if (pct !== null && pct !== undefined) {
    if (pct >= 90) recs.push("أداء ممتاز — نقترح إثراءها بمهام قيادية في التجارب والأنشطة");
    else if (pct >= 70) recs.push("مستوى جيد — المواظبة على المراجعة المنزلية القصيرة تصعد بها للامتياز");
    else if (pct >= 50) recs.push("تحتاج دعماً منتظماً — نوصي بمراجعة يومية قصيرة ومتابعة الواجبات");
    else recs.push("تحتاج خطة دعم عاجلة — نرجو التواصل مع المعلّمة لوضع خطة مشتركة");
  }
  if (weakest && weakest.pct < 60) recs.push(`أكثر ما يحتاج التركيز: ${weakest.name} — نقترح تدريبات إضافية فيه`);
  if (absent >= 3) recs.push(`تكرر الغياب (${absent} مرات هذا الشهر) — انتظامها يحسّن تحصيلها مباشرة`);
  else if (absent === 0 && late === 0) recs.push("انتظام كامل في الحضور هذا الشهر — نشكر تعاونكم");
  if (monthlyPoints >= 30) recs.push("مشاركة صفية مميزة تستحق الثناء في البيت");
  return recs;
}

// ── حساب الدرجات — منقول حرفياً من src/lib (نفس المعادلات المختبَرة) ──

/** المكوّنات الورقية (الأوراق النهائية بلا أبناء) مرتبة */
export function leafComponents(all) {
  const parents = new Set(all.map((c) => c.parentKey).filter(Boolean));
  return all.filter((c) => !parents.has(c.key)).sort((a, b) => a.order - b.order);
}

/** مجموع الفصل: يأخذ أحدث درجة لكل مكوّن ورقي */
export function termTotal(grades, leaves) {
  let total = 0,
    counted = 0,
    outOf = 0,
    countedOutOf = 0;
  for (const comp of leaves) {
    outOf += comp.maxMark;
    const live = grades
      .filter((g) => !g.deletedAt && g.gradeComponentId === comp.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (live.length > 0) {
      total += live[0].mark;
      counted++;
      countedOutOf += comp.maxMark;
    }
  }
  return { total, counted, outOf, countedOutOf };
}

/** النسبة المئوية من درجة عظمى — تُقرَّب لمنزلة واحدة */
export function percentOf(total, outOf) {
  if (outOf <= 0) return 0;
  return Math.round((total / outOf) * 1000) / 10;
}

/** التقدير من شرائح السياسة (بيانات §4) */
export function gradeLabel(percent, scale) {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const band of sorted) if (percent >= band.min) return band.label;
  return sorted[sorted.length - 1]?.label ?? "";
}
