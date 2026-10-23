/**
 * محاكاة «الكشف عن أيون الهاليد»: نترات الفضة تكوّن راسباً ملوّناً،
 * ثم الأمونيا المخففة فالمركّزة تميّز الكلوريد من البروميد من اليوديد.
 * أنابيب معروفة تملأ جدول الملاحظات، وعيّنة مجهولة تستدلّ عليها الطالبات.
 * كل شيء SVG محلي، والإجابات لا تظهر إلا بضغطة المعلّمة.
 */
import { useState } from "react";
import { Eye, RotateCcw, Shuffle } from "lucide-react";
import { HALIDES, HALIDE_INFO, tubeView, type Halide, type TubeState } from "@/lib/labSims";
import { useStrings } from "@/hooks/useStrings";

const PPT_FILL = { white: "#F2F2EE", cream: "#EBDDAF", yellow: "#E9CF4A" } as const;

const fresh = (halide: Halide): TubeState => ({ halide, silverAdded: false, diluteAdded: false, concAdded: false });
const randomHalide = (): Halide => HALIDES[Math.floor(Math.random() * HALIDES.length)];

/** مواضع ثابتة لحبيبات عالقة فوق طبقة الراسب (بلا Math.random كي لا يرتجف العرض) */
const GRAINS = Array.from({ length: 14 }, (_, i) => ({ x: 68 + ((i * 29) % 64), y: 200 + ((i * 41) % 60) }));

