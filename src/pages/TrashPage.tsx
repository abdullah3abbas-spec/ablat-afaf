/**
 * سلة الاسترجاع (§2-د) — «لا حذف نهائي إطلاقاً»:
 * كل ما حُذف خلال آخر ٣٠ يوماً من الجداول المهمة يظهر هنا مصنّفاً،
 * وزر «استرجعي» واحد يعيده بكل بياناته. الأقدم من ٣٠ يوماً يبقى محفوظاً
 * في القاعدة (لا يُمسح) لكنه يخرج من هذه القائمة تخفيفاً للضوضاء.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { ArchiveRestore, Home as HomeIcon, RotateCcw } from "lucide-react";
import { db } from "@/db";
import EmptyState from "@/components/EmptyState";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface TrashRow {
  table: string;
  id: number;
  label: string;
  deletedAt: number;
}

export default function TrashPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const rows = useLiveQuery(async () => {
    const since = Date.now() - WINDOW_MS;
    const out: TrashRow[] = [];
    const grab = async <T extends { id?: number; deletedAt?: number }>(
      table: string,
      all: T[],
      label: (r: T) => string
    ) => {
      for (const r of all) {
        if (r.deletedAt && r.deletedAt >= since && r.id != null) out.push({ table, id: r.id, label: label(r), deletedAt: r.deletedAt });
      }
    };
    await grab("students", await db.students.toArray(), (r) => `${s.trash.kinds.students}: ${(r as { name: string }).name}`);
    await grab("classes", await db.classes.toArray(), (r) => `${s.trash.kinds.classes}: ${(r as { name: string }).name}`);
    await grab("questions", await db.questions.toArray(), (r) => `${s.trash.kinds.questions}: ${(r as { text: string }).text.slice(0, 60)}`);
    await grab("lessonPacks", await db.lessonPacks.toArray(), (r) => `${s.trash.kinds.lessonPacks}: ${(r as { title: string }).title}`);
    await grab("presentations", await db.presentations.toArray(), (r) => `${s.trash.kinds.presentations}: ${(r as { title: string }).title}`);
    await grab("resources", await db.resources.toArray(), (r) => `${s.trash.kinds.resources}: ${(r as { title: string }).title}`);
    await grab("requests", await db.requests.toArray(), (r) => `${s.trash.kinds.requests}: ${(r as { title: string }).title}`);
    return out.sort((a, b) => b.deletedAt - a.deletedAt);
  });

  async function restore(row: TrashRow) {
    await (db as unknown as Record<string, { update: (id: number, ch: object) => Promise<number> }>)[row.table].update(row.id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
    show(s.trash.restored(row.label));
  }

  const daysAgo = (t: number) => Math.max(0, Math.floor((Date.now() - t) / 86400000));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
            <ArchiveRestore className="size-7" aria-hidden />
            {s.trash.title}
          </h1>
          <p className="mt-1 text-ink-soft">{s.trash.subtitle}</p>
        </div>
        <Link to="/follow" className="btn-secondary">
          <HomeIcon className="size-5" aria-hidden />
          {s.common.back}
        </Link>
      </div>

      {rows === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ArchiveRestore} title={s.trash.empty} hint={s.trash.emptyHint} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={`${r.table}-${r.id}`} className="card flex flex-wrap items-center gap-3 py-3">
              <div className="me-auto min-w-0">
                <p className="truncate font-medium">{r.label}</p>
                <p className="text-sm text-ink-soft">{s.trash.deletedAgo(fmtNum(daysAgo(r.deletedAt), numerals))}</p>
              </div>
              <button type="button" onClick={() => void restore(r)} className="btn-primary min-h-[48px]">
                <RotateCcw className="size-5" aria-hidden />
                {s.trash.restore}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
