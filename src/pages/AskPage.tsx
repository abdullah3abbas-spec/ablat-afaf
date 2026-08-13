/**
 * «اسألي المنهج» (زكريت م٢ — جزء «اسألي المنهج» من الاستوديو):
 * سؤال عربي حرّ + مصادر تختارها المعلّمة (دروس المكتبة أو ملفاتها المرفوعة)
 * → شاشة «ما سيُرسل» الإلزامية (§2-هـ) → إجابة موثّقة بالمصدر.
 *
 * لا يُرسل حرف واحد غير ما اختارته وشاهدته — والأسئلة بلا أسماء طالبات
 * (حارس الأسماء يوقف أي تسرّب قبل الإرسال).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, FolderOpen, MessageCircleQuestion, PlugZap, Send, Sparkles } from "lucide-react";
import { db } from "@/db";
import { ALL_KITS } from "@/content/lessonKits";
import { askCurriculum, AiClientError, type AskResult, type AskSource } from "@/lib/aiClient";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";
import LibraryTabs from "@/components/LibraryTabs";
import SendPreviewDialog from "@/components/SendPreviewDialog";

/** نص درس جاهز من المكتبة — الشرائح مرقّمة ليستشهد النموذج بها */
function kitSourceText(kit: (typeof ALL_KITS)[number]): string {
  const lines: string[] = [];
  kit.slides.forEach((sl, i) => {
    lines.push(`شريحة ${i + 1}: ${sl.title} — ${sl.bullets.join(" · ")}`);
  });
  kit.worksheet.forEach((q, i) => {
    lines.push(`سؤال ورقة العمل ${i + 1}: ${q.text} (الإجابة: ${q.answer})`);
  });
  return lines.join("\n");
}

/** قصّ نص طويل بحد آمن — حدود البوابة أكبر، هذا حدّ لطف بالميزانية */
const MAX_SOURCE_CHARS = 20_000;
function clip(text: string): string {
  return text.length > MAX_SOURCE_CHARS ? text.slice(0, MAX_SOURCE_CHARS) + "\n…(اقتُطع الباقي)" : text;
}

