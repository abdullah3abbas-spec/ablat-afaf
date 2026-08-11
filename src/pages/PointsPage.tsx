/**
 * النقاط والمكافآت: لوحة الصدارة (+ نسخة السبورة)، منح سريع أثناء
 * الحصة، مكافآت الشهر المحسوبة، متجر المكافآت، ومحرّر القواعد والسقف.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Crown, Gift, ListChecks, MonitorPlay, Plus, Sparkles, Star, Trash2, Trophy, Zap } from "lucide-react";
import { db } from "@/db";
import type { PointRule, Student } from "@/db/schema";
import { activeStudentsOf } from "@/lib/students";
import {
  awardPoints,
  computeMonthAwards,
  cumulativePoints,
  levelOf,
  monthKeyOf,
  monthlyPoints,
  redeemReward,
  spendableBalance,
} from "@/lib/points";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

export default function PointsPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const setCurrentClass = useUi((x) => x.setCurrentClass);
  const show = useToast((x) => x.show);

  const [classId, setClassId] = useState(0);
  const [activeRuleId, setActiveRuleId] = useState(0);
  const [awardTick, setAwardTick] = useState(0);

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  const classes = useLiveQuery(async () =>
    (await db.classes.toArray()).filter((c) => !c.deletedAt).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const rules = useLiveQuery(async () => (await db.pointRules.toArray()).filter((r) => r.active));

  const board = useLiveQuery(async () => {
    if (!classId) return [];
    setCurrentClass(classId);
    const settings = await db.settings.get(1);
    const levels = settings?.pointLevels ?? [];
    const students = (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber);
    const mk = monthKeyOf(Date.now());
    const rows = await Promise.all(
      students.map(async (student) => {
        const monthly = await monthlyPoints(student.id!, mk);
        const cumulative = await cumulativePoints(student.id!);
        return { student, monthly, cumulative, level: levelOf(cumulative, levels) };
      })
    );
    return rows.sort((a, b) => b.monthly - a.monthly || b.cumulative - a.cumulative);
  }, [classId, awardTick]);

  const monthAwards = useLiveQuery(
    async () => (classId ? computeMonthAwards(monthKeyOf(Date.now()), classId) : undefined),
    [classId, awardTick]
  );

  async function quickAward(student: Student) {
    const rule = rules?.find((r) => r.id === activeRuleId);
    if (!rule) return;
    const r = await awardPoints(student, rule);
    if (r.ok) {
      show(s.points.awarded(student.name, fmtNum(r.awarded, numerals)));
    } else {
      show(s.points.capBlocked(student.name), { kind: "info" });
    }
    setAwardTick((t) => t + 1);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Star className="size-7" aria-hidden />
          {s.points.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.points.subtitle}</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">{s.grades.pickClass}:</span>
          <select
            value={classId}
            onChange={(e) => setClassId(Number(e.target.value))}
            className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal"
          >
            <option value={0}>—</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Link to={`/points/board?class=${classId}`} className="btn bg-maroon text-white hover:bg-maroon-dark">
          <MonitorPlay className="size-5" aria-hidden />
          {s.points.boardMode}
        </Link>
      </div>

      {/* المنح السريع أثناء الحصة */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Zap className="size-6 text-teal-dark" aria-hidden />
          {s.points.quickAward}
        </h2>
        <p className="text-sm text-ink-soft">{s.points.quickAwardHint}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={s.points.rules}>
          {rules?.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRuleId(r.id!)}
              aria-pressed={activeRuleId === r.id}
              className={
                "btn px-4 " +
                (activeRuleId === r.id ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")
              }
            >
              {r.nameAr} (+{fmtNum(r.points, numerals)})
            </button>
          ))}
        </div>
        {activeRuleId > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {board?.map(({ student }) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => void quickAward(student)}
                  className="btn w-full border-2 border-line bg-white text-ink hover:border-teal hover:bg-teal-bg"
                >
                  {student.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* لوحة الصدارة */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Trophy className="size-6 text-gold-dark" aria-hidden />
          {s.points.leaderboard}
        </h2>
        {!board || board.length === 0 || board.every((b) => b.monthly === 0 && b.cumulative === 0) ? (
          <EmptyState icon={Trophy} title={s.points.noneYet} />
        ) : (
          <ul className="divide-y divide-line">
            {board.map((row, i) => (
              <li key={row.student.id} className="flex flex-wrap items-center gap-3 py-2">
                <span
                  className={
                    "flex size-9 shrink-0 items-center justify-center rounded-pill font-bold tabular-nums " +
                    (i === 0
                      ? "bg-gold text-white"
                      : i === 1
                        ? "bg-gold-bg text-gold-dark"
                        : i === 2
                          ? "bg-teal-bg text-teal-dark"
                          : "bg-cream text-ink-soft")
                  }
                >
                  {fmtNum(i + 1, numerals)}
                </span>
                <span className="me-auto font-medium">{row.student.name}</span>
                {row.level && (
                  <span className="rounded-pill bg-teal-bg px-3 py-1 text-sm font-medium text-teal-dark">
                    {row.level.nameAr}
                  </span>
                )}
                <span className="min-w-20 text-center">
                  <span className="block text-lg font-bold tabular-nums">{fmtNum(row.monthly, numerals)}</span>
                  <span className="text-xs text-ink-soft">{s.points.monthly}</span>
                </span>
                <span className="min-w-20 text-center">
                  <span className="block text-lg font-bold tabular-nums">{fmtNum(row.cumulative, numerals)}</span>
                  <span className="text-xs text-ink-soft">{s.points.cumulative}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* مكافآت الشهر */}
      {monthAwards && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <Crown className="size-6 text-gold-dark" aria-hidden />
            {s.points.monthAwards}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-card bg-gold-bg p-4">
              <p className="font-bold text-gold-dark">⭐ {s.points.stars}</p>
              {monthAwards.stars.length === 0 ? (
                <p className="text-ink-soft">{s.gradebook.emptyCell}</p>
              ) : (
                monthAwards.stars.map((st, i) => (
                  <p key={st.student.id}>
                    {fmtNum(i + 1, numerals)}. {st.student.name} ({fmtNum(st.points, numerals)})
                  </p>
                ))
              )}
            </div>
            <div className="rounded-card bg-teal-bg p-4">
              <p className="font-bold text-teal-dark">📈 {s.points.mostImproved}</p>
              {monthAwards.mostImproved ? (
                <p>
                  {monthAwards.mostImproved.student.name} —{" "}
                  {s.points.improvedBy(fmtNum(monthAwards.mostImproved.delta, numerals))}
                </p>
              ) : (
                <p className="text-ink-soft">{s.gradebook.emptyCell}</p>
              )}
            </div>
            <div className="rounded-card bg-cream p-4">
              <p className="font-bold">🏫 {s.points.topClass}</p>
              {monthAwards.topClass ? (
                <p>
                  {s.points.topClassLine(
                    classes?.find((c) => c.id === monthAwards.topClass!.classId)?.name ?? "",
                    fmtNum(monthAwards.topClass.average, numerals)
                  )}
                </p>
              ) : (
                <p className="text-ink-soft">{s.gradebook.emptyCell}</p>
              )}
            </div>
            <div className="rounded-card bg-teal-bg p-4">
              <p className="font-bold text-teal-dark">🎖 {s.points.commitment}</p>
              <p className="text-xs text-ink-soft">{s.points.commitmentHint}</p>
              {monthAwards.commitmentStars.length === 0 ? (
                <p className="text-ink-soft">{s.gradebook.emptyCell}</p>
              ) : (
                <p>{monthAwards.commitmentStars.map((st) => st.name).join("، ")}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <RewardsStore classId={classId} onChanged={() => setAwardTick((t) => t + 1)} />
      <RulesEditor />
    </div>
  );
}

/** متجر المكافآت مع سجل صرف يخصم من الرصيد */
function RewardsStore({ classId, onChanged }: { classId: number; onChanged: () => void }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);
  const [studentId, setStudentId] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);

  const students = useLiveQuery(
    async () => (classId ? (await activeStudentsOf(classId)).sort((a, b) => a.rollNumber - b.rollNumber) : []),
    [classId]
  );
  const rewards = useLiveQuery(async () => (await db.rewards.toArray()).filter((r) => r.active && !r.deletedAt));

  useEffect(() => {
    if (studentId) {
      void spendableBalance(studentId).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [studentId]);

  async function handleRedeem(rewardId: number) {
    const student = students?.find((st) => st.id === studentId);
    const reward = rewards?.find((r) => r.id === rewardId);
    if (!student || !reward) return;
    const r = await redeemReward(studentId, rewardId);
    if (r.ok) {
      show(s.points.redeemed(student.name, reward.nameAr));
      setBalance(r.balanceAfter ?? null);
      onChanged();
    } else {
      show(s.points.insufficient(student.name), { kind: "danger" });
    }
  }

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <Gift className="size-6 text-maroon" aria-hidden />
        {s.points.store}
      </h2>
      <p className="text-sm text-ink-soft">{s.points.storeHint}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span>{s.points.pickStudent}:</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(Number(e.target.value))}
            className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal"
          >
            <option value={0}>—</option>
            {students?.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </label>
        {balance !== null && (
          <span className="rounded-pill bg-teal-bg px-4 py-2 font-bold text-teal-dark">
            {s.points.balance}: {fmtNum(balance, numerals)}
          </span>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards?.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-card border border-line p-3">
            <div className="me-auto">
              <p className="font-medium">{r.nameAr}</p>
              <p className="text-sm text-ink-soft">{fmtNum(r.costPoints, numerals)} {s.points.monthly.replace(s.points.monthly, "نقطة")}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRedeem(r.id!)}
              disabled={!studentId || (balance !== null && balance < r.costPoints)}
              className="btn-secondary px-4 disabled:opacity-40"
            >
              {s.points.redeem}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** محرّر قواعد النقاط والسقف الشهري */
function RulesEditor() {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [deleting, setDeleting] = useState<PointRule | null>(null);

  const rules = useLiveQuery(async () => (await db.pointRules.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
  const settings = useLiveQuery(() => db.settings.get(1));

  async function updateRule(id: number, patch: Partial<PointRule>) {
    await db.pointRules.update(id, { ...patch, updatedAt: Date.now() });
  }

  async function addRule() {
    await db.pointRules.add({ key: `custom_${Date.now()}`, nameAr: "", points: 1, active: true, createdAt: Date.now() });
  }

  async function removeRule() {
    if (!deleting) return;
    await db.pointRules.delete(deleting.id!);
    setDeleting(null);
    show(s.toast.done);
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
          <ListChecks className="size-6 text-teal-dark" aria-hidden />
          {s.points.rules}
        </h2>
        <button type="button" onClick={() => void addRule()} className="btn-secondary px-4">
          <Plus className="size-5" aria-hidden />
          {s.points.addRule}
        </button>
      </div>
      <p className="text-sm text-ink-soft">{s.points.rulesHint}</p>

      <label className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{s.points.monthlyCap}:</span>
        <input
          type="number"
          min={0}
          value={settings?.monthlyPointsCap ?? 0}
          onChange={(e) => void db.settings.update(1, { monthlyPointsCap: Number(e.target.value) })}
          className="min-h-touch w-24 rounded-card border-2 border-line px-3 text-center font-bold tabular-nums focus:border-teal"
        />
        <span className="text-sm text-ink-soft">{s.points.monthlyCapHint}</span>
      </label>

      <ul className="space-y-2">
        {rules?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line p-2">
            <input
              type="text"
              defaultValue={r.nameAr}
              aria-label={s.points.ruleName}
              placeholder={s.points.ruleName}
              onBlur={(e) => void updateRule(r.id!, { nameAr: e.target.value.trim() })}
              className="min-h-touch flex-1 rounded-card border-2 border-line px-3 focus:border-teal"
            />
            <label className="flex items-center gap-1">
              <span className="text-sm text-ink-soft">{s.points.rulePoints}:</span>
              <input
                type="number"
                min={0}
                defaultValue={r.points}
                aria-label={`${r.nameAr} — ${s.points.rulePoints}`}
                onBlur={(e) => void updateRule(r.id!, { points: Number(e.target.value) })}
                className="min-h-touch w-20 rounded-card border-2 border-line px-2 text-center font-bold tabular-nums focus:border-teal"
              />
            </label>
            {r.autoTrigger && (
              <span className="rounded-pill bg-gold-bg px-2 text-sm text-gold-dark">
                <Sparkles className="me-1 inline size-4" aria-hidden />
                {s.points.autoBadge}
              </span>
            )}
            <label className="flex min-h-touch items-center gap-1">
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => void updateRule(r.id!, { active: e.target.checked })}
                className="size-5 accent-teal"
              />
              <span className="text-sm">{s.points.ruleActive}</span>
            </label>
            <button
              type="button"
              onClick={() => setDeleting(r)}
              aria-label={`${s.points.deleteRule}: ${r.nameAr}`}
              className="flex min-h-touch min-w-touch items-center justify-center rounded-card text-danger hover:bg-danger-bg"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {deleting && (
        <ConfirmDialog
          title={s.points.deleteRule}
          body={s.points.confirmDeleteRule(deleting.nameAr)}
          confirmLabel={s.points.deleteRule}
          onConfirm={() => void removeRule()}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
