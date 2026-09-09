/**
 * الشريحة المصمَّمة (صقل زكريت) — نظام بصري واحد لكل السطوح:
 * عرض البروجكتور، معاينة الاستوديو، وشرائح وضع الفصل.
 *
 * عرض فاتح مبهج راقٍ (لا طفولي): سطح أبيض بشريط متدرّج ورمز كبير
 * من محتوى الشريحة، وتكوين مختلف لكل نوع. كل الرسوم كود — لا صور مولّدة.
 * إجابات التفاعل خلف ضغطة المعلّمة دائماً.
 */
import {
  Atom, Cloud, Droplets, Ear, Eye, Flame, FlaskConical, Leaf, Lightbulb,
  Magnet, Snowflake, Sprout, Sun, Thermometer, Wind, Zap,
} from "lucide-react";
import type { VisualSlide } from "@/db/schema";
import { accentFor, emojiFor } from "@/lib/slideEmoji";
import { getBrand } from "@/lib/brand";

/** خريطة الأيقونات المسموحة (تطابق ALLOWED_ICONS في البوابة) */
const ICONS: Record<string, typeof Sun> = {
  droplets: Droplets, "flask-conical": FlaskConical, leaf: Leaf, sun: Sun, cloud: Cloud,
  thermometer: Thermometer, magnet: Magnet, zap: Zap, heart: Sprout, wind: Wind,
  snowflake: Snowflake, flame: Flame, atom: Atom, eye: Eye, ear: Ear, sprout: Sprout,
};

/** خيط السدو — نفس نقش الهوية (repeating-conic) بلا أصول خارجية */
const SADU_STYLE: React.CSSProperties = {
  background:
    "repeating-conic-gradient(from 45deg at 50% 50%, #C08A2E 0 25%, transparent 0 50%) 0 0 / 12px 12px, linear-gradient(to left, #8A1538, #0F6B62)",
};

interface Props {
  slide: VisualSlide;
  /** present = بروجكتور ضخم · preview = بطاقة تحرير مصغّرة */
  variant: "present" | "preview";
  /** ترتيب الشريحة — يحدد اللون المتناوب */
  index?: number;
  /** إظهار إجابة التفاعل (بضغطة المعلّمة) */
  answerRevealed?: boolean;
  /** اسم المدرسة لتذييل الغلاف */
  schoolName?: string;
}

