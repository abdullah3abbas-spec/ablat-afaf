/** شريط أوسمة الطالبة + منح وسام — تظهر في ملفها وعلى شهادتها (§ الأمر ٧) */
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Award, Plus } from "lucide-react";
import { db } from "@/db";
import { awardBadge, removeBadge } from "@/lib/funTools";
import { useStrings } from "@/hooks/useStrings";
import { useToast } from "@/store/toast";

export default function StudentBadges({ studentId }: { studentId: number }) {
  const s = useStrings();
  const show = useToast((x) => x.show);
  const [adding, setAdding] = useState(false);

  const student = useLiveQuery(() => db.students.get(studentId), [studentId]);
  const badges = useLiveQuery(async () => db.badges.toArray());

  if (!student || !badges) return null;
  const earned = student.earnedBadges ?? [];
  const byId = new Map(badges.map((b) => [b.id!, b]));

  async function give(badgeId: number) {
    const badge = byId.get(badgeId);
    await awardBadge(studentId, badgeId);
    setAdding(false);
    if (badge) show(s.badges.awarded(student!.name, badge.nameAr));
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Award className="size-5 text-gold-dark" aria-hidden />
          {s.badges.inFile}
        </h2>
        <button type="button" onClick={() => setAdding((a) => !a)} className="btn-secondary px-4">
          <Plus className="size-5" aria-hidden />
          {s.badges.award}
        </button>
      </div>

      {adding && (
        <div className="flex flex-wrap gap-2 rounded-card bg-cream p-3">
          {badges.map((b) => (
            <button key={b.id} type="button" onClick={() => void give(b.id!)} className="btn border-2 border-line bg-white px-4 text-ink hover:border-gold">
              <span aria-hidden>{b.icon}</span> {b.nameAr}
            </button>
          ))}
        </div>
      )}

      {earned.length === 0 ? (
        <p className="text-ink-soft">{s.badges.none}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {earned.map((e) => {
            const badge = byId.get(e.badgeId);
            return (
              <li key={e.awardedAt} className="flex items-center gap-2 rounded-pill bg-gold-bg px-3 py-1 text-gold-dark">
                <span aria-hidden>{badge?.icon}</span>
                <span className="font-medium">{badge?.nameAr}</span>
                <button
                  type="button"
                  onClick={() => void removeBadge(studentId, e.awardedAt).then(() => show(s.analytics.parents.deleted, { kind: "info" }))}
                  aria-label={s.badges.remove}
                  className="text-sm hover:underline"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
