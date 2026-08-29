/**
 * الصندوق الواحد — الباب الرئيسي للمنصّة (§ الأمر ٨-ب أولاً).
 * تكتب المعلّمة أو تتكلّم (Web Speech API ar-QA)، فيُفهم الأمر **محلياً**
 * (لا يخرج نصّ ولا اسم §2-هـ) ويُرَدّ بإجراء: توليد فوري، أو إجابة، أو فتح الشاشة.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mic, MicOff, Send, Download, ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { parseCommand, type CommandAction, type CmdContext } from "@/lib/commandBox";
import { genWorksheet, genParentReport, genOfficialSheet, genWeakStudents, genVisitFile, type WeakResult } from "@/lib/generate";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

// نوع مبسّط لواجهة التعرّف على الكلام (غير مضمّنة في تعريفات TS القياسية)
type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
function getSpeech(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function CommandBox() {
  const s = useStrings();
  const navigate = useNavigate();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const show = useToast((x) => x.show);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [weak, setWeak] = useState<WeakResult | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const speechSupported = typeof window !== "undefined" && Boolean((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition);

  async function buildContext(): Promise<CmdContext> {
    const [units, lessons, students, classes] = await Promise.all([
      db.units.toArray(),
      db.lessons.toArray(),
      db.students.toArray(),
      db.classes.toArray(),
    ]);
    return {
      units: units.filter((u) => !u.deletedAt).map((u) => ({ id: u.id!, title: u.title, order: u.order })),
      lessons: lessons.filter((l) => !l.deletedAt).map((l) => ({ id: l.id!, title: l.title, unitId: l.unitId, code: l.code })),
      students: students.filter((st) => !st.deletedAt).map((st) => ({ id: st.id!, name: st.name, classId: st.classId })),
      classes: classes.filter((c) => !c.deletedAt).map((c) => ({ id: c.id!, name: c.name })),
    };
  }

  async function run(input?: string) {
    const q = (input ?? text).trim();
    if (!q || busy) return;
    setBusy(true);
    setSuggestions(null);
    setWeak(null);
    try {
      const ctx = await buildContext();
      const action = parseCommand(q, ctx);
      await execute(action);
    } finally {
      setBusy(false);
    }
  }

  async function execute(action: CommandAction) {
    switch (action.kind) {
      case "worksheet":
      case "quiz": {
        const n = await genWorksheet({
          unitId: action.unitId,
          lessonId: action.lessonId,
          count: action.kind === "quiz" ? 5 : 6,
          title: action.kind === "quiz" ? `كويز — ${action.topic}` : undefined,
        });
        if (n === 0) show(s.commandBox.noQuestions, { kind: "danger" });
        else {
          show(s.commandBox.doneWorksheet(fmtNum(n, numerals)));
          setText("");
        }
        return;
      }
      case "parentReport": {
        const ok = await genParentReport(action.studentId);
        if (ok) {
          show(s.commandBox.doneReport(action.studentName));
          setText("");
        } else show(s.commandBox.noStudent, { kind: "danger" });
        return;
      }
      case "officialSheet": {
        const cid = action.classId ?? currentClassId;
        if (!cid) return show(s.commandBox.needClass, { kind: "danger" });
        if (await genOfficialSheet(cid)) {
          show(s.commandBox.doneSheet);
          setText("");
        }
        return;
      }
      case "weakStudents": {
        const res = await genWeakStudents({ classId: action.classId ?? currentClassId ?? undefined, unitId: action.unitId });
        setWeak(res);
        return;
      }
      case "exam":
        show(s.commandBox.openingExam);
        navigate(`/exams/new${action.unitIds.length ? `?units=${action.unitIds.join(",")}&type=${action.examType}` : ""}`);
        return;
      case "certificate":
        show(s.commandBox.openingCerts);
        navigate("/certificates");
        return;
      case "lessonPlan":
        show(s.commandBox.openingPlan);
        navigate("/curriculum");
        return;
      case "requests":
        navigate("/requests");
        return;
      case "visitFile": {
        const cid = action.classId ?? currentClassId;
        if (!cid) return show(s.commandBox.needClass, { kind: "danger" });
        if (await genVisitFile(cid)) show(s.visitFile.done);
        return;
      }
      case "unknown":
        setSuggestions(action.suggestions);
        return;
    }
  }

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getSpeech();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = "ar-QA";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setText(transcript);
      setListening(false);
      void run(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function exportWeakNames() {
    if (!weak) return;
    const lines = ["الاسم,النسبة,التقدير", ...weak.students.map((st) => `${st.name},${st.pct}%,${st.label}`)];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `المتعثّرات-${weak.className ?? "الكل"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card space-y-3 border-2 border-teal/40 bg-gradient-to-l from-teal-bg to-white">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-teal-dark">
        <Sparkles className="size-6" aria-hidden />
        {s.commandBox.title}
      </h2>

      <div className="flex flex-wrap items-stretch gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void run()}
          placeholder={s.commandBox.placeholder}
          aria-label={s.commandBox.title}
          className="min-h-touch flex-1 rounded-card border-2 border-line bg-white px-4 text-lg focus:border-teal focus:outline-none"
          style={{ minWidth: "220px" }}
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? s.commandBox.listening : s.commandBox.listen}
            className={"btn min-w-touch " + (listening ? "bg-maroon text-white" : "border-2 border-line bg-white text-teal-dark")}
          >
            {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
            <span className="max-sm:hidden">{listening ? s.commandBox.listening : s.commandBox.listen}</span>
          </button>
        )}
        <button type="button" onClick={() => void run()} disabled={busy || !text.trim()} className="btn-primary disabled:opacity-50">
          <Send className="size-5" aria-hidden />
          {busy ? s.commandBox.running : s.commandBox.go}
        </button>
      </div>

      <p className="text-sm text-ink-soft">
        {s.commandBox.reviewNote}
        {speechSupported && <> · {s.commandBox.hintVoice}</>}
      </p>

      {/* إجابة: الطالبات المتعثّرات */}
      {weak && (
        <div className="rounded-card border-2 border-gold/50 bg-gold-bg/40 p-3">
          {weak.students.length === 0 ? (
            <p className="font-medium text-teal-dark">{s.commandBox.weakNone}</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-gold-dark">
                  {s.commandBox.weakTitle(fmtNum(weak.students.length, numerals))}
                  {weak.unitName ? ` — ${weak.className ?? ""}` : weak.className ? ` — ${weak.className}` : ""}
                </span>
                <button type="button" onClick={exportWeakNames} className="btn border-2 border-line bg-white px-3 text-ink">
                  <Download className="size-4" aria-hidden />
                  {s.commandBox.exportNames}
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {weak.students.map((st) => (
                  <li key={st.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/students/${st.id}`)}
                      className="flex min-h-touch items-center gap-1 rounded-pill bg-white px-4 py-2 text-ink hover:bg-cream"
                    >
                      {st.name} <span className="text-danger">{fmtNum(st.pct, numerals)}٪</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* أمر غير مفهوم → اقتراحات قابلة للنقر */}
      {suggestions && (
        <div className="rounded-card bg-cream p-3">
          <p className="mb-2 font-medium">{s.commandBox.unknownTitle}</p>
          <ul className="space-y-1">
            {suggestions.map((sug) => (
              <li key={sug}>
                <button type="button" onClick={() => void run(sug)} className="flex min-h-touch w-full items-center gap-2 rounded-card px-3 py-2 text-start text-teal-dark hover:bg-teal-bg">
                  <ArrowLeft className="size-4 shrink-0" aria-hidden />
                  {sug}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
