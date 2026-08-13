/**
 * مكتبة الدروس — شجرة كتاب الوزارة الحقيقي (وحدات ← دروس برموزها وصفحاتها)
 * مع حالة حزمة كل حصة: معتمدة ✓ / مسودة / حضّريها ✨.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Library, PencilLine, Sparkles } from "lucide-react";
import { db } from "@/db";
import { kitByLessonTitle } from "@/content/lessonKits";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

export default function LibraryPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);

  const tree = useLiveQuery(async () => {
    const units = (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order);
    const lessons = (await db.lessons.toArray()).filter((l) => !l.deletedAt).sort((a, b) => a.order - b.order);
    const packs = (await db.lessonPacks.toArray()).filter((p) => !p.deletedAt);
    const packStatus = new Map<number, "approved" | "draft">();
    for (const p of packs) {
      const prev = packStatus.get(p.lessonId);
      if (p.status === "approved" || prev == null) packStatus.set(p.lessonId, p.status as "approved" | "draft");
    }
    return units.map((u) => ({ unit: u, lessons: lessons.filter((l) => l.unitId === u.id), packStatus }));
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Library className="size-7" aria-hidden />
          {s.library.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.library.subtitle}</p>
      </div>

      {tree === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : (
        tree.map(({ unit, lessons, packStatus }) => (
          <section key={unit.id} className="card space-y-2">
            <h2 className="flex items-center justify-between gap-2 font-heading text-xl font-bold text-teal-dark">
              <span className="flex items-center gap-2">
                <BookOpen className="size-6" aria-hidden />
                {unit.title}
              </span>
              <span className="text-sm font-normal text-ink-soft">
                {s.library.lessonsCount(fmtNum(lessons.length, numerals))}
                {unit.standards?.length ? ` · ${unit.standards.join(" · ")}` : ""}
              </span>
            </h2>
            <ul className="divide-y divide-line">
              {lessons.map((l) => {
                const kit = kitByLessonTitle(l.title);
                const status = l.id != null ? packStatus.get(l.id) : undefined;
                return (
                  <li key={l.id}>
                    <Link
                      to={`/library/${l.id}`}
                      className="flex min-h-touch flex-wrap items-center gap-3 px-1 py-3 transition-colors hover:bg-teal-bg"
                    >
                      <span className="me-auto text-lg font-medium">
                        {l.code ? <span className="me-2 font-bold text-maroon">{l.code}</span> : null}
                        {l.title}
                      </span>
                      {l.bookPageStart != null && l.bookPageEnd != null && (
                        <span className="rounded-pill bg-cream px-3 py-1 text-sm text-ink-soft">
                          {s.library.book.pages(fmtNum(l.bookPageStart, numerals), fmtNum(l.bookPageEnd, numerals))}
                        </span>
                      )}
                      {status === "approved" || kit ? (
                        <span className="flex items-center gap-1 rounded-pill bg-teal-bg px-3 py-1 text-sm font-medium text-teal-dark">
                          <CheckCircle2 className="size-4" aria-hidden />
                          {kit ? s.library.kitReady : s.library.book.packApproved}
                        </span>
                      ) : status === "draft" ? (
                        <span className="flex items-center gap-1 rounded-pill bg-gold-bg px-3 py-1 text-sm font-medium text-gold-dark">
                          <PencilLine className="size-4" aria-hidden />
                          {s.library.book.packDraft}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-pill bg-maroon/10 px-3 py-1 text-sm font-medium text-maroon">
                          <Sparkles className="size-4" aria-hidden />
                          {s.library.book.prepareCta}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
