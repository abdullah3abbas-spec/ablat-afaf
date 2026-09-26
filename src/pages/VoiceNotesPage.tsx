/**
 * ملاحظات ما بعد الحصة صوتياً (§2-ز): تتكلم المعلّمة دقيقة بالعامية،
 * فتُستخرج محلياً (نجوم · متابعة · مهام) وتُعرض للاعتماد — لا يُحفظ
 * شيء قبل ضغطة «اعتمدي». التفريغ عبر خدمة المتصفح (الشاشة تنبّه)،
 * والاستخراج كله على الجهاز لأن الكلام فيه أسماء طالبات.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Home as HomeIcon, Mic, MicOff, Sparkles, Star, Trash2, UserRound, Wand2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { activeStudentsOf } from "@/lib/students";
import { awardPoints } from "@/lib/points";
import { extractFromTranscript, type ExtractedItem } from "@/lib/voiceNotes";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";
import { useToast } from "@/store/toast";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};
function getSpeech(): SpeechRec | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

interface ReviewItem extends ExtractedItem {
  key: number;
  checked: boolean;
}

export default function VoiceNotesPage() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const currentClassId = useUi((x) => x.currentClassId);
  const setCurrentClassId = useUi((x) => x.setCurrentClass);
  const show = useToast((x) => x.show);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const classId = currentClassId ?? classes?.[0]?.id ?? 0;
  const roster = useLiveQuery(async () => (classId ? await activeStudentsOf(classId) : []), [classId]);

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef("");
  const speechSupported = typeof window !== "undefined" && Boolean(getSpeech());

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getSpeech();
    if (!rec) return;
    rec.lang = "ar-QA";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = text ? text.trim() + "\n" : "";
    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + "\n";
        else interim += r[0].transcript;
      }
      setText((baseRef.current + final + interim).trimStart());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function extract() {
    recRef.current?.stop();
    const found = extractFromTranscript(text, (roster ?? []).map((st) => ({ id: st.id!, name: st.name })));
    setItems(found.map((it, i) => ({ ...it, key: i, checked: true })));
    if (found.length === 0) show(s.voiceNotes.nothingFound, { kind: "info" });
  }

  function patch(key: number, ch: Partial<ReviewItem>) {
    setItems((list) => list!.map((it) => (it.key === key ? { ...it, ...ch } : it)));
  }

  async function approve() {
    if (!items) return;
    const now = Date.now();
    let stars = 0, follows = 0, tasks = 0;
    for (const it of items) {
      if (!it.checked) continue;
      if (it.kind === "star" && it.studentId) {
        const st = (roster ?? []).find((x) => x.id === it.studentId);
        if (!st) continue;
        await awardPoints({ id: st.id, classId: st.classId }, { points: it.stars ?? 1, nameAr: s.voiceNotes.starReason }, { reason: it.text, source: "manual", atMs: now });
        stars++;
      } else if (it.kind === "follow" && it.studentId) {
        await db.behaviorNotes.add({ studentId: it.studentId, date: now, text: it.text, tone: "concern", createdAt: now });
        follows++;
      } else if (it.kind === "task") {
        await db.requests.add({ type: "other", title: it.text.slice(0, 80), description: it.text, status: "new", createdAt: now });
        tasks++;
      }
    }
    setItems(null);
    setText("");
    show(s.voiceNotes.approved(fmtNum(stars, numerals), fmtNum(follows, numerals), fmtNum(tasks, numerals)));
  }

  const kindMeta = useMemo(
    () => ({
      star: { label: s.voiceNotes.kinds.star, icon: Star, cls: "border-gold bg-gold-bg text-gold-dark" },
      follow: { label: s.voiceNotes.kinds.follow, icon: UserRound, cls: "border-danger/60 bg-danger-bg text-danger" },
      task: { label: s.voiceNotes.kinds.task, icon: BadgeCheck, cls: "border-teal bg-teal-bg text-teal-dark" },
    }),
    [s]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
            <Mic className="size-7" aria-hidden />
            {s.voiceNotes.title}
          </h1>
          <p className="mt-1 text-ink-soft">{s.voiceNotes.subtitle}</p>
        </div>
        <Link to="/teach" className="btn-secondary">
          <HomeIcon className="size-5" aria-hidden />
          {s.common.back}
        </Link>
      </div>

      {/* الفصل */}
      <div className="flex flex-wrap gap-2">
        {(classes ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCurrentClassId(c.id!)}
            className={"rounded-pill border-2 px-4 py-2 font-bold min-h-[48px] " + (c.id === classId ? "border-teal bg-teal text-white" : "border-line bg-white hover:border-teal")}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* التسجيل والكتابة */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {speechSupported && (
            <button
              type="button"
              onClick={toggleMic}
              className={"btn min-h-[56px] px-6 text-lg font-bold " + (listening ? "bg-danger text-white motion-safe:animate-pulse" : "btn-primary")}
            >
              {listening ? <MicOff className="size-6" aria-hidden /> : <Mic className="size-6" aria-hidden />}
              {listening ? s.voiceNotes.stop : s.voiceNotes.record}
            </button>
          )}
          <button type="button" onClick={extract} disabled={!text.trim()} className="btn-secondary min-h-[56px] px-6 text-lg disabled:opacity-50">
            <Wand2 className="size-6" aria-hidden />
            {s.voiceNotes.extract}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={s.voiceNotes.placeholder}
          className="w-full rounded-card border-2 border-line p-3 text-lg leading-relaxed focus:border-teal focus:outline-none"
        />
        <p className="text-sm text-ink-soft">🔒 {s.voiceNotes.privacy}</p>
      </section>

      {/* المراجعة والاعتماد */}
      {items && items.length > 0 && (
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
            <Sparkles className="size-6 text-gold-dark" aria-hidden />
            {s.voiceNotes.reviewTitle(fmtNum(items.length, numerals))}
          </h2>
          <ul className="space-y-2">
            {items.map((it) => {
              const m = kindMeta[it.kind];
              return (
                <li key={it.key} className={"flex flex-wrap items-center gap-3 rounded-card border-2 p-3 " + m.cls + (it.checked ? "" : " opacity-45")}>
                  <input
                    type="checkbox"
                    checked={it.checked}
                    onChange={(e) => patch(it.key, { checked: e.target.checked })}
                    className="size-6 accent-teal"
                    aria-label={s.voiceNotes.includeItem}
                  />
                  <m.icon className="size-6 shrink-0" aria-hidden />
                  <span className="rounded-pill bg-white/70 px-3 py-0.5 text-sm font-bold">
                    {m.label}
                    {it.kind === "star" && it.stars ? ` ×${fmtNum(it.stars, numerals)}` : ""}
                  </span>
                  <span className="me-auto min-w-40 flex-1">{it.text}</span>
                  {it.kind !== "task" && (
                    <select
                      value={it.studentId ?? ""}
                      onChange={(e) => patch(it.key, { studentId: Number(e.target.value) || undefined })}
                      className="min-h-[44px] rounded-card border-2 border-line bg-white px-2"
                      aria-label={s.voiceNotes.pickStudent}
                    >
                      <option value="">{s.voiceNotes.pickStudent}</option>
                      {(roster ?? []).map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => setItems((l) => l!.filter((x) => x.key !== it.key))} className="text-ink-soft hover:text-danger" aria-label={s.common.delete}>
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => void approve()} className="btn-primary min-h-[56px] w-full text-lg">
            <BadgeCheck className="size-6" aria-hidden />
            {s.voiceNotes.approve}
          </button>
        </section>
      )}
    </div>
  );
}
