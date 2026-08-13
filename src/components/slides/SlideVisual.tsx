/**
 * عارض الشريحة البصرية (زكريت م٣) — كل الرسوم SVG/CSS مبنية من البيانات:
 * لا صور مولّدة قد تقدّم حقيقة خاطئة (قاعدة الماستر برومبت)، وكل التسميات
 * عربية والأسهم باتجاه صحيح. يعمل بحجمين: معاينة التحرير وعرض البروجكتور.
 */
import {
  Atom, Cloud, Droplets, Ear, Eye, Flame, FlaskConical, HelpCircle, Leaf, Lightbulb,
  Magnet, Snowflake, Sprout, Sun, Thermometer, Wind, Zap,
} from "lucide-react";
import type { VisualSlide } from "@/db/schema";

/** خريطة الأيقونات المسموحة (تطابق ALLOWED_ICONS في البوابة) */
const ICONS: Record<string, typeof Sun> = {
  droplets: Droplets, "flask-conical": FlaskConical, leaf: Leaf, sun: Sun, cloud: Cloud,
  thermometer: Thermometer, magnet: Magnet, zap: Zap, heart: Sprout, wind: Wind,
  snowflake: Snowflake, flame: Flame, atom: Atom, eye: Eye, ear: Ear, sprout: Sprout,
};

interface Props {
  slide: VisualSlide;
  /** present = بروجكتور داكن ضخم · preview = بطاقة تحرير فاتحة */
  variant: "present" | "preview";
  /** إظهار إجابة الشريحة التفاعلية (البروجكتور فقط، بضغطة المعلّمة) */
  answerRevealed?: boolean;
}

