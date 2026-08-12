/**
 * أدوات الصف والمتعة (§ الأمر ٧): كويز مراجعة من البنك، عجلة اختيار
 * عادلة، مؤقّت نشاط، وتقسيم مجموعات — كلها للعرض على شاشة الصف.
 */
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Dice5, Gamepad2, Play, RotateCcw, Timer as TimerIcon, Users } from "lucide-react";
import { db } from "@/db";
import type { Question } from "@/db/schema";
import { absentTodayIds, classPickables, fairPick, makeGroups, type Pickable } from "@/lib/funTools";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

type Tab = "quiz" | "wheel" | "timer" | "groups";

export default function ToolsPage() {
  const s = useStrings();
  const currentClassId = useUi((x) => x.currentClassId);
  const [tab, setTab] = useState<Tab>("quiz");
  const [classId, setClassId] = useState(0);

  useEffect(() => {
    if (!classId && currentClassId) setClassId(currentClassId);
  }, [currentClassId, classId]);

  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));

  const tabs: { key: Tab; label: string; icon: typeof Gamepad2 }[] = [
    { key: "quiz", label: s.tools.tabs.quiz, icon: Gamepad2 },
    { key: "wheel", label: s.tools.tabs.wheel, icon: Dice5 },
    { key: "timer", label: s.tools.tabs.timer, icon: TimerIcon },
    { key: "groups", label: s.tools.tabs.groups, icon: Users },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-maroon">
          <Gamepad2 className="size-7" aria-hidden />
          {s.tools.title}
        </h1>
        <p className="mt-1 text-ink-soft">{s.tools.subtitle}</p>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-medium">{s.tools.pickClass}:</span>
          <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal">
            <option value={0}>—</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={"btn " + (tab === t.key ? "bg-maroon text-white" : "border-2 border-line bg-white text-ink hover:border-maroon")}>
            <t.icon className="size-5" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "quiz" && <QuizTool />}
      {tab === "wheel" && <WheelTool classId={classId} />}
      {tab === "timer" && <TimerTool />}
      {tab === "groups" && <GroupsTool classId={classId} />}
    </div>
  );
}

