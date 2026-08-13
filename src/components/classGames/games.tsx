/**
 * قوالب ألعاب وضع الفصل (زكريت م٤-ب) — أربع ألعاب من بنك أسئلة الدرس:
 * طابقي وصنّفي · رتّبي الخطوات · بطاقات الذاكرة · من أنا؟
 *
 * قواعد الماستر برومبت: الخطأ ليس عقاباً ولا إحراجاً (وميض لطيف فقط)،
 * Feedback يشرح، وكل شيء بخط ضخم لشاشة البروجكتور، بلا إنترنت.
 */
import { useEffect, useMemo, useState } from "react";
import { Eye, Link2, RotateCcw, Shuffle } from "lucide-react";
import type { Question } from "@/db/schema";
import {
  buildClues,
  buildMemoryCards,
  buildOrderGame,
  buildPairs,
  type GamePair,
  type MemoryCard,
} from "@/lib/classGames";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

/** زر رجوع موحّد لقائمة الألعاب */
function BackRow({ onExit, label }: { onExit: () => void; label: string }) {
  return (
    <button type="button" onClick={onExit} className="mx-auto flex min-h-touch items-center gap-2 rounded-card px-4 text-white/60 hover:bg-white/10 hover:text-white">
      <RotateCcw className="size-5" aria-hidden />
      {label}
    </button>
  );
}

function Celebrate({ text, onAgain, againLabel }: { text: string; onAgain: () => void; againLabel: string }) {
  return (
    <div className="space-y-6 text-center">
      <p className="font-heading text-6xl font-bold text-gold">{text}</p>
      <button type="button" onClick={onAgain} className="btn mx-auto min-h-[56px] bg-gold px-8 text-xl font-bold text-ink hover:bg-gold-dark hover:text-white">
        <Shuffle className="size-6" aria-hidden />
        {againLabel}
      </button>
    </div>
  );
}

// ═══════════ ١) طابقي وصنّفي ═══════════