export default function SlideVisual({ slide, variant, index = 0, answerRevealed, schoolName }: Props) {
  const p = variant === "present";
  const accent = accentFor(index);
  const emoji = emojiFor(slide);

  // ═══ الغلاف: دفتر المستكشفة — أرضية فاتحة + رسمة الدرس بولارويد + خيط سدو ═══
  if (slide.layout === "cover") {
    const art = slide.image?.dataUrl;
    return (
      <div className={"relative overflow-hidden rounded-card border-2 border-line bg-cream text-ink " + (p ? "px-10 py-10" : "px-5 py-5")}>
        {/* خيط السدو — توقيع الهوية أعلى الغلاف وأسفله */}
        <div aria-hidden className={"absolute inset-x-0 top-0 " + (p ? "h-3" : "h-1.5")} style={SADU_STYLE} />
        <div aria-hidden className={"absolute inset-x-0 bottom-0 " + (p ? "h-3" : "h-1.5")} style={SADU_STYLE} />
        <div className={"relative flex items-center " + (p ? "gap-10" : "gap-4")}>
          {/* رسمة الدرس — إطار بولارويد مائل بشريط لاصق ذهبي */}
          {art ? (
            <div className={"relative shrink-0 -rotate-2 bg-white shadow-card " + (p ? "p-3 pb-8" : "p-1.5 pb-4")}>
              <span aria-hidden className={"absolute start-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-3 bg-gold/40 " + (p ? "h-5 w-24" : "h-2.5 w-10")} />
              <img src={art} alt="" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")}
                className={"object-cover " + (p ? "size-64 lg:size-72" : "size-24")} />
            </div>
          ) : (
            <span aria-hidden className={"shrink-0 select-none " + (p ? "text-9xl" : "text-5xl")}>{emoji}</span>
          )}
          <div className={"flex-1 text-start " + (p ? "space-y-5" : "space-y-2")}>
            <p className={"flex items-center gap-2 font-kid font-bold text-teal " + (p ? "text-2xl" : "text-xs")}>
              <svg viewBox="0 0 24 24" className={p ? "size-6" : "size-3"} aria-hidden><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M15.5 8.5 13.2 13.2 8.5 15.5 10.8 10.8Z" fill="currentColor"/></svg>
              رحلة اليوم العلمية
            </p>
            <h3 className={"font-kid font-extrabold leading-snug text-maroon " + (p ? "text-6xl lg:text-7xl" : "text-2xl")}>{slide.title}</h3>
            <div className={"rounded-pill bg-gold " + (p ? "h-1.5 w-40" : "h-1 w-20")} aria-hidden />
            <p className={"text-ink-soft " + (p ? "text-2xl" : "text-sm")}>
              {getBrand().subjectName} · المستوى الخامس{schoolName ? ` · ${schoolName}` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══ سطح الشريحة المصمَّم ═══
  return (
    <div className={"relative overflow-hidden rounded-card border-2 border-line bg-white text-ink shadow-card"}>
      {/* شريط الرأس المتدرّج */}
      <div className={"flex items-center gap-3 bg-gradient-to-l px-5 text-white " + accent.band + " " + (p ? "min-h-[84px] py-3" : "min-h-[52px] py-2")}>
        <span aria-hidden className={p ? "text-5xl" : "text-2xl"}>{emoji}</span>
        <h3 className={"font-heading font-bold leading-snug " + (p ? "text-4xl lg:text-5xl" : "text-lg")}>{slide.title}</h3>
      </div>
      {/* زخرفة ركن ناعمة */}
      <span aria-hidden className={"pointer-events-none absolute -bottom-8 -start-8 select-none opacity-[0.06] " + (p ? "text-[10rem]" : "text-6xl")}>{emoji}</span>

      <div className={"relative space-y-4 " + (p ? "p-8" : "p-4")}>
        {/* النقاط — بطاقات بعلامات ملوّنة */}
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className={"space-y-3 text-start " + (p ? "text-3xl leading-relaxed" : "text-sm")}>
            {slide.bullets.map((b, i) => (
              <li key={i} className={"flex items-start gap-3 rounded-card px-4 py-2 " + accent.soft}>
                {slide.layout === "objectives" ? (
                  <span className={"flex shrink-0 items-center justify-center rounded-full bg-gradient-to-bl font-bold text-white " + accent.band + " " + (p ? "mt-1 size-10 text-xl" : "mt-0.5 size-6 text-xs")}>
                    {i + 1}
                  </span>
                ) : (
                  <span className={"mt-2.5 size-3 shrink-0 rounded-full bg-gradient-to-bl " + accent.band} aria-hidden />
                )}
                {b}
              </li>
            ))}
          </ul>
        )}

        {/* مقارنة — جدول مصمَّم */}
        {slide.comparison && (
          <div className="overflow-x-auto rounded-card border-2 border-line">
            <table className={"w-full border-collapse text-center " + (p ? "text-2xl" : "text-sm")}>
              <thead>
                <tr className={"bg-gradient-to-l text-white " + accent.band}>
                  {slide.comparison.headers.map((h, i) => (
                    <th key={i} className={"font-bold " + (p ? "px-4 py-3" : "px-2 py-1.5")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.comparison.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? "bg-cream" : "bg-white"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={"border-t border-line " + (p ? "px-4 py-3" : "px-2 py-1.5") + (ci === 0 ? " font-bold " + accent.text : "")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* دورة — SVG بأسهم */}
        {slide.cycle && <CycleDiagram steps={slide.cycle.steps} present={p} />}

        {/* خطوات — بطاقات متسلسلة مرقّمة */}
        {slide.steps && (
          <ol className={"flex flex-wrap items-stretch justify-center gap-2 " + (p ? "text-2xl" : "text-sm")}>
            {slide.steps.steps.map((st, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={"flex min-h-touch items-center gap-3 rounded-card border-2 px-4 py-2 " + accent.border + " " + accent.soft}>
                  <span className={"flex shrink-0 items-center justify-center rounded-full bg-gradient-to-bl font-bold text-white " + accent.band + " " + (p ? "size-10 text-xl" : "size-6 text-xs")}>
                    {i + 1}
                  </span>
                  {st}
                </span>
                {i < slide.steps!.steps.length - 1 && <span className={"font-bold " + accent.text} aria-hidden>←</span>}
              </li>
            ))}
          </ol>
        )}

        {/* مخطط مُعنون — مركز متوهّج وتسميات موصولة */}
        {slide.labeled && (
          <div className="flex flex-col items-center gap-4">
            <div className={"flex items-center justify-center rounded-full bg-gradient-to-bl text-center font-heading font-bold text-white shadow-bar " + accent.band + " " + (p ? "min-h-36 min-w-36 px-8 text-3xl" : "min-h-20 min-w-20 px-4 text-base")}>
              {slide.labeled.center}
            </div>
            <div className={"h-4 w-0.5 " + accent.soft} aria-hidden />
            <div className={"flex flex-wrap justify-center gap-2 " + (p ? "text-2xl" : "text-sm")}>
              {slide.labeled.labels.map((l, i) => (
                <span key={i} className={"rounded-pill border-2 px-4 py-1.5 font-medium " + accent.border + " " + accent.soft}>{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* أيقونات — بلاطات ملوّنة كبيرة */}
        {slide.icons && (
          <div className={"grid gap-3 " + (p ? "grid-cols-2 text-2xl lg:grid-cols-3" : "grid-cols-2 text-sm")}>
            {slide.icons.items.map((it, i) => {
              const Icon = ICONS[it.icon] ?? Sprout;
              const a = accentFor(index + i);
              return (
                <div key={i} className={"flex items-center gap-3 rounded-card p-3 " + a.soft}>
                  <span className={"flex shrink-0 items-center justify-center rounded-full bg-gradient-to-bl text-white " + a.band + " " + (p ? "size-14" : "size-9")}>
                    <Icon className={p ? "size-8" : "size-5"} aria-hidden />
                  </span>
                  {it.text}
                </div>
              );
            })}
          </div>
        )}

        {/* صورة توليدية معتمَدة — من محتوى الوزارة، بلا نص داخلها */}
        {slide.image?.dataUrl && (
          <img
            src={slide.image.dataUrl}
            alt={slide.image.prompt}
            className={"mx-auto w-full rounded-card border-2 border-line object-cover " + (p ? "max-h-80 max-w-2xl" : "max-h-32 max-w-xs")}
          />
        )}

        {/* رسم بياني — SVG بقواعد dataviz (تسميات مباشرة، ألوان الهوية) */}
        {slide.chart && slide.chart.items.length > 0 && (
          slide.chart.kind === "pie"
            ? <PieChart items={slide.chart.items} unit={slide.chart.unit} present={p} />
            : <BarsChart items={slide.chart.items} unit={slide.chart.unit} present={p} />
        )}

        {/* تفاعل — بطاقة تحدٍّ بارزة */}
        {slide.interaction && (
          <div className="overflow-hidden rounded-card border-2 border-gold">
            <p className={"flex items-center gap-2 bg-gradient-to-l from-gold to-gold-dark font-bold text-white " + (p ? "px-5 py-2 text-xl" : "px-3 py-1 text-xs")}>
              <span aria-hidden>{slide.interaction.kind === "predict" ? "🔮" : slide.interaction.kind === "challenge" ? "🏆" : "🤔"}</span>
              {slide.interaction.kind === "predict" ? "توقّعن!" : slide.interaction.kind === "challenge" ? "تحدٍّ!" : "سؤال!"}
            </p>
            <div className={"space-y-3 bg-gold-bg " + (p ? "p-5" : "p-3")}>
              <p className={"font-bold text-ink " + (p ? "text-3xl leading-relaxed" : "text-sm")}>{slide.interaction.prompt}</p>
              {answerRevealed ? (
                <p className={"flex items-start gap-2 rounded-card border-2 border-ok bg-white p-3 " + (p ? "text-2xl" : "text-sm")}>
                  <Lightbulb className={"mt-1 shrink-0 text-ok " + (p ? "size-7" : "size-4")} aria-hidden />
                  {slide.interaction.answer}
                </p>
              ) : (
                !p && <p className="text-xs text-ink-soft">الإجابة (تظهر بضغطة في العرض): {slide.interaction.answer}</p>
              )}
            </div>
          </div>
        )}

        {/* المصدر — شارة صغيرة */}
        {slide.source && (
          <p className={"inline-block rounded-pill bg-cream px-3 py-1 text-start text-ink-soft " + (p ? "text-base" : "text-[11px]")}>
            📚 {slide.source}
          </p>
        )}
      </div>
    </div>
  );
}

/** ألوان الفئات — لوحة هوية محدودة يمكن تمييزها (dataviz) */
const CHART_COLORS = ["#0F6B62", "#C08A2E", "#8A1538", "#2E7D4F", "#1E3A5F", "#7A5716"];

/** أعمدة: لون واحد تركوازي، قيم مباشرة بلون الحبر، أطراف مدوّرة، RTL */
function BarsChart({ items, unit, present }: { items: { label: string; value: number }[]; unit?: string; present: boolean }) {
  const W = 640, H = 300, padTop = 34, padBottom = 46;
  const plotH = H - padTop - padBottom;
  const max = Math.max(...items.map((d) => d.value), 1);
  const slot = W / items.length;
  const barW = Math.min(72, slot - 18);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={items.map((d) => `${d.label}: ${d.value}${unit ?? ""}`).join(" · ")}
      className={"mx-auto w-full " + (present ? "max-w-2xl" : "max-w-sm")}>
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={8} x2={W - 8} y1={padTop + plotH * (1 - t)} y2={padTop + plotH * (1 - t)} stroke="#E9E0D2" strokeWidth="1" />
      ))}
      {items.map((d, i) => {
        const h = Math.max(4, (d.value / max) * plotH);
        const x = W - (i + 0.5) * slot - barW / 2; // RTL: الأول يميناً
        const y = padTop + plotH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={8} fill="#0F6B62" />
            <rect x={x} y={y + Math.min(10, h)} width={barW} height={Math.max(0, h - 10)} fill="#0F6B62" />
            <text x={x + barW / 2} y={y - 8} textAnchor="middle" fill="#1E2430" fontWeight="bold" fontSize={present ? 19 : 15} fontFamily="Tajawal, sans-serif">
              {d.value}{unit ?? ""}
            </text>
            <text x={x + barW / 2} y={H - 16} textAnchor="middle" fill="#4A5568" fontSize={present ? 17 : 13} fontFamily="Tajawal, sans-serif">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** دائري: شرائح مرتّبة تنازلياً بألوان الهوية وتسميات مباشرة بنسبها */
function PieChart({ items, unit, present }: { items: { label: string; value: number }[]; unit?: string; present: boolean }) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 6);
  const total = sorted.reduce((s, d) => s + d.value, 0) || 1;
  const size = 300, c = size / 2, r = 108;
  let angle = -Math.PI / 2;
  const slices = sorted.map((d, i) => {
    const frac = d.value / total;
    const a0 = angle;
    const a1 = (angle += frac * Math.PI * 2);
    const large = frac > 0.5 ? 1 : 0;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    const mid = (a0 + a1) / 2;
    return { d, i, path: `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`, mid, pct: Math.round(frac * 100) };
  });
  return (
    <div className={"mx-auto flex flex-wrap items-center justify-center gap-6 " + (present ? "" : "gap-3")}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={sorted.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}٪`).join(" · ")}
        className={present ? "w-64" : "w-36"}>
        {slices.map((s) => (
          <path key={s.i} d={s.path} fill={CHART_COLORS[s.i % CHART_COLORS.length]} stroke="#fff" strokeWidth="3" />
        ))}
        {slices.filter((s) => s.pct >= 8).map((s) => (
          <text key={"t" + s.i} x={c + r * 0.62 * Math.cos(s.mid)} y={c + r * 0.62 * Math.sin(s.mid)} textAnchor="middle" dominantBaseline="middle"
            fill="#fff" fontWeight="bold" fontSize={present ? 20 : 15} fontFamily="Tajawal, sans-serif">{s.pct}٪</text>
        ))}
      </svg>
      <ul className={"space-y-2 text-start " + (present ? "text-2xl" : "text-xs")}>
        {slices.map((s) => (
          <li key={s.i} className="flex items-center gap-2">
            <span className="inline-block size-4 shrink-0 rounded" style={{ background: CHART_COLORS[s.i % CHART_COLORS.length] }} aria-hidden />
            <span className="font-medium">{s.d.label}</span>
            <span className="text-ink-soft">{s.d.value}{unit ?? ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** رسم الدورة: عقد على دائرة وأسهم منحنية — SVG خالص بتسميات عربية */
function CycleDiagram({ steps, present }: { steps: string[]; present: boolean }) {
  const n = Math.max(steps.length, 2);
  const size = 420;
  const c = size / 2;
  const r = size / 2 - 70;
  const nodes = steps.map((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { label, x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };
  });
  const stroke = "#0F6B62";
  const nodeFill = "#E6F2F0";
  const text = "#1E2430";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={steps.join(" ثم ")} className={"mx-auto w-full " + (present ? "max-w-lg" : "max-w-xs")}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#C08A2E" />
        </marker>
      </defs>
      {nodes.map((node, i) => {
        const next = nodes[(i + 1) % n];
        const dx = next.x - node.x;
        const dy = next.y - node.y;
        const len = Math.hypot(dx, dy);
        const t0 = 62 / len;
        const t1 = 1 - 62 / len;
        const x1 = node.x + dx * t0, y1 = node.y + dy * t0;
        const x2 = node.x + dx * t1, y2 = node.y + dy * t1;
        const mx = (x1 + x2) / 2 + (c - (x1 + x2) / 2) * -0.25;
        const my = (y1 + y2) / 2 + (c - (y1 + y2) / 2) * -0.25;
        return <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke="#C08A2E" strokeWidth="3.5" markerEnd="url(#arr)" />;
      })}
      {nodes.map((node, i) => (
        <g key={i}>
          <circle cx={node.x} cy={node.y} r="52" fill={nodeFill} stroke={stroke} strokeWidth="3" />
          <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle" fill={text} fontSize={present ? 17 : 15} fontWeight="bold" fontFamily="Tajawal, sans-serif">
            {wrapSvgText(node.label, 10).map((line, li, arr) => (
              <tspan key={li} x={node.x} dy={li === 0 ? `${-(arr.length - 1) * 0.55}em` : "1.1em"}>{line}</tspan>
            ))}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** لفّ نص عربي قصير على سطور داخل عقدة SVG */
function wrapSvgText(label: string, maxChars: number): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
