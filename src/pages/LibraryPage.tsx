/**
 * مكتبة الدروس — شجرة المنهج (وحدات ← دروس) مع حالة جاهزية كل حزمة.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Library } from "lucide-react";
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
    return units.map((u) => ({ unit: u, lessons: lessons.filter((l) => l.unitId === u.id) }));
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
        tree.map(({ unit, lessons }) => (
          <section key={unit.id} className="card space-y-2">
            <h2 className="flex items-center justify-between gap-2 font-heading text-xl font-bold text-teal-dark">
              <span className="flex items-center gap-2">
                <BookOpen className="size-6" aria-hidden />
                {unit.title}
              </span>
              <span className="text-sm font-normal text-ink-soft">
                {s.library.lessonsCount(fmtNum(lessons.length, numerals))}
              </span>
            </h2>
            <ul className="divide-y divide-line">
              {lessons.map((l) => {
                const kit = kitByLessonTitle(l.title);
                return (
                  <li key={l.id}>
                    <Link
                      to={`/library/${l.id}`}
                      className="flex min-h-touch flex-wrap items-center gap-3 px-1 py-3 transition-colors hover:bg-teal-bg"
                    >
                      <span className="me-auto text-lg font-medium">{l.title}</span>
                      {kit ? (
                        <span className="flex items-center gap-1 rounded-pill bg-teal-bg px-3 py-1 text-sm font-medium text-teal-dark">
                          <CheckCircle2 className="size-4" aria-hidden />
                          {s.library.kitReady}
                        </span>
                      ) : (
                        <span className="rounded-pill bg-gold-bg px-3 py-1 text-sm text-gold-dark">{s.library.kitMissing}</span>
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
