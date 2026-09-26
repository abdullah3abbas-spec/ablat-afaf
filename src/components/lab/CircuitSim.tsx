/**
 * محاكاة وحدة ٢ — «دائرتي الكهربائية»: مفتاح يُفتح ويُغلق ومصباحان
 * يُفكّان ويُركّبان في التوالي والتوازي — جوهر درسي 2.2 و2.4.
 * كل شيء SVG محلي، والألوان من لوحة وضع الفصل الداكنة.
 */
import { useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { litBulbs, type CircuitMode } from "@/lib/labSims";
import { useStrings } from "@/hooks/useStrings";

function Bulb({ x, y, lit, installed, onTap, label }: { x: number; y: number; lit: boolean; installed: boolean; onTap: () => void; label: string }) {
  return (
    <g onClick={onTap} role="button" aria-label={label} className="cursor-pointer" transform={`translate(${x} ${y})`}>
      {lit && <circle r="34" fill="rgba(240,196,84,.35)" className="motion-safe:animate-pulse" />}
      <circle r="20" fill={installed ? (lit ? "#F0C454" : "#2E3644") : "none"} stroke={installed ? "#E6DFD4" : "#7A8494"} strokeWidth="3" strokeDasharray={installed ? "0" : "6 5"} />
      {installed && <path d="M -7 6 Q 0 -6 7 6" fill="none" stroke={lit ? "#7A5716" : "#7A8494"} strokeWidth="2.5" />}
      <rect x="-8" y="18" width="16" height="10" rx="2" fill={installed ? "#9AA4B4" : "#4A5260"} />
      {!installed && <text y="4" textAnchor="middle" fontSize="13" fill="#C9D2DE">✕</text>}
    </g>
  );
}

export default function CircuitSim() {
  const s = useStrings();
  const [mode, setMode] = useState<CircuitMode>("series");
  const [switchClosed, setSwitchClosed] = useState(false);
  const [bulbs, setBulbs] = useState<[boolean, boolean]>([true, true]);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [conclusionShown, setConclusionShown] = useState(false);

  const lit = litBulbs({ mode, switchClosed, bulbs });
  const wire = (on: boolean) => (on ? "#F0C454" : "#7A8494");
  const current = switchClosed && (mode === "parallel" ? bulbs[0] || bulbs[1] : bulbs[0] && bulbs[1]);

  function toggleBulb(i: 0 | 1) {
    setBulbs((b) => (i === 0 ? [!b[0], b[1]] : [b[0], !b[1]]));
  }
  function reset() {
    setSwitchClosed(false);
    setBulbs([true, true]);
    setConclusionShown(false);
  }

  const observe =
    !switchClosed
      ? s.lab.circuit.observeOpen
      : mode === "series"
        ? lit[0] ? s.lab.circuit.observeSeriesOn : s.lab.circuit.observeSeriesBroken
        : lit[0] && lit[1] ? s.lab.circuit.observeParallelOn : lit[0] || lit[1] ? s.lab.circuit.observeParallelHalf : s.lab.circuit.observeSeriesBroken;

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
      <section className="space-y-4">
        {/* اختيار الوصلة */}
        <div className="flex gap-2">
          {(["series", "parallel"] as CircuitMode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => { setMode(m); reset(); }}
              className={
                "min-h-touch flex-1 rounded-card border-2 px-4 py-2 text-xl font-bold transition-colors " +
                (mode === m ? "border-gold bg-gold text-ink" : "border-white/25 text-white hover:border-gold")
              }
            >
              {m === "series" ? s.lab.circuit.series : s.lab.circuit.parallel}
            </button>
          ))}
        </div>

        {/* الدائرة */}
        <svg viewBox="0 0 340 260" role="img" aria-label={s.lab.circuit.title} className="w-full rounded-card bg-white/5">
          {/* البطارية */}
          <g transform="translate(30 110)">
            <rect width="26" height="44" rx="4" fill="#2E3644" stroke="#E6DFD4" strokeWidth="3" />
            <rect x="8" y="-7" width="10" height="7" fill="#E6DFD4" />
            <text x="13" y="28" textAnchor="middle" fontSize="15" fill="#F0C454">+</text>
          </g>
          {mode === "series" ? (
            <g fill="none" stroke={wire(current)} strokeWidth="4">
              <path d="M 43 103 L 43 40 L 120 40" />
              <path d="M 160 40 L 230 40" />
              <path d="M 270 40 L 310 40 L 310 220 L 43 220 L 43 154" />
            </g>
          ) : (
            <g fill="none" stroke="#7A8494" strokeWidth="4">
              <path d="M 43 103 L 43 40 L 90 40" stroke={wire(current)} />
              <path d="M 90 40 L 140 40 L 140 70" stroke={wire(switchClosed && bulbs[0])} />
              <path d="M 140 110 L 140 190 L 90 190" stroke={wire(switchClosed && bulbs[0])} />
              <path d="M 90 40 L 240 40 L 240 70" stroke={wire(switchClosed && bulbs[1])} />
              <path d="M 240 110 L 240 190 L 90 190" stroke={wire(switchClosed && bulbs[1])} />
              <path d="M 90 190 L 43 190 L 43 154" stroke={wire(current)} />
            </g>
          )}
          {/* المفتاح */}
          <g transform={mode === "series" ? "translate(120 40)" : "translate(58 40)"} onClick={() => setSwitchClosed((x) => !x)} role="button" aria-label={s.lab.circuit.toggleSwitch} className="cursor-pointer">
            <circle cx="0" cy="0" r="5" fill="#E6DFD4" />
            <circle cx="40" cy="0" r="5" fill="#E6DFD4" />
            <line x1="0" y1="0" x2={switchClosed ? 40 : 32} y2={switchClosed ? 0 : -22} stroke="#F0C454" strokeWidth="5" strokeLinecap="round" />
          </g>
          {mode === "series" ? (
            <>
              <Bulb x={250} y={40} lit={lit[0]} installed={bulbs[0]} onTap={() => toggleBulb(0)} label={s.lab.circuit.toggleBulb} />
              <Bulb x={170} y={220} lit={lit[1]} installed={bulbs[1]} onTap={() => toggleBulb(1)} label={s.lab.circuit.toggleBulb} />
            </>
          ) : (
            <>
              <Bulb x={140} y={90} lit={lit[0]} installed={bulbs[0]} onTap={() => toggleBulb(0)} label={s.lab.circuit.toggleBulb} />
              <Bulb x={240} y={90} lit={lit[1]} installed={bulbs[1]} onTap={() => toggleBulb(1)} label={s.lab.circuit.toggleBulb} />
            </>
          )}
        </svg>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSwitchClosed((x) => !x)} className="btn min-h-touch bg-gold px-5 font-bold text-ink hover:bg-gold-dark hover:text-white">
            ⚡ {switchClosed ? s.lab.circuit.openSwitch : s.lab.circuit.closeSwitch}
          </button>
          <button type="button" onClick={reset} className="btn min-h-touch border-2 border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
            <RotateCcw className="size-5" aria-hidden />
            {s.lab.reset}
          </button>
        </div>
        <p className="text-white/70">{s.lab.circuit.tapHint}</p>
      </section>

      <section className="space-y-4">
        <div className="rounded-card bg-white/5 p-4">
          <p className="mb-2 text-xl font-bold text-gold">{s.lab.predict}</p>
          <p className="mb-3 text-lg">{s.lab.circuit.predictQ}</p>
          <div className="flex flex-wrap gap-2">
            {s.lab.circuit.predictOptions.map((opt, i) => (
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
          <p className="mt-1 text-lg text-white/80">{s.lab.circuit.tryHint}</p>
          <p className="mt-2 text-xl font-bold text-gold">{s.lab.observe}</p>
          <p className="mt-1 rounded-card border-2 border-teal bg-teal/15 p-3 text-xl leading-relaxed">{observe}</p>
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.explain}</p>
          <p className="mt-1 text-lg text-white/80">{s.lab.circuit.explainPrompt}</p>
        </div>

        <div className="rounded-card bg-white/5 p-4">
          <p className="text-xl font-bold text-gold">{s.lab.conclude}</p>
          {conclusionShown ? (
            <p className="mt-2 rounded-card border-2 border-ok bg-ok/15 p-3 text-xl leading-relaxed">{s.lab.circuit.conclusion}</p>
          ) : (
            <button type="button" onClick={() => setConclusionShown(true)} className="btn mt-2 min-h-touch bg-teal px-5 font-bold text-white hover:bg-teal-dark">
              <Eye className="size-5" aria-hidden />
              {s.lab.showConclusion}
            </button>
          )}
        </div>
        <p className="text-sm font-medium text-gold">{s.lab.circuit.safety}</p>
      </section>
    </main>
  );
}
