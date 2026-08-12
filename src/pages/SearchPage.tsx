/** البحث الشامل: كلمة واحدة تُظهر كل ما يتعلق بها — بلا أسماء طالبات */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, ClipboardList, DatabaseZap, FolderOpen, NotebookPen, Search as SearchIcon } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { kindLabel, universalSearch, type SearchHit, type SearchKind } from "@/lib/search";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

const ICON: Record<SearchKind, typeof BookMarked> = {
  lesson: BookMarked,
  unit: BookMarked,
  question: DatabaseZap,
  resource: FolderOpen,
  exam: ClipboardList,
  worksheet: NotebookPen,
};

export default function SearchPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [query, setQuery] = useState("");

  const hits = useLiveQuery(async () => (query.trim().length >= 2 ? universalSearch(query) : []), [query]);

  const grouped = useMemo(() => {
    const g = new Map<SearchKind, SearchHit[]>();
    for (const h of hits ?? []) {
      const arr = g.get(h.kind) ?? [];
      arr.push(h);
      g.set(h.kind, arr);
    }
    return g;
  }, [hits]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <SearchIcon className="size-7" aria-hidden />
          {s.search.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.search.hint}</p>
      </div>

      <label className="card flex min-h-touch items-center gap-2 border-2 border-line focus-within:border-teal">
        <SearchIcon className="size-6 text-ink-soft" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.search.placeholder}
          aria-label={s.search.title}
          autoFocus
          className="min-h-touch w-full bg-transparent text-lg outline-none"
        />
      </label>

      {query.trim().length < 2 ? (
        <p className="card text-ink-soft">{s.search.typeMore}</p>
      ) : hits === undefined ? (
        <p className="card text-ink-soft">{s.common.loading}</p>
      ) : hits.length === 0 ? (
        <p className="card text-ink-soft">{s.search.empty}</p>
      ) : (
        <>
          <p className="text-ink-soft">{s.search.resultsCount(fmtNum(hits.length, numerals))}</p>
          {Array.from(grouped, ([kind, items]) => {
            const Icon = ICON[kind];
            return (
              <section key={kind} className="card space-y-2">
                <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-teal-dark">
                  <Icon className="size-5" aria-hidden />
                  {kindLabel(kind)} ({fmtNum(items.length, numerals)})
                </h2>
                <ul className="divide-y divide-line">
                  {items.map((h) => (
                    <li key={`${h.kind}-${h.id}`}>
                      <Link to={h.to} className="flex min-h-touch flex-col justify-center py-2 hover:bg-teal-bg">
                        <span className="font-medium">{h.title}</span>
                        {h.subtitle && <span className="text-sm text-ink-soft">{h.subtitle}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