export default function SlideVisual({ slide, variant, answerRevealed }: Props) {
  const present = variant === "present";
  const accent = present ? "text-gold" : "text-teal-dark";
  const box = present ? "border-white/25 bg-white/5" : "border-line bg-white";
  const soft = present ? "text-white/70" : "text-ink-soft";

  return (
    <div className={"space-y-4 " + (present ? "text-white" : "text-ink")}>
      {/* العنوان */}
      <h3
        className={
          "font-heading font-bold leading-snug " +
          (present
            ? slide.layout === "cover"
              ? "text-6xl text-gold lg:text-7xl"
              : "text-4xl lg:text-5xl"
            : "text-xl")
        }
      >
        {slide.title}
      </h3>

      {/* النقاط */}
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className={"space-y-2 text-start " + (present ? "text-3xl leading-relaxed" : "text-base")}>
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={"mt-2.5 size-2.5 shrink-0 rounded-full " + (present ? "bg-gold" : "bg-teal")} aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}

      {/* مقارنة — جدول عام بأي عدد أعمدة */}
      {slide.comparison && (
        <div className="overflow-x-auto">
          <table className={"w-full border-collapse text-start " + (present ? "text-2xl" : "text-sm")}>
            <thead>
              <tr>
                {slide.comparison.headers.map((h, i) => (
                  <th key={i} className={"border-2 p-2 text-center font-bold " + (present ? "border-white/25 bg-white/10 text-gold" : "border-line bg-teal text-white")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.comparison.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={"border-2 p-2 text-center " + (present ? "border-white/25" : "border-line")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* دورة — عقد على دائرة بأسهم SVG */}
      {slide.cycle && <CycleDiagram steps={slide.cycle.steps} present={present} />}

      {/* خطوات مرتبة — أسهم متسلسلة RTL */}
      {slide.steps && (
        <ol className={"flex flex-wrap items-stretch gap-2 " + (present ? "text-2xl" : "text-sm")}>
          {slide.steps.steps.map((st, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={"flex min-h-touch items-center gap-2 rounded-card border-2 px-3 py-2 " + box}>
                <b className={accent}>{i + 1}</b> {st}
              </span>
              {i < slide.steps!.steps.length - 1 && <span className={accent} aria-hidden>←</span>}
            </li>
          ))}
        </ol>
      )}

      {/* مخطط مُعنون — مفهوم مركزي وتسميات حوله */}
      {slide.labeled && (
        <div className="flex flex-col items-center gap-3">
          <div className={"rounded-full border-4 px-8 py-6 text-center font-bold " + (present ? "border-gold text-3xl" : "border-teal text-lg")}>
            {slide.labeled.center}
          </div>
          <div className={"flex flex-wrap justify-center gap-2 " + (present ? "text-2xl" : "text-sm")}>
            {slide.labeled.labels.map((l, i) => (
              <span key={i} className={"rounded-pill border-2 px-4 py-1 " + box}>{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* أيقونات */}
      {slide.icons && (
        <div className={"grid gap-3 " + (present ? "grid-cols-2 text-2xl lg:grid-cols-3" : "grid-cols-2 text-sm")}>
          {slide.icons.items.map((it, i) => {
            const Icon = ICONS[it.icon] ?? Sprout;
            return (
              <div key={i} className={"flex items-center gap-3 rounded-card border-2 p-3 " + box}>
                <Icon className={"shrink-0 " + accent + " " + (present ? "size-10" : "size-6")} aria-hidden />
                {it.text}
              </div>
            );
          })}
        </div>
      )}

      {/* تفاعل — السؤال ظاهر والإجابة خلف ضغطة المعلّمة */}
      {slide.interaction && (
        <div className={"space-y-3 rounded-card border-2 p-4 " + (present ? "border-gold bg-gold/10" : "border-gold bg-gold-bg")}>
          <p className={"flex items-start gap-2 font-bold " + (present ? "text-3xl" : "text-base")}>
            <HelpCircle className={"mt-1 shrink-0 " + (present ? "size-8 text-gold" : "size-5 text-gold-dark")} aria-hidden />
            {slide.interaction.prompt}
          </p>
          {answerRevealed ? (
            <p className={"flex items-start gap-2 rounded-card p-3 " + (present ? "bg-ok/20 text-2xl" : "bg-white text-sm")}>
              <Lightbulb className={"mt-0.5 shrink-0 " + (present ? "size-7 text-gold" : "size-5 text-gold-dark")} aria-hidden />
              {slide.interaction.answer}
            </p>
          ) : (
            !present && <p className={"text-sm " + soft}>الإجابة (تظهر بضغطة في العرض): {slide.interaction.answer}</p>
          )}
        </div>
      )}

      {/* المصدر */}
      {slide.source && <p className={"text-start " + soft + " " + (present ? "text-lg" : "text-xs")}>المصدر: {slide.source}</p>}
    </div>
  );
}

/** رسم الدورة: عقد موزّعة على دائرة وأسهم منحنية بينها — SVG خالص */
function CycleDiagram({ steps, present }: { steps: string[]; present: boolean }) {
  const n = Math.max(steps.length, 2);
  const size = 420;
  const c = size / 2;
  const r = size / 2 - 70;
  const nodes = steps.map((label, i) => {
    // نبدأ من الأعلى وندور مع عقارب الساعة (اتجاه القراءة الطبيعي للدورات)
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { label, x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };
  });
  const stroke = present ? "#C08A2E" : "#0F6B62";
  const fill = present ? "rgba(255,255,255,.08)" : "#FFFFFF";
  const text = present ? "#FFFFFF" : "#1E2430";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={steps.join(" ثم ")} className="mx-auto w-full max-w-md">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      {/* أقواس بين العقد */}
      {nodes.map((node, i) => {
        const next = nodes[(i + 1) % n];
        // نقصّر القوس كي لا يدخل تحت العقدة
        const dx = next.x - node.x;
        const dy = next.y - node.y;
        const len = Math.hypot(dx, dy);
        const t0 = 62 / len;
        const t1 = 1 - 62 / len;
        const x1 = node.x + dx * t0, y1 = node.y + dy * t0;
        const x2 = node.x + dx * t1, y2 = node.y + dy * t1;
        const mx = (x1 + x2) / 2 + (c - (x1 + x2) / 2) * -0.25;
        const my = (y1 + y2) / 2 + (c - (y1 + y2) / 2) * -0.25;
        return <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={stroke} strokeWidth="3" markerEnd="url(#arr)" />;
      })}
      {/* العقد */}
      {nodes.map((node, i) => (
        <g key={i}>
          <circle cx={node.x} cy={node.y} r="52" fill={fill} stroke={stroke} strokeWidth="3" />
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
