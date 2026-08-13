/**
 * المختبر التفاعلي — محاكاة حالات الماء والحرارة (زكريت م٤-ب).
 * النموذج التربوي الإلزامي: توقعي ← جرّبي ← لاحظي ← فسّري ← استنتجي.
 * محاكاة SVG/CSS خالصة (لا فيديو)، محلية بالكامل، بمتغيّر تغيّره الطالبة
 * (درجة الحرارة) وزر إعادة، وبديل منزلي آمن وتذكير سلامة.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FlaskConical, Home, LogOut, RotateCcw, Snowflake, Sun, Flame, Eye } from "lucide-react";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

type WaterState = "ice" | "liquid" | "steam";

export function waterStateOf(tempC: number): WaterState {
  if (tempC <= 0) return "ice";
  if (tempC >= 100) return "steam";
  return "liquid";
}

/** مواضع شبه عشوائية ثابتة (بلا Math.random كي يبقى العرض مستقراً) */
function jitter(i: number, salt: number): number {
  return ((i * 73 + salt * 31) % 17) / 17;
}

export default function LabPage() {
  const s = useStrings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const numerals = useUi((x) => x.numeralsTable);
  const fromClass = params.get("from") === "class";

  const [temp, setTemp] = useState(25);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [conclusionShown, setConclusionShown] = useState(false);

  const state = waterStateOf(temp);
  const n = (v: number) => fmtNum(v, numerals);

  const stateText = state === "ice" ? s.lab.stateIce : state === "liquid" ? s.lab.stateLiquid : s.lab.stateSteam;

  /** جزيئات الماء: متراصّة/متقاربة/متباعدة حسب الحالة */
  const molecules = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    if (state === "ice") {
      // شبكة منتظمة (بلورة)
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) dots.push({ x: 65 + c * 34, y: 208 + r * 26 });
    } else if (state === "liquid") {
      for (let i = 0; i < 22; i++) dots.push({ x: 60 + jitter(i, 1) * 180 + (i % 6) * 8, y: 200 + jitter(i, 2) * 100 });
    } else {
      for (let i = 0; i < 14; i++) dots.push({ x: 40 + jitter(i, 3) * 220, y: 40 + jitter(i, 4) * 250 });
    }
    return dots;
  }, [state]);

  function reset() {
    setTemp(25);
    setPrediction(null);
    setConclusionShown(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-2">
        <span className="flex items-center gap-2 truncate font-heading text-xl font-bold text-gold">
          <FlaskConical className="size-6" aria-hidden />
          {s.lab.waterTitle}
        </span>
        <div className="flex items-center gap-1">
          <Link to="/" className="flex min-h-touch items-center gap-2 rounded-card px-3 text-white/70 hover:bg-white/10 hover:text-white">
            <Home className="size-5" aria-hidden />
            {s.common.home}
          </Link>
          <button
            type="button"
            onClick={() => (fromClass ? navigate(-1) : navigate("/tools"))}
            className="flex min-h-touch items-center gap-2 rounded-card px-3 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-5" aria-hidden />
            {s.classMode.exit}
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
        {/* المشهد */}
        <section className="space-y-4">
          <svg viewBox="0 0 300 330" role="img" aria-label={stateText} className="mx-auto w-full max-w-md rounded-card bg-white/5">
            {/* الكأس */}
            <path d="M 45 30 L 45 300 Q 45 315 60 315 L 240 315 Q 255 315 255 300 L 255 30" fill="none" stroke="#E6F2F0" strokeWidth="5" strokeLinecap="round" />
            {/* المحتوى حسب الحالة */}
            {state !== "steam" && (
              <rect x="50" y={state === "ice" ? 195 : 190} width="200" height="118" rx="6" fill={state === "ice" ? "rgba(214,240,255,.25)" : "rgba(111,168,160,.35)"} />
            )}
            {state === "liquid" && <path d="M 50 192 Q 100 184 150 192 T 250 192" fill="none" stroke="#6FA8A0" strokeWidth="4" />}
            {state === "ice" && (
              <g stroke="#D6F0FF" strokeWidth="2.5" fill="rgba(214,240,255,.35)">
                <rect x="70" y="215" width="46" height="40" rx="6" />
                <rect x="130" y="230" width="52" height="44" rx="6" />
                <rect x="190" y="212" width="42" height="38" rx="6" />
              </g>
            )}
            {/* الجزيئات — تهتز حسب الحالة: الصلبة ساكنة، السائلة بطيئة، الغازية سريعة */}
            <g fill={state === "ice" ? "#D6F0FF" : state === "liquid" ? "#9FD4CC" : "#FCF3E2"}>
              {molecules.map((m, i) => (
                <circle
                  key={i}
                  cx={m.x}
                  cy={m.y}
                  r={state === "steam" ? 5 : 6}
                  opacity={state === "steam" ? 0.85 : 1}
                  className={
                    state === "steam"
                      ? "motion-safe:animate-[wiggle_.7s_ease-in-out_infinite]"
                      : state === "liquid"
                        ? "motion-safe:animate-[wiggle_1.8s_ease-in-out_infinite]"
                        : ""
                  }
                  style={{ animationDelay: `${(i % 5) * 0.15}s` }}
                />
              ))}
            </g>
            {/* أبخرة تصعد عند الغليان */}
            {state === "steam" && (
              <g fill="#FFFFFF" opacity="0.5">
                {[90, 150, 210].map((x, i) => (
                  <circle key={i} cx={x} cy={120} r={9 - i} className="motion-safe:animate-[rise_2.4s_linear_infinite]" style={{ animationDelay: `${i * 0.8}s` }} />
                ))}
              </g>
            )}
            {/* لهب/ثلج تحت الكأس */}
            {temp >= 100 && <path d="M 130 322 Q 138 306 150 322 Q 162 306 170 322" fill="none" stroke="#C08A2E" strokeWidth="4" strokeLinecap="round" />}
            {temp <= 0 && <g stroke="#D6F0FF" strokeWidth="3"><line x1="140" y1="320" x2="160" y2="328" /><line x1="160" y1="320" x2="140" y2="328" /></g>}
          </svg>

          {/* المتغيّر: درجة الحرارة */}
          <div className="space-y-2 rounded-card bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="temp" className="text-xl font-bold">{s.lab.tempLabel}</label>
              <span className="font-heading text-4xl font-bold tabular-nums text-gold">{n(temp)}°م</span>
            </div>
            <input
              id="temp"
              type="range"
              min={-20}
              max={120}
              step={5}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="h-3 w-full accent-[#C08A2E]"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTemp(-10)} className="btn min-h-touch border-2 border-white/25 bg-transparent px-4 text-white hover:border-gold">
                <Snowflake className="size-5" aria-hidden />{s.lab.presets.ice}
              </button>
              <button type="button" onClick={() => setTemp(25)} className="btn min-h-touch border-2 border-white/25 bg-transparent px-4 text-white hover:border-gold">
                <Sun className="size-5" aria-hidden />{s.lab.presets.room}
              </button>
              <button type="button" onClick={() => setTemp(100)} className="btn min-h-touch border-2 border-white/25 bg-transparent px-4 text-white hover:border-gold">
                <Flame className="size-5" aria-hidden />{s.lab.presets.boil}
              </button>
            </div>
          </div>
        </section>

        {/* النموذج التربوي */}
        <section className="space-y-4">
          {/* ١) توقعي */}
          <div className="rounded-card bg-white/5 p-4">
            <p className="mb-2 text-xl font-bold text-gold">{s.lab.predict}</p>
            <p className="mb-3 text-lg">{s.lab.predictQ}</p>
            <div className="flex flex-wrap gap-2">
              {s.lab.predictOptions.map((opt, i) => (
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

          {/* ٢+٣) جرّبي ولاحظي */}
          <div className="rounded-card bg-white/5 p-4">
            <p className="text-xl font-bold text-gold">{s.lab.tryIt}</p>
            <p className="mt-2 text-xl font-bold text-gold">{s.lab.observe}</p>
            <p className="mt-1 rounded-card border-2 border-teal bg-teal/15 p-3 text-2xl leading-relaxed">{stateText}</p>
            <p className="mt-2 text-white/60">
              {temp <= 0 ? s.lab.freezing : temp >= 100 ? s.lab.boiling : temp > 0 && temp < 30 ? s.lab.melting : ""}
            </p>
          </div>

          {/* ٤) فسّري */}
          <div className="rounded-card bg-white/5 p-4">
            <p className="text-xl font-bold text-gold">{s.lab.explain}</p>
            <p className="mt-1 text-lg text-white/80">{s.lab.explainPrompt}</p>
          </div>

          {/* ٥) استنتجي — لا يظهر إلا بضغطة المعلّمة */}
          <div className="rounded-card bg-white/5 p-4">
            <p className="text-xl font-bold text-gold">{s.lab.conclude}</p>
            {conclusionShown ? (
              <p className="mt-2 rounded-card border-2 border-ok bg-ok/15 p-3 text-xl leading-relaxed">{s.lab.conclusion}</p>
            ) : (
              <button type="button" onClick={() => setConclusionShown(true)} className="btn mt-2 min-h-touch bg-teal px-5 font-bold text-white hover:bg-teal-dark">
                <Eye className="size-5" aria-hidden />
                {s.lab.showConclusion}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={reset} className="btn min-h-touch border-2 border-white/30 bg-transparent px-5 text-white hover:bg-white/10">
              <RotateCcw className="size-5" aria-hidden />
              {s.lab.reset}
            </button>
          </div>

          {/* تباين AA: بلا شفافية على النصوص الصغيرة فوق الخلفية الداكنة */}
          <p className="text-sm text-white/70">{s.lab.homeAlt}</p>
          <p className="text-sm font-medium text-gold">{s.lab.safety}</p>
        </section>
      </main>
    </div>
  );
}