export default function AskPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const show = useToast((x) => x.show);

  const settings = useLiveQuery(() => db.settings.get(1));
  const aiOn = settings?.aiConnectionEnabled ?? false;

  const fileSources = useLiveQuery(async () =>
    (await db.resources.toArray()).filter((r) => !r.deletedAt && (r.searchText?.trim() || r.extractedSlides?.length))
  );

  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ content: string; sources: AskSource[]; mode: "brief" | "detailed" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [errorAr, setErrorAr] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** يبني المصادر الفعلية من الاختيارات */
  function buildSources(): AskSource[] {
    const out: AskSource[] = [];
    for (const key of selected) {
      if (key.startsWith("k:")) {
        const kit = ALL_KITS.find((k) => k.lessonTitle === key.slice(2));
        if (kit) out.push({ name: `درس «${kit.lessonTitle}»`, text: clip(kitSourceText(kit)), locator: "حزمة الدرس" });
      } else if (key.startsWith("r:")) {
        const r = (fileSources ?? []).find((x) => String(x.id) === key.slice(2));
        if (r) {
          const text = r.extractedSlides?.length
            ? r.extractedSlides.map((t, i) => `شريحة/صفحة ${i + 1}: ${t}`).join("\n")
            : (r.searchText ?? "");
          out.push({ name: r.title || r.fileName || "ملف مرفوع", text: clip(text) });
        }
      }
    }
    return out;
  }

  function openPreview(mode: "brief" | "detailed") {
    setErrorAr(null);
    const q = question.trim();
    if (!q) {
      show(s.ask.noQuestion, { kind: "info" });
      return;
    }
    const sources = buildSources();
    if (sources.length === 0) {
      show(s.ask.noSources, { kind: "info" });
      return;
    }
    // المحتوى المعروض في «ما سيُرسل» = الحمولة الفعلية نصاً
    const content = [`السؤال: ${q}`, "", ...sources.map((src) => `— المصدر: ${src.name}\n${src.text}`)].join("\n");
    setPreview({ content, sources, mode });
  }

  async function sendApproved(sendLogId: number) {
    if (!preview) return;
    setPreview(null);
    setBusy(true);
    setResult(null);
    try {
      const r = await askCurriculum(question.trim(), preview.sources, preview.mode);
      setResult(r);
      await db.aiSendLog.update(sendLogId, {
        status: "sent",
        note: `${r.provider} · ${r.model} · ~${r.costUsd}$${r.cached ? " · من الكاش" : ""}`,
      });
    } catch (e) {
      const msg = e instanceof AiClientError ? e.messageAr : s.errors.generic;
      setErrorAr(msg);
      await db.aiSendLog.update(sendLogId, { status: "failed", note: msg });
    } finally {
      setBusy(false);
    }
  }

  const kits = ALL_KITS;

  return (
    <div className="space-y-5">
      <LibraryTabs />

      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <MessageCircleQuestion className="size-7" aria-hidden />
          {s.ask.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.ask.subtitle}</p>
      </div>

      {!aiOn && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-2 border-gold bg-gold-bg">
          <p className="font-medium text-gold-dark">{s.ask.offNotice}</p>
          <Link to="/settings" className="btn-secondary">
            <PlugZap className="size-5" aria-hidden />
            {s.ask.openSettings}
          </Link>
        </div>
      )}

      {/* السؤال */}
      <section className="card space-y-3">
        <label htmlFor="ask-q" className="font-heading text-xl font-bold">
          {s.ask.question}
        </label>
        <textarea
          id="ask-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={s.ask.placeholder}
          rows={3}
          className="w-full rounded-card border-2 border-line p-3 focus:border-teal"
        />
        <div>
          <p className="mb-2 text-sm text-ink-soft">{s.ask.quickTitle}:</p>
          <div className="flex flex-wrap gap-2">
            {s.ask.quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestion(q)}
                className="min-h-touch rounded-pill border-2 border-line bg-white px-3 font-medium text-ink-soft transition-colors hover:border-teal hover:bg-teal-bg hover:text-teal-dark"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* المصادر */}
      <section className="card space-y-3">
        <h2 className="font-heading text-xl font-bold">{s.ask.sources}</h2>
        <p className="text-sm text-ink-soft">{s.ask.sourcesHint}</p>

        <p className="flex items-center gap-2 font-bold text-teal-dark">
          <BookOpen className="size-5" aria-hidden />
          {s.ask.lessonGroup}
        </p>
        <div className="flex flex-wrap gap-2">
          {kits.map((k) => {
            const key = `k:${k.lessonTitle}`;
            const on = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={
                  "min-h-touch rounded-pill border-2 px-3 font-medium transition-colors " +
                  (on ? "border-teal bg-teal text-white" : "border-line bg-white text-ink-soft hover:border-teal hover:bg-teal-bg")
                }
              >
                {k.lessonTitle}
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center gap-2 font-bold text-teal-dark">
          <FolderOpen className="size-5" aria-hidden />
          {s.ask.fileGroup}
        </p>
        {fileSources === undefined ? (
          <p className="text-ink-soft">{s.common.loading}</p>
        ) : fileSources.length === 0 ? (
          <p className="text-ink-soft">{s.ask.noFileSources}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fileSources.map((r) => {
              const key = `r:${r.id}`;
              const on = selected.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  className={
                    "min-h-touch rounded-pill border-2 px-3 font-medium transition-colors " +
                    (on ? "border-teal bg-teal text-white" : "border-line bg-white text-ink-soft hover:border-teal hover:bg-teal-bg")
                  }
                >
                  {r.title || r.fileName}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* التنفيذ */}
      <button
        type="button"
        onClick={() => openPreview("brief")}
        disabled={busy || !aiOn}
        className="btn-primary w-full min-h-[56px] text-lg disabled:opacity-50"
      >
        <Send className="size-6" aria-hidden />
        {busy ? s.common.loading : s.ask.run}
      </button>

      {errorAr && (
        <p role="alert" className="card border-2 border-danger bg-danger-bg font-medium text-danger">
          {errorAr}
        </p>
      )}

      {/* الإجابة */}
      {result && (
        <section className="card space-y-3 border-2 border-teal">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-teal-dark">
              <Sparkles className="size-6" aria-hidden />
              {s.ask.answerTitle}
            </h2>
            {result.cached && (
              <span className="rounded-pill bg-teal-bg px-3 py-1 font-medium text-teal-dark">{s.ask.cachedBadge}</span>
            )}
          </div>
          <div className="whitespace-pre-wrap rounded-card bg-cream p-4 leading-relaxed">{result.answer}</div>
          <p className="text-sm text-ink-soft">
            {s.ask.providerLine(s.ask.providers[result.provider], fmtNum(result.costUsd, numerals))}
          </p>
          {result.alert >= 60 && (
            <p className="rounded-card bg-gold-bg px-3 py-2 font-medium text-gold-dark">
              {s.ask.alertLine(fmtNum(result.alert, numerals))}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => openPreview("detailed")} disabled={busy} className="btn-secondary disabled:opacity-50">
              {s.ask.detailed}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setQuestion("");
              }}
              className="btn border-2 border-line bg-white text-ink"
            >
              {s.ask.again}
            </button>
          </div>
        </section>
      )}

      {preview && (
        <SendPreviewDialog
          kind="ask"
          title={`سؤال المنهج: ${question.trim().slice(0, 60)}`}
          content={preview.content}
          onApproved={(id) => void sendApproved(id)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
