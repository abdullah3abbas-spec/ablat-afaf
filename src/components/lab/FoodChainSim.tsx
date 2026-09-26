/**
 * محاكاة وحدة ١ — «ابني سلسلتك الغذائية»: منتج أولاً ثم من يتغذى على من،
 * بنموذج (توقعي ← جرّبي ← لاحظي ← فسّري ← استنتجي). الخطأ وميض لطيف
 * مع السبب، والطاقة تجري أسهماً حين تكتمل السلسلة.
 */
import { useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { ORGANISMS, canPlace, chainComplete, organismById, validNext } from "@/lib/labSims";
import { useStrings } from "@/hooks/useStrings";

export default function FoodChainSim() {
  const s = useStrings();
  const [prediction, setPrediction] = useState<number | null>(null);
  const [chain, setChain] = useState<string[]>([]);
  const [wrong, setWrong] = useState<{ id: string; why: string } | null>(null);
  const [conclusionShown, setConclusionShown] = useState(false);

  const complete = chainComplete(chain);
  const nextOk = new Set(validNext(chain));

  function tap(id: string) {
    if (complete) return;
    if (canPlace(chain, id)) {
      setChain((c) => [...c, id]);
      setWrong(null);
    } else {
      const o = organismById(id);
      const why = chain.length === 0
        ? s.lab.food.whyProducerFirst
        : chain.includes(id)
          ? s.lab.food.whyRepeated(o.name)
          : s.lab.food.whyNotEats(o.name, organismById(chain[chain.length - 1]).name);
      setWrong({ id, why });
      setTimeout(() => setWrong(null), 2200);
    }
  }

  function reset() {
    setChain([]);
    setWrong(null);
    setConclusionShown(false);
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
      <section className="space-y-4">
        {/* السلسلة المبنية */}
        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-3 text-xl font-bold text-gold">{s.lab.food.chainTitle}</p>
          <div className="flex min-h-[120px] flex-wrap items-center justify-center gap-2" dir="rtl">
            {chain.length === 0 && <p className="text-white/50">{s.lab.food.emptyChain}</p>}
            {chain.map((id, i) => {
              const o = organismById(id);
              return (
                <span key={id} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden className={"text-4xl text-gold " + (complete ? "motion-safe:animate-pulse" : "")}>←</span>
                  )}
                  <span className={"flex flex-col items-center rounded-card border-2 px-4 py-2 " + (complete ? "border-ok bg-ok/15" : "border-teal bg-teal/15")}>
                    <span className="text-5xl" aria-hidden>{o.emoji}</span>
                    <span className="text-lg font-bold">{o.name}</span>
                    <span className="text-xs text-white/60">{i === 0 ? s.lab.food.roleProducer : i === chain.length - 1 && complete ? s.lab.food.rolePredator : s.lab.food.roleBoth}</span>
                  </span>
                </span>
              );
            })}
          </div>
          {complete && <p className="mt-3 rounded-card border-2 border-ok bg-ok/15 p-3 text-center text-2xl">🎉 {s.lab.food.completeMsg}</p>}
          {wrong && <p role="alert" className="mt-3 rounded-card border-2 border-gold bg-gold/10 p-3 text-xl leading-relaxed">💡 {wrong.why}</p>}
        </div>

        {/* الكائنات */}
        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-2 text-xl font-bold text-gold">{s.lab.food.poolTitle}</p>
          <div className="grid grid-cols-3 gap-3">
            {ORGANISMS.map((o) => {
              const used = chain.includes(o.id);
              const ok = nextOk.has(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={used || complete}
                  onClick={() => tap(o.id)}
                  className={
                    "flex min-h-[84px] flex-col items-center justify-center rounded-card border-2 p-2 transition-all " +
                    (used
                      ? "border-white/10 text-white/30"
                      : wrong?.id === o.id
                        ? "border-danger bg-danger/20"
                        : ok
                          ? "border-teal/70 bg-teal/10 motion-safe:hover:scale-105 hover:border-gold"
                          : "border-white/25 hover:border-gold")
                  }
                >
                  <span className="text-4xl" aria-hidden>{o.emoji}</span>
                  <span className="font-bold">{o.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-2 text-xl font-bold text-gold">{s.lab.predict}</p>
          <p className="mb-3 text-lg">{s.lab.food.predictQ}</p>
          <div className="flex flex-wrap gap-2">
            {s.lab.food.predictOptions.map((opt, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={prediction === i}
                onClick={() => setPrediction(i)}
                className={
                  "min-h-touch rounded-pill border-2 px-4 py-1 font-medium transition-colors " +
                  (prediction === i ? "border-gold bg-gold text-ink" : "border-white/25 text-white hover:border-gold")
                }
              >
                {opt}
              </button>
            ))}
          </div>
          {prediction !== null && <p className="mt-2 text-teal-bg">{s.lab.predictSaved}</p>}
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.tryIt}</p>
          <p className="mt-1 text-lg text-white/80">{s.lab.food.tryHint}</p>
          <p className="mt-2 text-xl font-bold text-gold">{s.lab.observe}</p>
          <p className="mt-1 rounded-card border-2 border-teal bg-teal/15 p-3 text-xl leading-relaxed">
            {complete ? s.lab.food.observeDone : s.lab.food.observeBuilding}
          </p>
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.explain}</p>
          <p className="mt-1 text-lg text-white/80">{s.lab.food.explainPrompt}</p>
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.conclude}</p>
          {conclusionShown ? (
            <p className="mt-2 rounded-card border-2 border-ok bg-ok/15 p-3 text-xl leading-relaxed">{s.lab.food.conclusion}</p>
          ) : (
            <button type="button" onClick={() => setConclusionShown(true)} className="btn mt-2 min-h-touch bg-teal px-5 font-bold text-white hover:bg-teal-dark">
              <Eye className="size-5" aria-hidden />
              {s.lab.showConclusion}
            </button>
          )}
        </div>

        <button type="button" onClick={reset} className="btn min-h-touch border-2 border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
          <RotateCcw className="size-5" aria-hidden />
          {s.lab.food.newChain}
        </button>
      </section>
    </main>
  );
}