export function MatchGame({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [seed, setSeed] = useState(0);
  const pairs = useMemo(() => buildPairs(questions, 5), [questions, seed]);
  const terms = useMemo(() => pairs.map((p, i) => ({ i, text: p.a })).sort(() => Math.random() - 0.5), [pairs]);
  const defs = useMemo(() => pairs.map((p, i) => ({ i, text: p.b })).sort(() => Math.random() - 0.5), [pairs]);

  const [pickedTerm, setPickedTerm] = useState<number | null>(null);
  const [pickedDef, setPickedDef] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (pickedTerm === null || pickedDef === null) return;
    if (pickedTerm === pickedDef) {
      setMatched((m) => new Set(m).add(pickedTerm));
      setPickedTerm(null);
      setPickedDef(null);
    } else {
      setWrong(true);
      const t = setTimeout(() => {
        setWrong(false);
        setPickedTerm(null);
        setPickedDef(null);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [pickedTerm, pickedDef]);

  if (pairs.length < 3) return <p className="text-3xl text-white/70">{s.games.needDefine(fmtNum(3, numerals))}</p>;

  const done = matched.size === pairs.length;
  const btn = (active: boolean, isMatched: boolean) =>
    "min-h-[64px] w-full rounded-card border-2 px-3 py-2 text-start text-2xl font-medium transition-colors " +
    (isMatched
      ? "border-ok bg-ok/20 text-white/60"
      : active
        ? wrong
          ? "border-danger bg-danger/20 text-white"
          : "border-gold bg-gold/20 text-white"
        : "border-white/25 text-white hover:border-gold");

  return (
    <div className="w-full max-w-5xl space-y-6">
      {done ? (
        <Celebrate text={s.games.wellDone} onAgain={() => { setMatched(new Set()); setSeed((x) => x + 1); }} againLabel={s.games.again} />
      ) : (
        <>
          <p className="text-xl text-white/60">{s.games.matchHint} · {s.games.matchedCount(fmtNum(matched.size, numerals), fmtNum(pairs.length, numerals))}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              {terms.map((t) => (
                <button key={t.i} type="button" disabled={matched.has(t.i)} onClick={() => setPickedTerm(t.i)} className={btn(pickedTerm === t.i, matched.has(t.i))}>
                  {t.text}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {defs.map((d) => (
                <button key={d.i} type="button" disabled={matched.has(d.i)} onClick={() => setPickedDef(d.i)} className={btn(pickedDef === d.i, matched.has(d.i))}>
                  {d.text}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <BackRow onExit={onExit} label={s.games.back} />
    </div>
  );
}

// ═══════════ ٢) رتّبي الخطوات ═══════════

export function OrderGame({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const s = useStrings();
  const orderQs = useMemo(
    () => questions.map((q) => buildOrderGame(q)).filter((g): g is NonNullable<typeof g> => g !== null),
    [questions]
  );
  const [round, setRound] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrongItem, setWrongItem] = useState<string | null>(null);

  if (orderQs.length === 0) return (
    <div className="space-y-6"><p className="text-3xl text-white/70">{s.games.needOrder}</p><BackRow onExit={onExit} label={s.games.back} /></div>
  );

  const g = orderQs[round % orderQs.length];
  const done = placed.length === g.correct.length;

  function tap(item: string) {
    if (item === g.correct[placed.length]) {
      setPlaced((p) => [...p, item]);
      setWrongItem(null);
    } else {
      setWrongItem(item);
      setTimeout(() => setWrongItem(null), 700);
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      <h3 className="font-heading text-4xl font-bold">{g.prompt}</h3>
      {wrongItem && <p className="text-xl text-gold">{s.games.orderWrong}</p>}
      {!done && <p className="text-xl text-white/60">{s.games.orderHint}</p>}

      {/* الشريط المرتَّب */}
      <div className="flex min-h-[72px] flex-wrap items-center justify-center gap-2 rounded-card border-2 border-white/20 p-3">
        {placed.map((it, i) => (
          <span key={i} className="flex items-center gap-2 rounded-card border-2 border-ok bg-ok/20 px-4 py-2 text-2xl">
            <b className="text-gold">{i + 1}</b> {it}
          </span>
        ))}
      </div>

      {done ? (
        <Celebrate
          text={s.games.wellDone}
          onAgain={() => { setRound((r) => r + 1); setPlaced([]); }}
          againLabel={orderQs.length > 1 ? s.games.nextRound : s.games.again}
        />
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {g.shuffled.filter((it) => !placed.includes(it)).map((it) => (
            <button
              key={it}
              type="button"
              onClick={() => tap(it)}
              className={
                "min-h-[64px] rounded-card border-2 px-5 py-2 text-2xl font-medium transition-colors " +
                (wrongItem === it ? "border-danger bg-danger/20 text-white" : "border-white/25 text-white hover:border-gold")
              }
            >
              {it}
            </button>
          ))}
        </div>
      )}
      <BackRow onExit={onExit} label={s.games.back} />
    </div>
  );
}

// ═══════════ ٣) بطاقات الذاكرة ═══════════

export function MemoryGame({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [seed, setSeed] = useState(0);
  const pairs: GamePair[] = useMemo(() => buildPairs(questions, 6), [questions, seed]);
  const cards: MemoryCard[] = useMemo(() => buildMemoryCards(pairs), [pairs]);

  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flips, setFlips] = useState(0);

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((id) => cards.find((c) => c.id === id)!);
    if (a.pairIndex === b.pairIndex) {
      setMatched((m) => new Set(m).add(a.pairIndex));
      setOpen([]);
    } else {
      const t = setTimeout(() => setOpen([]), 950);
      return () => clearTimeout(t);
    }
  }, [open, cards]);

  if (pairs.length < 3) return (
    <div className="space-y-6"><p className="text-3xl text-white/70">{s.games.needDefine(fmtNum(3, numerals))}</p><BackRow onExit={onExit} label={s.games.back} /></div>
  );

  const done = matched.size === pairs.length;

  return (
    <div className="w-full max-w-5xl space-y-6">
      {done ? (
        <Celebrate text={s.games.wellDone} onAgain={() => { setMatched(new Set()); setFlips(0); setSeed((x) => x + 1); }} againLabel={s.games.again} />
      ) : (
        <>
          <p className="text-xl text-white/60">{s.games.memoryHint} · {s.games.flips(fmtNum(flips, numerals))}</p>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
            {cards.map((c) => {
              const isOpen = open.includes(c.id) || matched.has(c.pairIndex);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={isOpen || open.length === 2}
                  onClick={() => { setOpen((o) => [...o, c.id]); setFlips((f) => f + 1); }}
                  className={
                    "min-h-[96px] rounded-card border-2 p-2 text-lg font-medium transition-colors " +
                    (matched.has(c.pairIndex)
                      ? "border-ok bg-ok/15 text-white/60"
                      : isOpen
                        ? c.face === "term"
                          ? "border-gold bg-gold/15 text-white"
                          : "border-teal bg-teal/20 text-white"
                        : "border-white/25 bg-white/10 text-transparent hover:border-gold")
                  }
                >
                  {isOpen ? c.text : <span className="block text-4xl text-white/40">؟</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <BackRow onExit={onExit} label={s.games.back} />
    </div>
  );
}

// ═══════════ ٤) من أنا؟ ═══════════

export function WhoAmIGame({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const pairs = useMemo(() => buildPairs(questions, 8), [questions]);
  const [round, setRound] = useState(0);
  const [clueIdx, setClueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (pairs.length === 0) return (
    <div className="space-y-6"><p className="text-3xl text-white/70">{s.games.needDefine(fmtNum(1, numerals))}</p><BackRow onExit={onExit} label={s.games.back} /></div>
  );

  const p = pairs[round % pairs.length];
  const clues = buildClues(p.b);

  return (
    <div className="w-full max-w-4xl space-y-8 text-center">
      <h3 className="font-heading text-5xl font-bold text-gold">{s.games.whoTitle}</h3>
      <div className="space-y-3">
        {clues.slice(0, clueIdx + 1).map((c, i) => (
          <p key={i} className="rounded-card border-2 border-white/25 p-4 text-3xl leading-relaxed">
            <b className="text-gold">{s.games.clue(fmtNum(i + 1, numerals))}:</b> {c}
          </p>
        ))}
      </div>

      {revealed ? (
        <>
          <p className="font-heading text-6xl font-bold text-gold">{p.a}</p>
          <button
            type="button"
            onClick={() => { setRound((r) => r + 1); setClueIdx(0); setRevealed(false); }}
            className="btn mx-auto min-h-[56px] bg-gold px-8 text-xl font-bold text-ink hover:bg-gold-dark hover:text-white"
          >
            {s.games.nextRound}
          </button>
        </>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {clueIdx < clues.length - 1 && (
            <button type="button" onClick={() => setClueIdx((i) => i + 1)} className="btn min-h-[56px] border-2 border-white/30 bg-transparent px-6 text-xl text-white hover:bg-white/10">
              <Link2 className="size-6" aria-hidden />
              {s.games.nextClue}
            </button>
          )}
          <button type="button" onClick={() => setRevealed(true)} className="btn min-h-[56px] bg-teal px-6 text-xl font-bold text-white hover:bg-teal-dark">
            <Eye className="size-6" aria-hidden />
            {s.games.revealTerm}
          </button>
        </div>
      )}
      <BackRow onExit={onExit} label={s.games.back} />
    </div>
  );
}