/** كويز مراجعة تفاعلي بمؤقّت ونقاط فورية */
function QuizTool() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [unitId, setUnitId] = useState(0);
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(20);

  const units = useLiveQuery(async () => (await db.units.toArray()).filter((u) => !u.deletedAt).sort((a, b) => a.order - b.order));

  useEffect(() => {
    if (!questions || revealed || idx >= questions.length) return;
    if (seconds <= 0) { setRevealed(true); return; }
    const t = setTimeout(() => setSeconds((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [questions, idx, seconds, revealed]);

  async function start() {
    const all = (await db.questions.toArray()).filter((q) => !q.deletedAt && (!unitId || q.unitId === unitId));
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, count);
    setQuestions(shuffled.length ? shuffled : []);
    setIdx(0);
    setScore(0);
    setRevealed(false);
    setSeconds(20);
  }

  if (!questions) {
    return (
      <section className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1"><span className="font-medium">{s.tools.quiz.pickUnit}</span>
            <select value={unitId} onChange={(e) => setUnitId(Number(e.target.value))} className="min-h-touch rounded-card border-2 border-line bg-white px-3 focus:border-teal">
              <option value={0}>{s.resources.filterAll}</option>
              {units?.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </label>
          <label className="block space-y-1"><span className="font-medium">{s.tools.quiz.count}</span>
            <input type="number" min={3} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="min-h-touch w-24 rounded-card border-2 border-line px-3 text-center focus:border-teal" />
          </label>
          <button type="button" onClick={() => void start()} className="btn-primary"><Play className="size-5" aria-hidden />{s.tools.quiz.start}</button>
        </div>
      </section>
    );
  }

  if (questions.length === 0) return <p className="card text-ink-soft">{s.tools.quiz.empty}</p>;

  if (idx >= questions.length) {
    return (
      <section className="card space-y-4 py-8 text-center">
        <p className="font-heading text-3xl font-bold text-teal-dark">{s.tools.quiz.done}</p>
        <p className="text-2xl font-bold">{s.tools.quiz.score(`${fmtNum(score, numerals)} / ${fmtNum(questions.length, numerals)}`)}</p>
        <button type="button" onClick={() => setQuestions(null)} className="btn-primary mx-auto">{s.tools.quiz.restart}</button>
      </section>
    );
  }

  const q = questions[idx];
  return (
    <section className="card space-y-4 text-center">
      <div className="flex items-center justify-between">
        <span className="text-ink-soft">{s.tools.quiz.question(fmtNum(idx + 1, numerals), fmtNum(questions.length, numerals))}</span>
        <span className={"rounded-pill px-3 py-1 font-bold tabular-nums " + (seconds <= 5 ? "bg-danger-bg text-danger" : "bg-teal-bg text-teal-dark")}>
          {s.tools.quiz.timeLeft}: {fmtNum(seconds, numerals)}
        </span>
        <span className="font-bold text-gold-dark">{s.tools.quiz.score(fmtNum(score, numerals))}</span>
      </div>
      <p className="font-heading text-2xl font-bold">{q.text}</p>
      {q.type === "mcq" && q.options && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => (
            <div key={o.key} className={"rounded-card border-2 p-3 text-lg " + (revealed && o.key === q.answerKey ? "border-ok bg-teal-bg font-bold" : "border-line")}>
              {o.key}) {o.text}
            </div>
          ))}
        </div>
      )}
      {revealed && q.type !== "mcq" && (
        <p className="rounded-card bg-teal-bg p-3 font-bold text-teal-dark">{String(q.answerKey ?? "")}</p>
      )}
      <div className="flex justify-center gap-3">
        {!revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="btn-secondary">{s.tools.quiz.reveal}</button>
        ) : (
          <>
            <button type="button" onClick={() => { setScore((x) => x + 1); setIdx((i) => i + 1); setRevealed(false); setSeconds(20); }} className="btn-primary">
              {s.tools.quiz.correct}
            </button>
            <button type="button" onClick={() => { setIdx((i) => i + 1); setRevealed(false); setSeconds(20); }} className="btn border-2 border-line bg-white text-ink">
              {s.tools.quiz.next}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** عجلة الاختيار العادلة (§2-ز) */
function WheelTool({ classId }: { classId: number }) {
  const s = useStrings();
  const [excludeAbsent, setExcludeAbsent] = useState(true);
  const [candidates, setCandidates] = useState<Pickable[]>([]);
  const [absent, setAbsent] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<number[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!classId) return;
      setCandidates(await classPickables(classId));
      setAbsent(excludeAbsent ? await absentTodayIds(classId, Date.now()) : new Set());
      setPicked([]);
      setCurrent(null);
    })();
  }, [classId, excludeAbsent]);

  function spin() {
    const eligible = candidates.filter((c) => !absent.has(c.id));
    if (eligible.length === 0) { setCurrent(null); return; }
    setSpinning(true);
    // دوران بصري ثم نتيجة عادلة
    let ticks = 0;
    const iv = setInterval(() => {
      setCurrent(eligible[Math.floor(Math.random() * eligible.length)].name);
      ticks++;
      if (ticks > 12) {
        clearInterval(iv);
        const r = fairPick(candidates, absent, picked);
        if (r) { setCurrent(r.picked.name); setPicked(r.pickedAfter); }
        setSpinning(false);
      }
    }, 90);
  }

  const eligibleCount = candidates.filter((c) => !absent.has(c.id)).length;

  return (
    <section className="card space-y-4">
      <label className="flex min-h-touch items-center gap-2">
        <input type="checkbox" checked={excludeAbsent} onChange={(e) => setExcludeAbsent(e.target.checked)} className="size-5 accent-teal" />
        {s.tools.wheel.excludeAbsent}
      </label>

      <div className="flex flex-col items-center gap-4 py-6">
        <div className={"flex size-56 items-center justify-center rounded-full border-8 border-maroon bg-gradient-to-br from-teal-bg to-gold-bg text-center " + (spinning ? "animate-pulse" : "")}>
          <span className="px-4 font-heading text-3xl font-bold text-maroon">{current ?? "؟"}</span>
        </div>
        {eligibleCount === 0 ? (
          <p className="text-danger">{s.tools.wheel.none}</p>
        ) : (
          <button type="button" onClick={spin} disabled={spinning} className="btn-primary min-h-[56px] px-8 text-lg">
            <Dice5 className="size-6" aria-hidden />
            {spinning ? s.tools.wheel.spinning : s.tools.wheel.spin}
          </button>
        )}
        {picked.length >= eligibleCount && eligibleCount > 0 && <p className="text-teal-dark">{s.tools.wheel.allPicked}</p>}
      </div>

      {picked.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg font-bold">{s.tools.wheel.log}</h3>
            <button type="button" onClick={() => { setPicked([]); setCurrent(null); }} className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal">
              <RotateCcw className="size-4" aria-hidden />{s.tools.wheel.reset}
            </button>
          </div>
          <ol className="mt-2 flex flex-wrap gap-2">
            {picked.map((id, i) => (
              <li key={id} className="rounded-pill bg-cream px-3 py-1 text-sm">{i + 1}. {candidates.find((c) => c.id === id)?.name}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/** مؤقّت نشاط بأزرار جاهزة */
function TimerTool() {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [total, setTotal] = useState(300);
  const [left, setLeft] = useState(300);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <section className="card space-y-4 text-center">
      <div className={"mx-auto font-heading text-7xl font-bold tabular-nums " + (left <= 10 && left > 0 ? "text-danger" : "text-maroon")}>
        {fmtNum(mm, numerals)}:{fmtNum(ss, numerals)}
      </div>
      {left === 0 && <p className="text-2xl font-bold text-danger">{s.tools.timer.done}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <span className="self-center text-ink-soft">{s.tools.timer.presets}:</span>
        {[1, 3, 5, 7, 10].map((m) => (
          <button key={m} type="button" onClick={() => { setTotal(m * 60); setLeft(m * 60); setRunning(false); }}
            className="btn border-2 border-line bg-white px-4 text-ink hover:border-teal">{fmtNum(m, numerals)} {s.tools.timer.minutes}</button>
        ))}
      </div>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => setRunning((r) => !r)} className="btn-primary min-h-[52px] px-8 text-lg">
          {running ? s.tools.timer.pause : s.tools.timer.start}
        </button>
        <button type="button" onClick={() => { setLeft(total); setRunning(false); }} className="btn border-2 border-line bg-white text-ink">
          <RotateCcw className="size-5" aria-hidden />{s.tools.timer.reset}
        </button>
      </div>
    </section>
  );
}

/** تقسيم عشوائي للمجموعات */
function GroupsTool({ classId }: { classId: number }) {
  const s = useStrings();
  const numerals = useUi((x) => x.numeralsTable);
  const [by, setBy] = useState<"count" | "size">("count");
  const [value, setValue] = useState(4);
  const [groups, setGroups] = useState<Pickable[][] | null>(null);

  async function make() {
    const students = await classPickables(classId);
    if (students.length === 0) return;
    setGroups(makeGroups(students, by === "count" ? { by: "count", count: value } : { by: "size", size: value }));
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2" role="group" aria-label={s.tools.groups.by}>
          {(["count", "size"] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBy(b)} aria-pressed={by === b}
              className={"btn px-4 " + (by === b ? "bg-teal text-white" : "border-2 border-line bg-white text-ink hover:border-teal")}>
              {b === "count" ? s.tools.groups.byCount : s.tools.groups.bySize}
            </button>
          ))}
        </div>
        <label className="block space-y-1"><span className="font-medium">{s.tools.groups.value}</span>
          <input type="number" min={2} max={30} value={value} onChange={(e) => setValue(Number(e.target.value))} className="min-h-touch w-24 rounded-card border-2 border-line px-3 text-center focus:border-teal" />
        </label>
        <button type="button" onClick={() => void make()} disabled={!classId} className="btn-primary disabled:opacity-50">
          <Users className="size-5" aria-hidden />{groups ? s.tools.groups.reshuffle : s.tools.groups.make}
        </button>
      </div>

      {groups && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <div key={i} className="rounded-card border-2 border-teal bg-teal-bg p-3">
              <p className="font-heading font-bold text-teal-dark">{s.tools.groups.group(fmtNum(i + 1, numerals))}</p>
              <ul className="mt-1">
                {g.map((st) => <li key={st.id}>• {st.name}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