function Tube({ state, label }: { state: TubeState; label: string }) {
  const { precipitate, dissolved } = tubeView(state);
  const level = 150 - (state.silverAdded ? 25 : 0) - (state.diluteAdded ? 20 : 0) - (state.concAdded ? 20 : 0);
  const showPpt = precipitate !== null && !dissolved;
  const fill = showPpt ? PPT_FILL[precipitate] : null;
  return (
    <svg viewBox="0 0 200 340" role="img" aria-label={label} className="mx-auto h-80 w-auto rounded-card bg-white/5">
      <defs>
        <clipPath id="tube-inside">
          <path d="M 60 30 L 60 270 A 40 40 0 0 0 140 270 L 140 30 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#tube-inside)">
        <rect x="55" y={level} width="90" height={330 - level} fill="rgba(214,240,255,.18)" className="transition-all duration-700" />
        {/* عكارة الراسب في المحلول ثم الحبيبات المترسّبة في القاع */}
        {fill && <rect x="55" y={level} width="90" height={330 - level} fill={fill} opacity="0.35" className="transition-opacity duration-700" />}
        {fill && <rect x="55" y="272" width="90" height="60" fill={fill} />}
        {fill && GRAINS.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r="3" fill={fill} />)}
      </g>
      <path d="M 60 30 L 60 270 A 40 40 0 0 0 140 270 L 140 30" fill="none" stroke="#E6F2F0" strokeWidth="5" strokeLinecap="round" />
      <line x1="50" y1="30" x2="150" y2="30" stroke="#E6F2F0" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export default function HalideSim() {
  const s = useStrings();
  const h = s.lab.halide;
  const [mode, setMode] = useState<"known" | "unknown">("known");
  const [selected, setSelected] = useState<Halide>("Cl");
  const [tubes, setTubes] = useState<Record<Halide, TubeState>>(() => ({ F: fresh("F"), Cl: fresh("Cl"), Br: fresh("Br"), I: fresh("I") }));
  const [unknown, setUnknown] = useState<TubeState>(() => fresh(randomHalide()));
  const [guess, setGuess] = useState<Halide | null>(null);
  const [unknownRevealed, setUnknownRevealed] = useState(false);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [conclusionShown, setConclusionShown] = useState(false);

  const tube = mode === "known" ? tubes[selected] : unknown;
  const { precipitate, dissolved } = tubeView(tube);
  const ammoniaAdded = tube.diluteAdded || tube.concAdded;

  function apply(change: Partial<TubeState>) {
    if (mode === "known") setTubes((all) => ({ ...all, [selected]: { ...all[selected], ...change } }));
    else setUnknown((u) => ({ ...u, ...change }));
  }
  function newUnknown() {
    setUnknown(fresh(randomHalide()));
    setGuess(null);
    setUnknownRevealed(false);
  }
  function reset() {
    setTubes({ F: fresh("F"), Cl: fresh("Cl"), Br: fresh("Br"), I: fresh("I") });
    newUnknown();
    setConclusionShown(false);
  }

  const observe = !tube.silverAdded
    ? h.observeStart
    : precipitate === null
      ? h.observeNoPpt
      : dissolved
        ? h.observeDissolved
        : ammoniaAdded
          ? `${h.observePpt[precipitate]} ${h.observeNotDissolved}`
          : h.observePpt[precipitate];

  const x = tube.halide;
  const equations: string[] = [];
  if (mode === "known" && tube.silverAdded) {
    equations.push(x === "F" ? "AgNO₃ + F⁻ → AgF(aq) + NO₃⁻" : `AgNO₃ + ${x}⁻ → Ag${x}↓ + NO₃⁻`);
    if (dissolved) equations.push(`Ag${x} + 2NH₃ → [Ag(NH₃)₂]⁺ + ${x}⁻`);
  }

  /** خلية في جدول الملاحظات — تمتلئ فقط بعد تجربة الخطوة فعلاً على الأنبوب المعروف */
  function cell(hal: Halide, step: "ppt" | "dilute" | "conc"): string {
    const t = tubes[hal];
    const info = HALIDE_INFO[hal];
    if (!t.silverAdded) return "";
    if (step === "ppt") return info.precipitate ? h.cellColor[info.precipitate] : h.cellNoPpt;
    if (info.precipitate === null) return h.cellNA;
    const tried = step === "dilute" ? t.diluteAdded : t.concAdded;
    if (!tried) return "";
    const dissolves = info.solubility === "dilute" || (step === "conc" && info.solubility === "conc");
    return dissolves ? h.cellDissolves : h.cellNotDissolves;
  }

  const stepBtn = "btn min-h-touch px-4 font-bold disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
      <section className="space-y-4">
        <div className="flex gap-2">
          {(["known", "unknown"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={
                "min-h-touch flex-1 rounded-card border-2 px-4 py-2 text-xl font-bold transition-colors " +
                (mode === m ? "border-gold bg-gold text-ink" : "border-white/25 text-white hover:border-gold")
              }
            >
              {m === "known" ? h.modeKnown : h.modeUnknown}
            </button>
          ))}
        </div>

        {mode === "known" && (
          <div>
            <p className="mb-2 text-lg text-white/80">{h.pickTube}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HALIDES.map((hal) => (
                <button
                  key={hal}
                  type="button"
                  aria-pressed={selected === hal}
                  onClick={() => setSelected(hal)}
                  className={
                    "min-h-touch rounded-pill border-2 px-3 py-1 font-medium transition-colors " +
                    (selected === hal ? "border-teal bg-teal text-white" : "border-white/25 text-white hover:border-gold")
                  }
                >
                  {h.ionName[hal]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-2 text-center text-xl font-bold">{mode === "known" ? h.ionName[selected] : h.unknownTube}</p>
          <Tube state={tube} label={observe} />
          {equations.length > 0 && (
            <div dir="ltr" className="mt-3 space-y-1 text-center font-mono text-lg text-gold">
              {equations.map((e) => <p key={e}>{e}</p>)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={tube.silverAdded} onClick={() => apply({ silverAdded: true })} className={stepBtn + " bg-gold text-ink hover:bg-gold-dark hover:text-white"}>
            💧 {h.addSilver}
          </button>
          <button type="button" disabled={!tube.silverAdded || tube.diluteAdded} onClick={() => apply({ diluteAdded: true })} className={stepBtn + " bg-teal text-white hover:bg-teal-dark"}>
            💧 {h.addDilute}
          </button>
          <button type="button" disabled={!tube.silverAdded || tube.concAdded} onClick={() => apply({ concAdded: true })} className={stepBtn + " bg-teal text-white hover:bg-teal-dark"}>
            💧 {h.addConc}
          </button>
          <button type="button" onClick={reset} className="btn min-h-touch border-2 border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
            <RotateCcw className="size-5" aria-hidden />
            {s.lab.reset}
          </button>
        </div>
        {!tube.silverAdded && <p className="text-white/70">{h.needSilverFirst}</p>}
      </section>

      <section className="space-y-4">
        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-2 text-xl font-bold text-gold">{s.lab.predict}</p>
          <p className="mb-3 text-lg">{h.predictQ}</p>
          <div className="flex flex-wrap gap-2">
            {h.predictOptions.map((opt, i) => (
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
          <p className="text-xl font-bold text-gold">{h.tryTitle}</p>
          <p className="mt-1 text-lg text-white/80">{h.tryHint}</p>
          <p className="mt-2 text-xl font-bold text-gold">{s.lab.observe}</p>
          <p className="mt-1 rounded-card border-2 border-teal bg-teal/15 p-3 text-xl leading-relaxed">{observe}</p>
        </div>

        {mode === "known" ? (
          <div className="rounded-card bg-white/5 p-4">
            <p className="mb-2 text-lg font-bold text-gold">{h.tableTitle}</p>
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="text-white/80">
                  {[h.colIon, h.colPpt, h.colDilute, h.colConc].map((c) => (
                    <th key={c} className="border border-white/20 p-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HALIDES.map((hal) => (
                  <tr key={hal} className={selected === hal ? "bg-white/10" : ""}>
                    <td className="border border-white/20 p-2 font-bold">{h.ionName[hal]}</td>
                    <td className="border border-white/20 p-2">{cell(hal, "ppt")}</td>
                    <td className="border border-white/20 p-2">{cell(hal, "dilute")}</td>
                    <td className="border border-white/20 p-2">{cell(hal, "conc")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-card bg-white/5 p-4">
            <p className="mb-3 text-lg font-bold text-gold">{h.unknownQ}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HALIDES.map((hal) => (
                <button
                  key={hal}
                  type="button"
                  aria-pressed={guess === hal}
                  onClick={() => setGuess(hal)}
                  className={
                    "min-h-touch rounded-pill border-2 px-3 py-1 font-medium transition-colors " +
                    (guess === hal ? "border-gold bg-gold text-ink" : "border-white/25 text-white hover:border-gold")
                  }
                >
                  {h.ionName[hal]}
                </button>
              ))}
            </div>
            {guess !== null && (
              <p className={"mt-3 rounded-card border-2 p-3 text-xl " + (guess === unknown.halide ? "border-ok bg-ok/15" : "border-gold bg-gold/15")}>
                {guess === unknown.halide ? h.unknownRight : h.unknownWrong}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {unknownRevealed ? (
                <p className="rounded-card border-2 border-ok bg-ok/15 p-3 text-xl">{h.unknownWas(h.ionName[unknown.halide])}</p>
              ) : (
                <button type="button" onClick={() => setUnknownRevealed(true)} className="btn min-h-touch bg-teal px-5 font-bold text-white hover:bg-teal-dark">
                  <Eye className="size-5" aria-hidden />
                  {h.revealUnknown}
                </button>
              )}
              <button type="button" onClick={newUnknown} className="btn min-h-touch border-2 border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
                <Shuffle className="size-5" aria-hidden />
                {h.newUnknown}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.explain}</p>
          <p className="mt-1 text-lg text-white/80">{h.explainPrompt}</p>
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.conclude}</p>
          {conclusionShown ? (
            <p className="mt-2 rounded-card border-2 border-ok bg-ok/15 p-3 text-xl leading-relaxed">{h.conclusion}</p>
          ) : (
            <button type="button" onClick={() => setConclusionShown(true)} className="btn mt-2 min-h-touch bg-teal px-5 font-bold text-white hover:bg-teal-dark">
              <Eye className="size-5" aria-hidden />
              {s.lab.showConclusion}
            </button>
          )}
        </div>
        <p className="text-sm font-medium text-gold">{h.safety}</p>
      </section>
    </main>
  );
}
