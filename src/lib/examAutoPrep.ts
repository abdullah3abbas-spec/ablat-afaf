/**
 * تجهيز الاختبار تلقائياً قبل موعده بأسبوعين (§2-د):
 * المعلّمة تسجّل مواعيد الاختبارات مرة (الإعدادات ← مواعيد الاختبارات)،
 * وقبل الموعد بأسبوعين يبني النظام مسودة كاملة بأسئلتها من البنك —
 * الدرجة الكلية من مكوّن السياسة (بيانات لا كود §4)، والتوزيع المعرفي
 * من افتراضي السياسة — وتظهر في الرئيسية: «جاهز، راجعيه فقط».
 * آمن التكرار: اختبار موجود لنفس (النوع، الموعد) — ولو حذفته ناعماً —
 * لا يُبنى مرة أخرى خلف ظهرها.
 */
import { db } from "@/db";
import type { Exam, Term } from "@/db/schema";
import { autoPick, defaultUnitPct } from "@/lib/examBuilder";
import { ensureGradeComponents, leafComponents } from "@/lib/gradeComponents";

export const PREP_AHEAD_MS = 14 * 24 * 60 * 60 * 1000;

/** المدة الافتراضية للمسودة (دقيقة) — ليست رقم سياسة؛ تعدّلها المعلّمة عند المراجعة */
const DEFAULT_DURATION_MIN = 45;

export interface DuePrep {
  typeKey: string;
  dateMs: number;
}

/**
 * أي المواعيد دخلت نافذة الأسبوعين ولم يُبنَ لها اختبار بعد؟ — دالة نقية.
 * اختبار (حي أو محذوف ناعماً) لنفس النوع والموعد يُحتسب مبنياً.
 */
export function dueForPrep(
  examDates: Record<string, number> | undefined,
  existing: Pick<Exam, "typeKey" | "scheduledFor">[],
  nowMs: number
): DuePrep[] {
  if (!examDates) return [];
  const out: DuePrep[] = [];
  for (const [typeKey, dateMs] of Object.entries(examDates)) {
    if (!dateMs || nowMs < dateMs - PREP_AHEAD_MS || nowMs > dateMs) continue;
    if (existing.some((e) => e.typeKey === typeKey && e.scheduledFor === dateMs)) continue;
    out.push({ typeKey, dateMs });
  }
  return out;
}

/** يبني مسودّات الاختبارات المستحقة — يُستدعى عند كل إقلاع. يعيد ما بُني. */
export async function ensureScheduledExams(nowMs: number = Date.now()): Promise<string[]> {
  const settings = await db.settings.get(1);
  const existing = await db.exams.toArray();
  const due = dueForPrep(settings?.examDates, existing, nowMs);
  if (due.length === 0) return [];

  const policy = (await db.assessmentPolicy.toArray()).find((p) => p.isActive);
  const year = (await db.academicYears.toArray()).find((y) => y.isCurrent);
  if (!policy || !year?.id) return [];
  const term = (settings?.currentTerm ?? 1) as Term;

  // وحدات المنهج الحقيقي التي لها أسئلة حية في البنك
  const liveQuestions = (await db.questions.toArray()).filter((q) => !q.deletedAt);
  const unitIdsWithBank = new Set(liveQuestions.map((q) => q.unitId));
  const units = (await db.units.toArray()).filter((u) => !u.deletedAt && !u.isDemo && unitIdsWithBank.has(u.id!));
  if (units.length === 0) return [];
  const unitIds = units.map((u) => u.id!);

  // تُنشأ مكوّنات الدرجات من السياسة إن لم تكن قد أُنشئت بعد (كسولة الإنشاء)
  const comps = leafComponents(await ensureGradeComponents(year.id, term));

  const built: string[] = [];
  for (const d of due) {
    const typeDef = policy.examTypes.find((t) => t.key === d.typeKey);
    if (!typeDef) continue;
    const comp = typeDef.carryToComponentKey ? comps.find((c) => c.key === typeDef.carryToComponentKey) : undefined;
    const totalMarks = comp?.maxMark;
    if (!totalMarks) continue; // لا درجة في السياسة — لا نخترع رقماً (§4)

    const cognitivePct = policy.cognitiveDefault;
    const unitPct = defaultUnitPct(units, unitIds);
    const r = await autoPick({ unitIds, totalMarks, durationMinutes: DEFAULT_DURATION_MIN, cognitivePct, unitPct, nowMs });
    if (r.picked.length === 0) continue;

    const record: Exam = {
      title: `${typeDef.nameAr} — ${new Date(d.dateMs).toLocaleDateString("ar", { day: "numeric", month: "long" })}`,
      typeKey: d.typeKey,
      academicYearId: year.id,
      term,
      unitIds,
      totalMarks,
      durationMinutes: DEFAULT_DURATION_MIN,
      cognitiveDistribution: cognitivePct,
      status: "draft",
      scheduledFor: d.dateMs,
      carryToComponentId: comp?.id,
      createdAt: nowMs,
    };
    const examId = (await db.exams.add(record)) as number;
    await db.examQuestions.bulkAdd(r.picked.map((q, i) => ({ examId, questionId: q.id!, order: i + 1, marks: q.marks })));
    built.push(d.typeKey);
  }
  return built;
}

/** الاختبارات القادمة خلال أسبوعين — لتنبيه الرئيسية «جاهز، راجعيه فقط» */
export async function upcomingScheduledExams(nowMs: number = Date.now()): Promise<Exam[]> {
  return (await db.exams.toArray())
    .filter(
      (e) =>
        !e.deletedAt &&
        e.status !== "administered" &&
        e.scheduledFor != null &&
        e.scheduledFor >= nowMs - 86400000 &&
        e.scheduledFor <= nowMs + PREP_AHEAD_MS
    )
    .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));
}
