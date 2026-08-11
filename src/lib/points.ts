/**
 * محرّك النقاط — دفتر قيود (§ التصميم):
 * الشهري = مجموع صفوف الشهر · التراكمي = مجموع الكل (لا تصفير مدمّر)
 * الرصيد القابل للصرف = التراكمي − المصروف في المتجر.
 * السقف الشهري والمستويات والقواعد كلها بيانات قابلة للتعديل.
 */
import { db } from "@/db";
import type { PointLevel, PointRule, Student } from "@/db/schema";

/** مفتاح الشهر 'YYYY-MM' لتاريخ ما */
export function monthKeyOf(dateMs: number): string {
  const d = new Date(dateMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** مفتاح أسبوع الدوام (الأحد بدايةً): 'YYYY-MM-DD' ليوم الأحد */
export function weekKeyOf(dateMs: number): string {
  const d = new Date(dateMs);
  const day = d.getDay(); // الأحد = 0
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
}

export interface AwardResult {
  ok: boolean;
  /** النقاط الممنوحة فعلاً (قد تُقص للسقف) */
  awarded: number;
  /** blocked_cap = السقف الشهري ممتلئ */
  reason?: "blocked_cap";
}

/** مجموع نقاط طالبة في شهر معيّن (الحيّة فقط) */
export async function monthlyPoints(studentId: number, monthKey: string): Promise<number> {
  const rows = await db.points.where("[studentId+monthKey]").equals([studentId, monthKey]).toArray();
  return rows.filter((p) => !p.deletedAt).reduce((s, p) => s + p.delta, 0);
}

/** الرصيد التراكمي (كل الأشهر) */
export async function cumulativePoints(studentId: number): Promise<number> {
  const rows = await db.points.where("studentId").equals(studentId).toArray();
  return rows.filter((p) => !p.deletedAt).reduce((s, p) => s + p.delta, 0);
}

/** المصروف في المتجر (الحي) */
export async function spentPoints(studentId: number): Promise<number> {
  const rows = await db.rewardRedemptions.where("studentId").equals(studentId).toArray();
  return rows.filter((r) => !r.deletedAt && r.status === "redeemed").reduce((s, r) => s + r.costPoints, 0);
}

/** الرصيد القابل للصرف = التراكمي − المصروف */
export async function spendableBalance(studentId: number): Promise<number> {
  return (await cumulativePoints(studentId)) - (await spentPoints(studentId));
}

/**
 * منح نقاط لطالبة وفق قاعدة، مع احترام السقف الشهري (بيانات من الإعدادات):
 * إن تجاوز المنح السقف يُقص للمساحة المتبقية، وإن امتلأ يُمنع.
 */
export async function awardPoints(
  student: Pick<Student, "id" | "classId">,
  rule: Pick<PointRule, "id" | "points" | "nameAr">,
  opts?: { reason?: string; source?: "auto" | "manual"; atMs?: number }
): Promise<AwardResult> {
  const atMs = opts?.atMs ?? Date.now();
  const mk = monthKeyOf(atMs);
  const settings = await db.settings.get(1);
  const cap = settings?.monthlyPointsCap;

  let toAward = rule.points;
  if (cap !== undefined && cap !== null) {
    const current = await monthlyPoints(student.id!, mk);
    const room = cap - current;
    if (room <= 0) return { ok: false, awarded: 0, reason: "blocked_cap" };
    toAward = Math.min(toAward, room);
  }

  await db.points.add({
    studentId: student.id!,
    classId: student.classId,
    delta: toAward,
    ruleId: rule.id,
    reason: opts?.reason ?? rule.nameAr,
    source: opts?.source ?? "manual",
    awardedAt: atMs,
    monthKey: mk,
    createdAt: atMs,
  });
  return { ok: true, awarded: toAward };
}

/** مستوى الطالبة من رصيدها التراكمي — الشرائح بيانات من الإعدادات */
export function levelOf(cumulative: number, levels: PointLevel[]): PointLevel | undefined {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let current: PointLevel | undefined;
  for (const lv of sorted) {
    if (cumulative >= lv.min && (lv.max === null || cumulative <= lv.max)) current = lv;
  }
  // إن جاوز كل الشرائح المحدودة، خذي الشريحة المفتوحة
  if (!current) current = sorted.find((lv) => lv.max === null && cumulative >= lv.min) ?? sorted[0];
  return current;
}

// ── الاحتسابات التلقائية ──────────────────────────────────────

/** قاعدة بمفتاح معيّن (الحيّة الفعّالة) */
async function ruleByKey(key: string): Promise<PointRule | undefined> {
  const rules = await db.pointRules.toArray();
  return rules.find((r) => r.key === key && r.active);
}

/**
 * احتساب «حضور أسبوع كامل» لفصلٍ عن أسبوع يومٍ معيّن:
 * تُمنح لمن حضرت كل أيام الأسبوع المسجّلة (٥ أيام على الأقل) بلا غياب
 * ولا تأخر. آمنة التكرار — لن تُمنح مرتين لنفس الأسبوع.
 */
export async function awardFullWeek(classId: number, anyDayMs: number): Promise<{ awarded: number; skipped: number }> {
  const rule = await ruleByKey("full_week");
  if (!rule) return { awarded: 0, skipped: 0 };
  const wk = weekKeyOf(anyDayMs);
  const marker = `أسبوع:${wk}`;

  const students = (await db.students.where("classId").equals(classId).toArray()).filter((s) => !s.deletedAt);
  let awarded = 0;
  let skipped = 0;

  for (const st of students) {
    // آمنة التكرار: قيد سابق بنفس علامة الأسبوع؟
    const prior = (await db.points.where("studentId").equals(st.id!).toArray()).some(
      (p) => !p.deletedAt && p.ruleId === rule.id && p.reason?.includes(marker)
    );
    if (prior) {
      skipped++;
      continue;
    }
    // سجل الأسبوع: من الأحد للخميس — نبني التاريخ من الأجزاء
    // (new Date("YYYY-MM-DD") تفسَّر UTC وتكسر المطابقة المحلية)
    const [wy, wm, wd] = wk.split("-").map(Number);
    const sunday = new Date(wy, wm - 1, wd).getTime();
    const days = await db.attendance.where("studentId").equals(st.id!).toArray();
    const weekDays = days.filter((a) => !a.deletedAt && a.date >= sunday && a.date < sunday + 5 * 86400000);
    const complete =
      weekDays.length >= 5 && weekDays.every((a) => a.status === "present");
    if (complete) {
      const r = await awardPoints(st, rule, {
        reason: `${rule.nameAr} (${marker})`,
        source: "auto",
        atMs: anyDayMs,
      });
      if (r.ok) awarded++;
    }
  }
  return { awarded, skipped };
}

/**
 * الاحتسابات التلقائية بعد اعتماد دفعة درجات:
 * «درجة 90%+» لكل من بلغتها في هذا المكوّن (مرة لكل مكوّن)،
 * و«تحسّن شخصي» لمن فاقت نسبتها نسبة رصدها السابق على نفس المكوّن.
 */
export async function awardAfterGradeBatch(batchId: number): Promise<{ grade90: number; improved: number }> {
  const rule90 = await ruleByKey("grade_90");
  const ruleImp = await ruleByKey("improvement");
  const grades = (await db.grades.where("batchId").equals(batchId).toArray()).filter((g) => !g.deletedAt);
  let grade90 = 0;
  let improved = 0;

  for (const g of grades) {
    const comp = await db.gradeComponents.get(g.gradeComponentId);
    if (!comp) continue;
    const student = await db.students.get(g.studentId);
    if (!student) continue;
    const pct = (g.mark / comp.maxMark) * 100;

    if (rule90 && pct >= 90) {
      const marker = `مكوّن:${comp.id}:90`;
      const prior = (await db.points.where("studentId").equals(g.studentId).toArray()).some(
        (p) => !p.deletedAt && p.ruleId === rule90.id && p.reason?.includes(marker)
      );
      if (!prior) {
        const r = await awardPoints(student, rule90, {
          reason: `${rule90.nameAr} — ${comp.nameAr} (${marker})`,
          source: "auto",
          atMs: g.createdAt,
        });
        if (r.ok) grade90++;
      }
    }

    if (ruleImp) {
      // آخر درجة سابقة (قبل هذه الدفعة) على نفس المكوّن
      const prev = (await db.grades.where("[studentId+gradeComponentId]").equals([g.studentId, g.gradeComponentId!]).toArray())
        .filter((x) => !x.deletedAt && x.batchId !== batchId && x.createdAt < g.createdAt)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (prev) {
        const prevPct = (prev.mark / comp.maxMark) * 100;
        if (pct > prevPct) {
          const marker = `تحسن:${comp.id}:${batchId}`;
          const prior = (await db.points.where("studentId").equals(g.studentId).toArray()).some(
            (p) => !p.deletedAt && p.ruleId === ruleImp.id && p.reason?.includes(marker)
          );
          if (!prior) {
            const r = await awardPoints(student, ruleImp, {
              reason: `${ruleImp.nameAr} — ${comp.nameAr} (${marker})`,
              source: "auto",
              atMs: g.createdAt,
            });
            if (r.ok) improved++;
          }
        }
      }
    }
  }
  return { grade90, improved };
}

// ── متجر المكافآت ─────────────────────────────────────────────

export interface RedeemResult {
  ok: boolean;
  reason?: "insufficient";
  balanceAfter?: number;
}

/** صرف مكافأة: يتحقق من الرصيد ويسجّل الصرف (خصم من التراكمي القابل للصرف) */
export async function redeemReward(studentId: number, rewardId: number): Promise<RedeemResult> {
  const reward = await db.rewards.get(rewardId);
  if (!reward) return { ok: false, reason: "insufficient" };
  const balance = await spendableBalance(studentId);
  if (balance < reward.costPoints) return { ok: false, reason: "insufficient" };
  const now = Date.now();
  await db.rewardRedemptions.add({
    studentId,
    rewardId,
    costPoints: reward.costPoints,
    redeemedAt: now,
    monthKey: monthKeyOf(now),
    status: "redeemed",
    createdAt: now,
  });
  return { ok: true, balanceAfter: balance - reward.costPoints };
}

// ── مكافآت الشهر المحسوبة ────────────────────────────────────

export interface MonthAwards {
  /** نجوم الشهر: أعلى ٣ نقاطاً هذا الشهر */
  stars: { student: Student; points: number }[];
  /** الأكثر تحسّناً: أعلى فرق نسبة درجات عن الشهر السابق */
  mostImproved?: { student: Student; delta: number };
  /** مجموعة الشهر: الفصل الأعلى متوسط نقاط لكل طالبة */
  topClass?: { classId: number; average: number };
  /** نجمات الالتزام: لا غياب ولا تأخر طوال الشهر */
  commitmentStars: Student[];
}

/** حساب مكافآت شهرٍ لفصل (أو لكل الفصول حين classId=0) */
export async function computeMonthAwards(monthKey: string, classId = 0): Promise<MonthAwards> {
  const allStudents = (await db.students.toArray()).filter(
    (s) => !s.deletedAt && (classId === 0 || s.classId === classId)
  );

  // نجوم الشهر
  const withPoints = await Promise.all(
    allStudents.map(async (student) => ({ student, points: await monthlyPoints(student.id!, monthKey) }))
  );
  const stars = withPoints
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // الأكثر تحسّناً: متوسط نسب درجات هذا الشهر مقابل السابق
  const [y, m] = monthKey.split("-").map(Number);
  const prevKey = monthKeyOf(new Date(y, m - 2, 15).getTime());
  let mostImproved: MonthAwards["mostImproved"];
  for (const student of allStudents) {
    const grades = (await db.grades.where("studentId").equals(student.id!).toArray()).filter((g) => !g.deletedAt);
    const avgOf = async (mk: string) => {
      const inMonth = grades.filter((g) => monthKeyOf(g.createdAt) === mk);
      if (inMonth.length === 0) return null;
      let sum = 0;
      let n = 0;
      for (const g of inMonth) {
        const comp = await db.gradeComponents.get(g.gradeComponentId);
        if (comp) {
          sum += (g.mark / comp.maxMark) * 100;
          n++;
        }
      }
      return n ? sum / n : null;
    };
    const cur = await avgOf(monthKey);
    const prev = await avgOf(prevKey);
    if (cur !== null && prev !== null) {
      const delta = cur - prev;
      if (delta > 0 && (!mostImproved || delta > mostImproved.delta)) {
        mostImproved = { student, delta: Math.round(delta * 10) / 10 };
      }
    }
  }

  // مجموعة الشهر: أعلى متوسط نقاط/طالبة بين الفصول
  const classes = (await db.classes.toArray()).filter((c) => !c.deletedAt);
  let topClass: MonthAwards["topClass"];
  for (const klass of classes) {
    const kids = (await db.students.where("classId").equals(klass.id!).toArray()).filter((s) => !s.deletedAt);
    if (kids.length === 0) continue;
    let sum = 0;
    for (const kid of kids) sum += await monthlyPoints(kid.id!, monthKey);
    const average = sum / kids.length;
    if (!topClass || average > topClass.average) topClass = { classId: klass.id!, average: Math.round(average * 10) / 10 };
  }

  // نجمات الالتزام: سجّلن حضوراً هذا الشهر بلا غياب ولا تأخر
  const commitmentStars: Student[] = [];
  for (const student of allStudents) {
    const days = (await db.attendance.where("studentId").equals(student.id!).toArray()).filter(
      (a) => !a.deletedAt && monthKeyOf(a.date) === monthKey
    );
    if (days.length > 0 && days.every((a) => a.status === "present" || a.status === "excused")) {
      if (days.some((a) => a.status === "present")) commitmentStars.push(student);
    }
  }

  return { stars, mostImproved, topClass, commitmentStars };
}
