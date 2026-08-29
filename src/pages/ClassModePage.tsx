/**
 * «وضع الفصل» — شاشة البروجكتور (زكريت م٤):
 * واجهة داكنة جريئة بخط ضخم، مختلفة عن لوحة التحضير الهادئة.
 *
 * القواعد: الإجابة لا تظهر إلا بضغطة المعلّمة («أظهري الإجابة») ·
 * الاختيار العادل يستبعد غائبات اليوم ويمنع التكرار حتى تُستوفى الجولة
 * وبسجل مرئي · نقاط الفرق كبيرة وقابلة للتراجع · لا إحراج لطالبة بعينها.
 * كل المحتوى محلي (شرائح الحزمة + بنك الأسئلة) — يعمل بلا إنترنت.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Dices,
  Eye,
  Gamepad2,
  LogOut,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Timer as TimerIcon,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "@/db";
import type { Question } from "@/db/schema";
import { kitByLessonTitle } from "@/content/lessonKits";
import { absentTodayIds, classPickables, fairPick, makeGroups, type Pickable } from "@/lib/funTools";
import { TEAM_INFO, formatAnswer, pickGameQuestions } from "@/lib/classMode";
import { buildGamePool } from "@/lib/classGames";
import { MatchGame, MemoryGame, OrderGame, WhoAmIGame } from "@/components/classGames/games";
import SlideVisual from "@/components/slides/SlideVisual";
import { buildLessonShow } from "@/lib/lessonShow";
import type { VisualSlide } from "@/db/schema";
import { Home as HomeIcon, Link2, ListOrdered, SquareStack, UsersRound } from "lucide-react";
import { fmtNum } from "@/lib/numerals";
import { useStrings } from "@/hooks/useStrings";
import { useUi } from "@/store/ui";

type Mode = "slides" | "game" | "picker" | "timer" | "teams";

const GAME_QUESTIONS = 10;

export default function ClassModePage() {
  const s = useStrings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const numerals = useUi((x) => x.numeralsTable);
  const rememberedClassId = useUi((x) => x.currentClassId);
  const setCurrentClass = useUi((x) => x.setCurrentClass);

  // ── الإعداد ──────────────────────────────────────────────
  const classes = useLiveQuery(async () => (await db.classes.toArray()).filter((c) => !c.deletedAt));
  const lessons = useLiveQuery(async () =>
    (await db.lessons.toArray())
      .filter((l) => !l.deletedAt)
      .sort((a, b) => a.unitId - b.unitId || a.order - b.order)
  );

  const [classId, setClassId] = useState<number | undefined>(rememberedClassId);
  const [lessonId, setLessonId] = useState<number | undefined>(() => {
    const q = Number(params.get("lesson"));
    return Number.isFinite(q) && q > 0 ? q : undefined;
  });
  const [teamsCount, setTeamsCount] = useState(2);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("slides");

  useEffect(() => {
    if (classId === undefined && rememberedClassId !== undefined) setClassId(rememberedClassId);
  }, [rememberedClassId, classId]);

  const lesson = (lessons ?? []).find((l) => l.id === lessonId);
  const kit = lesson ? kitByLessonTitle(lesson.title) : undefined;

  // ── الشرائح: حزمة يدوية إن وجدت، وإلا «العرض المساعد» من الكتاب ──
  const [slideIdx, setSlideIdx] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [slideRevealed, setSlideRevealed] = useState(false);
  const [assistantSlides, setAssistantSlides] = useState<VisualSlide[]>([]);

  useEffect(() => {
    if (!running || kit || !lesson?.code || lesson.id == null) {
      setAssistantSlides([]);
      return;
    }
    void (async () => {
      const bank = (await db.questions.where("lessonId").equals(lesson.id!).toArray()).filter((q) => !q.deletedAt);
      setAssistantSlides(buildLessonShow(lesson.code!, bank)?.slides ?? []);
    })();
  }, [running, kit, lesson?.id, lesson?.code]);

  const slides: VisualSlide[] = kit
    ? kit.slides.map((sl) => ({ layout: "bullets", title: sl.title, bullets: sl.bullets, note: { say: sl.note ?? "" } }))
    : assistantSlides;

  // ── الألعاب: قائمة القوالب + مخزون أسئلة الدرس/الوحدة ─────
  type ActiveGame = "menu" | "team" | "match" | "order" | "memory" | "who";
  const [activeGame, setActiveGame] = useState<ActiveGame>("menu");
  const [bankPool, setBankPool] = useState<Question[]>([]);

  useEffect(() => {
    if (!running) return;
    void (async () => {
      const all = await db.questions.toArray();
      setBankPool(buildGamePool(all, { lessonId, unitId: lesson?.unitId, lessonCode: lesson?.code }));
    })();
  }, [running, lessonId, lesson?.unitId]);

  // ── لعبة الفرق ───────────────────────────────────────────
  const [gameQuestions, setGameQuestions] = useState<Question[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  /** سجل منح النقاط — للتراجع */
  const scoreHistory = useRef<number[]>([]);

  async function startGame() {
    const all = await db.questions.toArray();
    const picked = pickGameQuestions(all, { lessonId, unitId: lesson?.unitId, count: GAME_QUESTIONS });
    setGameQuestions(picked);
    setQIdx(0);
    setRevealed(false);
    setScores(Array.from({ length: teamsCount }, () => 0));
    scoreHistory.current = [];
  }

  function awardTeam(teamIdx: number) {
    setScores((prev) => prev.map((v, i) => (i === teamIdx ? v + 1 : v)));
    scoreHistory.current.push(teamIdx);
    setRevealed(false);
    setQIdx((i) => i + 1);
  }

  function skipQuestion() {
    setRevealed(false);
    setQIdx((i) => i + 1);
  }

  function undoLastPoint() {
    const last = scoreHistory.current.pop();
    if (last === undefined) return;
    setScores((prev) => prev.map((v, i) => (i === last ? Math.max(0, v - 1) : v)));
  }

  // ── الاختيار العادل ──────────────────────────────────────
  const [pickables, setPickables] = useState<Pickable[]>([]);
  const [absents, setAbsents] = useState<Set<number>>(new Set());
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [currentPick, setCurrentPick] = useState<Pickable | null>(null);
  const [roundRestarted, setRoundRestarted] = useState(false);

  useEffect(() => {
    if (!running || classId === undefined) return;
    void (async () => {
      setPickables(await classPickables(classId));
      setAbsents(await absentTodayIds(classId, Date.now()));
      setPickedIds([]);
      setCurrentPick(null);
    })();
  }, [running, classId]);

  function pickName() {
    const result = fairPick(pickables, absents, pickedIds);
    if (!result) {
      setCurrentPick(null);
      return;
    }
    setRoundRestarted(result.pickedAfter.length === 1 && pickedIds.length > 0);
    setCurrentPick(result.picked);
    setPickedIds(result.pickedAfter);
  }

  const eligibleCount = pickables.filter((p) => !absents.has(p.id)).length;

  // ── المؤقّت ──────────────────────────────────────────────
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    if (!ticking || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [ticking, secondsLeft]);

  const timeUp = secondsLeft === 0;

  // ── الفرق ────────────────────────────────────────────────
  const [groups, setGroups] = useState<Pickable[][]>([]);

  function regroup() {
    const present = pickables.filter((p) => !absents.has(p.id));
    setGroups(makeGroups(present, { by: "count", count: teamsCount }));
  }

  // ── لوحة المفاتيح: أسهم للتنقل ───────────────────────────
  useEffect(() => {
    if (!running) return;
    function onKey(e: KeyboardEvent) {
      if (mode === "slides") {
        if (e.key === "ArrowLeft") setSlideIdx((i) => Math.min(i + 1, slides.length - 1));
        if (e.key === "ArrowRight") setSlideIdx((i) => Math.max(i - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, mode, slides.length]);

  const n = (v: number) => fmtNum(v, numerals);

  // ════════ شاشة الإعداد ════════
  if (!running) {
    return (
      <div className="min-h-dvh bg-ink p-6 text-white">
        <div className="mx-auto max-w-2xl space-y-6 pt-10">
          <h1 className="flex items-center gap-3 font-heading text-4xl font-bold">
            <Presentation className="size-10 text-gold" aria-hidden />
            {s.classMode.title}
          </h1>
          <p className="text-xl text-white/70">{s.classMode.subtitle}</p>

          <div className="space-y-4 rounded-card bg-white/5 p-6">
            <h2 className="font-heading text-2xl font-bold">{s.classMode.setupTitle}</h2>

            <label className="block space-y-2">
              <span className="text-lg font-medium">{s.classMode.pickClass}</span>
              <select
                value={classId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setClassId(id);
                  setCurrentClass(id);
                }}
                className="w-full rounded-card border-2 border-white/20 bg-ink p-3 text-xl text-white focus:border-gold"
              >
                <option value="">—</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-lg font-medium">{s.classMode.pickLesson}</span>
              <select
                value={lessonId ?? ""}
                onChange={(e) => setLessonId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-card border-2 border-white/20 bg-ink p-3 text-xl text-white focus:border-gold"
              >
                <option value="">—</option>
                {(lessons ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-lg font-medium">{s.classMode.teamsCount}</span>
              <div className="flex gap-3">
                {[2, 3, 4].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={teamsCount === c}
                    onClick={() => setTeamsCount(c)}
                    className={
                      "min-h-touch flex-1 rounded-card border-2 py-3 text-2xl font-bold transition-colors " +
                      (teamsCount === c ? "border-gold bg-gold text-ink" : "border-white/20 text-white hover:border-gold")
                    }
                  >
                    {n(c)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={classId === undefined || lessonId === undefined}
              onClick={() => {
                setRunning(true);
                setSlideIdx(0);
                setMode(kit ? "slides" : "game");
              }}
              className="btn w-full min-h-[64px] bg-gold text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white disabled:opacity-40"
            >
              <Play className="size-8" aria-hidden />
              {s.classMode.start}
            </button>
          </div>

          <button type="button" onClick={() => navigate(-1)} className="flex min-h-touch items-center gap-2 text-white/70 hover:text-white">
            <LogOut className="size-5" aria-hidden />
            {s.classMode.exit}
          </button>
        </div>
      </div>
    );
  }

  // ════════ شاشة التشغيل ════════
  const modeButtons: { key: Mode; label: string; icon: typeof Presentation }[] = [
    { key: "slides", label: s.classMode.modes.slides, icon: Presentation },
    { key: "game", label: s.classMode.modes.game, icon: Gamepad2 },
    { key: "picker", label: s.classMode.modes.picker, icon: Dices },
    { key: "timer", label: s.classMode.modes.timer, icon: TimerIcon },
    { key: "teams", label: s.classMode.modes.teams, icon: Users },
  ];

  const q = gameQuestions?.[qIdx];
  const gameDone = gameQuestions !== null && qIdx >= gameQuestions.length;
  const maxScore = Math.max(...(scores.length ? scores : [0]));
  const winners = scores.map((v, i) => ({ v, i })).filter((x) => x.v === maxScore && maxScore > 0);

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-white">
      {/* رأس رفيع */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-2">
        <span className="truncate font-heading text-xl font-bold text-gold">{lesson?.title}</span>
        <div className="flex items-center gap-1">
          <Link to="/" className="flex min-h-touch items-center gap-2 rounded-card px-3 text-white/70 hover:bg-white/10 hover:text-white">
            <HomeIcon className="size-5" aria-hidden />
            {s.common.home}
          </Link>
          <button
            type="button"
            onClick={() => navigate(lessonId ? `/library/${lessonId}` : "/library")}
            className="flex min-h-touch items-center gap-2 rounded-card px-3 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-5" aria-hidden />
            {s.classMode.exit}
          </button>
        </div>
      </header>

      {/* المحتوى */}
      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
        {mode === "slides" &&
          (slides.length === 0 ? (
            <p className="text-3xl text-white/70">{s.library.kitMissing}</p>
          ) : (
            <div className="w-full max-w-5xl space-y-6">
              {/* الشريحة المصمَّمة الموحّدة — سطح فاتح على خشبة داكنة كبروجكتور حقيقي */}
              <SlideVisual slide={slides[slideIdx]} variant="present" index={slideIdx} answerRevealed={slideRevealed} />
              <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
                {slides[slideIdx].interaction && !slideRevealed && (
                  <button
                    type="button"
                    onClick={() => setSlideRevealed(true)}
                    className="btn min-h-[60px] bg-gold px-8 text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white"
                  >
                    {s.classMode.reveal}
                  </button>
                )}
                {slides[slideIdx].action && (
                  <button
                    type="button"
                    onClick={() => setMode("game")}
                    className="btn min-h-[60px] border-2 border-gold bg-transparent px-6 text-xl font-bold text-gold hover:bg-gold hover:text-ink"
                  >
                    {slides[slideIdx].action!.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNote((v) => !v)}
                  className="min-h-touch rounded-pill border border-white/25 px-4 text-white/70 hover:text-white"
                >
                  {s.classMode.teacherNote}
                </button>
              </div>
              {showNote && (
                <p className="mx-auto mt-2 max-w-3xl rounded-card bg-white/10 p-3 text-xl text-white/85">{slides[slideIdx].note.say}</p>
              )}
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => { setSlideIdx((i) => Math.max(i - 1, 0)); setShowNote(false); setSlideRevealed(false); }}
                  disabled={slideIdx === 0}
                  className="btn min-h-[64px] border-2 border-white/30 bg-transparent px-8 text-2xl text-white hover:bg-white/10 disabled:opacity-30"
                >
                  {s.classMode.prev}
                </button>
                <span className="text-xl text-white/60">{s.classMode.slideOf(n(slideIdx + 1), n(slides.length))}</span>
                <button
                  type="button"
                  onClick={() => { setSlideIdx((i) => Math.min(i + 1, slides.length - 1)); setShowNote(false); setSlideRevealed(false); }}
                  disabled={slideIdx >= slides.length - 1}
                  className="btn min-h-[64px] bg-gold px-8 text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white disabled:opacity-30"
                >
                  {s.classMode.next}
                </button>
              </div>
              {/* نقاط التقدّم */}
              <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
                {slides.map((_, i) => (
                  <span key={i} className={"size-3 rounded-full " + (i === slideIdx ? "bg-gold" : i < slideIdx ? "bg-teal" : "bg-white/25")} />
                ))}
              </div>
            </div>
          ))}

        {mode === "game" && activeGame === "menu" && (
          <div className="w-full max-w-4xl space-y-6">
            <h2 className="font-heading text-4xl font-bold text-gold">{s.games.menuTitle}</h2>
            <p className="text-xl text-white/60">{s.games.fromBank}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { key: "team", label: s.games.team, hint: s.games.teamHint, icon: Gamepad2, emoji: "🏆", tile: "border-gold/70 bg-gold/10" },
                  { key: "match", label: s.games.match, hint: s.games.matchHint, icon: Link2, emoji: "🔗", tile: "border-teal/70 bg-teal/10" },
                  { key: "order", label: s.games.order, hint: s.games.orderHint, icon: ListOrdered, emoji: "🪜", tile: "border-danger/70 bg-danger/10" },
                  { key: "memory", label: s.games.memory, hint: s.games.memoryHint, icon: SquareStack, emoji: "🃏", tile: "border-white/50 bg-white/10" },
                  { key: "who", label: s.games.who, hint: s.games.whoHint, icon: UsersRound, emoji: "🕵️‍♀️", tile: "border-ok/70 bg-ok/10" },
                ] as { key: ActiveGame; label: string; hint: string; icon: typeof Gamepad2; emoji: string; tile: string }[]
              ).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveGame(g.key)}
                  className={"flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-card border-2 p-4 transition-all motion-safe:hover:scale-[1.03] hover:border-gold " + g.tile}
                >
                  <span className="flex items-center gap-3 text-2xl font-bold">
                    <span aria-hidden className="text-4xl">{g.emoji}</span>
                    {g.label}
                  </span>
                  <span className="text-white/70">{g.hint}</span>
                </button>
              ))}
              <Link
                to="/lab?from=class"
                className="flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-card border-2 border-teal/70 bg-gradient-to-bl from-teal/25 to-transparent p-4 transition-all motion-safe:hover:scale-[1.03] hover:border-gold"
              >
                <span className="flex items-center gap-3 text-2xl font-bold">
                  <span aria-hidden className="text-4xl">🧪</span>
                  {s.games.lab}
                </span>
                <span className="text-white/70">{s.games.labHint}</span>
              </Link>
            </div>
          </div>
        )}

        {mode === "game" && activeGame === "match" && <MatchGame questions={bankPool} onExit={() => setActiveGame("menu")} />}
        {mode === "game" && activeGame === "order" && <OrderGame questions={bankPool} onExit={() => setActiveGame("menu")} />}
        {mode === "game" && activeGame === "memory" && <MemoryGame questions={bankPool} onExit={() => setActiveGame("menu")} />}
        {mode === "game" && activeGame === "who" && <WhoAmIGame questions={bankPool} onExit={() => setActiveGame("menu")} />}

        {mode === "game" && activeGame === "team" && (
          <div className="w-full max-w-5xl space-y-8">
            {gameQuestions === null ? (
              <button type="button" onClick={() => void startGame()} className="btn mx-auto min-h-[72px] bg-gold px-10 text-3xl font-bold text-ink hover:bg-gold-dark hover:text-white">
                <Gamepad2 className="size-9" aria-hidden />
                {s.classMode.start}
              </button>
            ) : gameQuestions.length === 0 ? (
              <p className="text-3xl leading-relaxed text-white/70">{s.classMode.noQuestions}</p>
            ) : gameDone ? (
              <div className="space-y-6">
                <h2 className="font-heading text-6xl font-bold text-gold">{s.classMode.gameOver}</h2>
                <p className="text-4xl">
                  {winners.length === 1 ? s.classMode.winner(TEAM_INFO[winners[0].i].emoji + " " + TEAM_INFO[winners[0].i].name) : s.classMode.tie}
                </p>
                <button type="button" onClick={() => void startGame()} className="btn mx-auto min-h-[64px] bg-gold px-8 text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white">
                  {s.classMode.playAgain}
                </button>
              </div>
            ) : q ? (
              <>
                <p className="text-xl text-white/60">{s.classMode.questionOf(n(qIdx + 1), n(gameQuestions.length))}</p>
                <h2 className="font-heading text-4xl font-bold leading-snug lg:text-5xl">{q.text}</h2>
                {q.options && q.options.length > 0 && (
                  <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <div key={o.key} className="rounded-card border-2 border-white/20 p-4 text-start text-2xl lg:text-3xl">
                        <b className="text-gold">{o.key})</b> {o.text}
                      </div>
                    ))}
                  </div>
                )}
                {!revealed ? (
                  <button type="button" onClick={() => setRevealed(true)} className="btn mx-auto min-h-[64px] bg-gold px-10 text-2xl font-bold text-ink hover:bg-gold-dark hover:text-white">
                    <Eye className="size-8" aria-hidden />
                    {s.classMode.reveal}
                  </button>
                ) : (
                  <div className="space-y-5">
                    <p className="mx-auto max-w-3xl whitespace-pre-line rounded-card border-2 border-ok bg-ok/15 p-5 text-3xl font-bold text-white">
                      {s.classMode.answerLabel}: {formatAnswer(q.answerKey, q.options)}
                    </p>
                    <p className="text-xl text-white/70">{s.classMode.whichTeam}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {scores.map((_, i) => (
                        <button key={i} type="button" onClick={() => awardTeam(i)} className={"btn min-h-[64px] px-6 text-2xl font-bold " + TEAM_INFO[i].btn}>
                          <span aria-hidden>{TEAM_INFO[i].emoji}</span> {TEAM_INFO[i].name} ‏+{n(1)}
                        </button>
                      ))}
                      <button type="button" onClick={skipQuestion} className="btn min-h-[64px] border-2 border-white/30 bg-transparent px-6 text-2xl text-white hover:bg-white/10">
                        {s.classMode.nextQuestion}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {gameQuestions !== null && gameQuestions.length > 0 && (
              <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4 border-t border-white/10 pt-5">
                {scores.map((v, i) => (
                  <span key={i} className={"rounded-card border-2 px-5 py-2 text-2xl font-bold " + TEAM_INFO[i].chip}>
                    <span aria-hidden>{TEAM_INFO[i].emoji}</span> {TEAM_INFO[i].name}: <b className="text-gold">{n(v)}</b>
                  </span>
                ))}
                <button type="button" onClick={undoLastPoint} className="flex min-h-touch items-center gap-1 rounded-card px-3 text-white/60 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="size-5" aria-hidden />
                  {s.classMode.undoPoint}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setActiveGame("menu"); setGameQuestions(null); }}
              className="mx-auto flex min-h-touch items-center gap-2 rounded-card px-4 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-5" aria-hidden />
              {s.games.back}
            </button>
          </div>
        )}

        {mode === "picker" && (
          <div className="space-y-8">
            {eligibleCount === 0 ? (
              <p className="text-3xl text-white/70">{s.classMode.noStudents}</p>
            ) : (
              <>
                {currentPick && (
                  <p className="font-heading text-7xl font-bold text-gold lg:text-8xl">{currentPick.name}</p>
                )}
                {roundRestarted && <p className="text-xl text-teal-bg">{s.classMode.newRound}</p>}
                <button type="button" onClick={pickName} className="btn mx-auto min-h-[72px] bg-gold px-10 text-3xl font-bold text-ink hover:bg-gold-dark hover:text-white">
                  <Dices className="size-9" aria-hidden />
                  {currentPick ? s.classMode.pickAgain : s.classMode.pickName}
                </button>
                <p className="text-xl text-white/60">
                  {s.classMode.pickedProgress(n(pickedIds.length), n(eligibleCount))} · {s.classMode.absentExcluded}
                </p>
              </>
            )}
          </div>
        )}

        {mode === "timer" && (
          <div className="space-y-8">
            <p
              role="timer"
              className={
                "font-heading text-9xl font-bold tabular-nums " +
                (timeUp ? "text-gold" : secondsLeft <= 30 ? "text-danger-bg" : "text-white")
              }
            >
              {n(Math.floor(secondsLeft / 60))}:{String(secondsLeft % 60).padStart(2, "0")}
            </p>
            {timeUp && <p className="font-heading text-5xl font-bold text-gold">{s.classMode.timeUp}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              {[2, 5, 10].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setTotalSeconds(m * 60); setSecondsLeft(m * 60); setTicking(false); }}
                  className={
                    "btn min-h-[56px] border-2 px-6 text-2xl font-bold " +
                    (totalSeconds === m * 60 ? "border-gold bg-gold text-ink" : "border-white/30 bg-transparent text-white hover:bg-white/10")
                  }
                >
                  {s.classMode.minutes(n(m))}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => setTicking((v) => !v)} disabled={timeUp} className="btn min-h-[64px] bg-teal px-8 text-2xl font-bold text-white hover:bg-teal-dark disabled:opacity-40">
                {ticking ? <Pause className="size-7" aria-hidden /> : <Play className="size-7" aria-hidden />}
                {ticking ? s.classMode.pauseTimer : s.classMode.startTimer}
              </button>
              <button type="button" onClick={() => { setSecondsLeft(totalSeconds); setTicking(false); }} className="btn min-h-[64px] border-2 border-white/30 bg-transparent px-8 text-2xl text-white hover:bg-white/10">
                <RotateCcw className="size-7" aria-hidden />
                {s.classMode.resetTimer}
              </button>
            </div>
          </div>
        )}

        {mode === "teams" && (
          <div className="w-full max-w-5xl space-y-6">
            {groups.length === 0 ? (
              <button type="button" onClick={regroup} className="btn mx-auto min-h-[72px] bg-gold px-10 text-3xl font-bold text-ink hover:bg-gold-dark hover:text-white">
                <Users className="size-9" aria-hidden />
                {s.classMode.regroup}
              </button>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {groups.map((g, i) => (
                    <div key={i} className="rounded-card bg-white/10 p-4 text-start">
                      <p className="mb-2 border-b border-white/20 pb-2 font-heading text-2xl font-bold text-gold">
                        {TEAM_INFO[i] ? TEAM_INFO[i].emoji + " " + TEAM_INFO[i].name : `مجموعة ${n(i + 1)}`}
                        <span className="ms-2 text-base font-normal text-white/60">{s.classMode.membersCount(n(g.length))}</span>
                      </p>
                      <ul className="space-y-1 text-xl">
                        {g.map((st) => (
                          <li key={st.id}>{st.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={regroup} className="btn mx-auto min-h-[56px] border-2 border-white/30 bg-transparent px-6 text-xl text-white hover:bg-white/10">
                  <RotateCcw className="size-6" aria-hidden />
                  {s.classMode.regroup}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* شريط الأوضاع الثابت */}
      <nav aria-label={s.classMode.title} className="grid grid-cols-5 border-t-2 border-white/10 bg-black/30">
        {modeButtons.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={mode === m.key}
            onClick={() => setMode(m.key)}
            className={
              "flex min-h-[64px] flex-col items-center justify-center gap-1 text-lg transition-colors " +
              (mode === m.key ? "border-t-4 border-gold bg-white/10 font-bold text-gold" : "border-t-4 border-transparent text-white/70 hover:bg-white/5 hover:text-white")
            }
          >
            <m.icon className="size-7" aria-hidden />
            {m.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
