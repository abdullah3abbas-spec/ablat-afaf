/* موصِل أم عازِل؟ — درس مشاهدة علوم الصف الخامس (المنهج القطري) */
(() => {
'use strict';

/* ================= إعدادات ================= */
const SB_URL = 'https://tedrqqidfzjblfqlpxfm.supabase.co';
const SB_KEY = 'sb_publishable_TMdcj-9sq9kV6r9Ga1Cgtg_0MlXzU_k';
const COLORS = ['#2F6FED', '#1FA971', '#FF8A00', '#8B5CF6', '#EC4899', '#0EA5B7'];

// كل الأدوات (cond = موصل كهربائي)
const ITEMS = [
  {id: 'clip',   name: 'مشبك ورق',        cond: true},
  {id: 'nail',   name: 'مسمار حديد',       cond: true},
  {id: 'coin',   name: 'عملة معدنية',      cond: true},
  {id: 'foil',   name: 'ورق ألمنيوم',      cond: true},
  {id: 'key',    name: 'مفتاح باب',        cond: true},
  {id: 'spoon',  name: 'ملعقة فلزّية',     cond: true},
  {id: 'copper', name: 'سلك نحاس',         cond: true},
  {id: 'eraser', name: 'ممحاة',            cond: false},
  {id: 'stick',  name: 'عود خشبي',         cond: false},
  {id: 'pspoon', name: 'ملعقة بلاستيكية',  cond: false},
  {id: 'rubber', name: 'شريط مطّاطي',      cond: false},
  {id: 'marble', name: 'كرة زجاجية',       cond: false},
  {id: 'cloth',  name: 'قطعة قماش',        cond: false},
  {id: 'paper',  name: 'ورقة',             cond: false},
  {id: 'ruler',  name: 'مسطرة بلاستيكية',  cond: false},
  {id: 'block',  name: 'مكعب خشبي',        cond: false},
];
const GAME_IDS = ['clip', 'nail', 'coin', 'foil', 'key', 'spoon', 'copper', 'eraser', 'stick', 'pspoon', 'rubber', 'marble', 'cloth', 'paper'];

// أسئلة التقييم — مبنية على نواتج الدرس 3.3 (P0508.1–3)
const QUIZ = [
  {q: 'ماذا تُسمّى المادّة التي لا تسمح بسريان التيار الكهربائي عبرها؟',
   o: ['مُوصِل كهربائي', 'عازِل كهربائي', 'خليّة كهربائية', 'مفتاح كهربائي'], a: 1,
   x: 'العازِل الكهربائي لا يسمح بسريان التيار الكهربائي عبره.'},
  {q: 'أيّ مادّة من الموادّ الآتية مُوصِلة كهربائيّة جيّدة؟',
   o: [{t: 'ممحاة', i: 'eraser'}, {t: 'مسمار حديد', i: 'nail'}, {t: 'مسطرة بلاستيكية', i: 'ruler'}, {t: 'عود خشبي', i: 'stick'}], a: 1,
   x: 'الحديد فلزّ، والفلزّات مُوصِلات كهربائيّة جيّدة.'},
  {q: 'أيّ مادّة من الموادّ الآتية عازِلة كهربائيّة جيّدة؟',
   o: [{t: 'مشبك ورق', i: 'clip'}, {t: 'سلك نحاس', i: 'copper'}, {t: 'شريط مطّاطي', i: 'rubber'}, {t: 'ورق ألمنيوم', i: 'foil'}], a: 2,
   x: 'المطّاط لا يسمح بسريان التيار الكهربائي، فهو عازِل.'},
  {q: 'وضعنا عملة معدنية مكان المفتاح في الدائرة الكهربائية. ماذا يحدث للمصباح؟',
   o: [{t: 'يضيء', i: 'coin'}, {t: 'لا يضيء'}], a: 0,
   x: 'العملة فلزّية، فتُغلِق الدائرة ويسري التيار الكهربائي.'},
  {q: 'الفلزّات مثل الحديد والنحاس والألمنيوم تُعَدّ…',
   o: ['مُوصِلات كهربائيّة جيّدة', 'عوازِل كهربائيّة'], a: 0,
   x: 'نستنتج من التجربة أنّ الفلزّات مناسبة لصنع المُوصِلات الكهربائية.'},
  {q: 'لماذا تُغطّى أسلاك التوصيل بالمطّاط أو البلاستيك؟',
   o: ['لتصبح الأسلاك أثقل', 'لأنّهما مُوصِلان جيّدان', 'لأنّهما عازِلان يحميانِنا من الكهرباء', 'لتصبح الأسلاك أكثر لمعانًا'], a: 2,
   x: 'السلك من النحاس (مُوصِل)، والغطاء من المطّاط أو البلاستيك (عازِل) لحمايتنا.'},
  {q: 'لماذا يجب أن تكون يداي جافّتين عند استخدام الأدوات الكهربائية؟',
   o: ['لأنّ الماء مُوصِل للكهرباء', 'لأنّ الماء عازِل للكهرباء', 'حتى لا تتّسخ الأدوات', 'حتى لا تنزلق الأدوات'], a: 0,
   x: 'الماء مُوصِل للكهرباء، لذلك نحافظ على أيدينا جافّة.'},
];
const LETTERS = ['أ', 'ب', 'ج', 'د'];

/* ================= أدوات عامة ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const item = (id) => ITEMS.find((i) => i.id === id);
const img = (id) => `img/${id}.webp`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const rnd = (n) => Math.floor(Math.random() * n);
const defNames = () => [1, 2, 3, 4, 5, 6].map((n) => 'المجموعة ' + n);
const optText = (o) => (typeof o === 'string' ? o : o.t);
const optImg = (o) => (typeof o === 'object' && o.i ? o.i : null);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

let bid = 0;
function bulbSVG(size, lit, cls = '') {
  const id = 'bu' + (bid++);
  const glass = 'M48 84 C47 74 30 68 30 50 A30 30 0 1 1 90 50 C90 68 73 74 72 84 Z';
  const rays = [-90, -50, -130, -15, -165, 25, 155].map((d) => {
    const a = (d * Math.PI) / 180, r1 = 40, r2 = 52;
    return `<line x1="${60 + Math.cos(a) * r1}" y1="${50 + Math.sin(a) * r1}" x2="${60 + Math.cos(a) * r2}" y2="${50 + Math.sin(a) * r2}"/>`;
  }).join('');
  return `<svg class="bulb ${lit ? 'lit' : ''} ${cls}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE680" stop-opacity=".95"/><stop offset=".4" stop-color="#FFD54A" stop-opacity=".45"/><stop offset="1" stop-color="#FFD54A" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}n" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#FFFDF0"/><stop offset=".45" stop-color="#FFF0A8"/><stop offset="1" stop-color="#FFC531"/></radialGradient>
    <radialGradient id="${id}f" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#EEF2F8"/><stop offset="1" stop-color="#D3DBE7"/></radialGradient>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="#8E99AB"/><stop offset=".35" stop-color="#F2F5FA"/><stop offset=".65" stop-color="#B8C2D2"/><stop offset="1" stop-color="#7C879A"/></linearGradient>
  </defs>
  <g class="on"><circle cx="60" cy="50" r="60" fill="url(#${id}g)"/><g stroke="#FFC531" stroke-width="5" stroke-linecap="round">${rays}</g></g>
  <path d="${glass}" fill="url(#${id}f)" stroke="#B9C4D6" stroke-width="2.5"/>
  <path class="on" d="${glass}" fill="url(#${id}n)" stroke="#F2B200" stroke-width="2.5"/>
  <path d="M55 84 L50 54 M65 84 L70 54" stroke="#8D97A8" stroke-width="1.8" fill="none"/>
  <path d="M50 54 q3 -7 5 0 t5 0 t5 0 t5 0" stroke="#7E889A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path class="on" d="M50 54 q3 -7 5 0 t5 0 t5 0 t5 0" stroke="#FFFBEA" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="46" cy="38" rx="5" ry="9" fill="#fff" opacity=".85" transform="rotate(28 46 38)"/>
  <rect x="47" y="82" width="26" height="20" rx="4" fill="url(#${id}b)"/>
  <path d="M47 88 L73 90 M47 94 L73 96" stroke="#6E7A8F" stroke-width="1.4" opacity=".55"/>
  <path d="M53 102 L67 102 L63 108 L57 108 Z" fill="#3B465C"/>
</svg>`;
}
const bolt = (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="#FFC531" stroke="#E0A100" stroke-width="1" stroke-linejoin="round"/></svg>`;
const check = (s = 22, c = '#fff') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`;
const cross = (s = 22, c = '#fff') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

/* ---------- صوت (مولَّد، بلا ملفات) ---------- */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type = 'sine', vol = 0.18, when = 0, f2) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  pick() { tone(660, 0.07, 'sine', 0.1); },
  light() { tone(523, 0.5, 'sine', 0.16); tone(784, 0.55, 'sine', 0.16, 0.06); tone(1046, 0.7, 'sine', 0.14, 0.12); },
  ok() { tone(784, 0.16, 'sine', 0.18); tone(1175, 0.3, 'sine', 0.16, 0.09); },
  bad() { tone(220, 0.22, 'triangle', 0.22, 0, 150); tone(165, 0.3, 'triangle', 0.18, 0.14, 110); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'sine', 0.16, i * 0.09)); },
  ping() { tone(988, 0.12, 'sine', 0.12); tone(1318, 0.2, 'sine', 0.1, 0.07); },
};
document.addEventListener('pointerdown', () => ac(), {once: true});

let toastT;
function toast(msg, kind = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast ' + kind), 1700);
}

function confetti(ms = 2600) {
  const cv = $('#confetti'), cx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#FFC531', '#2F6FED', '#1FA971', '#EC4899', '#FF8A00', '#8B5CF6'];
  const P = Array.from({length: 160}, () => ({x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5, vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 4, r: 5 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: cols[rnd(cols.length)]}));
  const t0 = performance.now();
  (function f(t) {
    cx.clearRect(0, 0, cv.width, cv.height);
    P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += p.va; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.fillStyle = p.c; cx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); cx.restore(); });
    if (t - t0 < ms) requestAnimationFrame(f); else cx.clearRect(0, 0, cv.width, cv.height);
  })(t0);
}

let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

/* ---------- الاتصال اللحظي ---------- */
function connect(room, presence, on) {
  if (!window.supabase) { on.status && on.status('NO_LIB'); return {send() {}}; }
  const sb = window.supabase.createClient(SB_URL, SB_KEY, {realtime: {params: {eventsPerSecond: 20}}});
  const ch = sb.channel('zakreet-g5:' + room, {config: {broadcast: {self: false, ack: false}, presence: {key: presence.key}}});
  Object.keys(on).filter((k) => k[0] !== '_' && k !== 'status' && k !== 'presence' && k !== 'ready').forEach((ev) => ch.on('broadcast', {event: ev}, ({payload}) => on[ev](payload)));
  ch.on('presence', {event: 'sync'}, () => on.presence && on.presence(ch.presenceState()));
  ch.subscribe(async (st) => {
    on.status && on.status(st);
    if (st === 'SUBSCRIBED') { try { await ch.track(presence); } catch (e) {} on.ready && on.ready(); }
  });
  return {send(ev, p) { try { ch.send({type: 'broadcast', event: ev, payload: p}); } catch (e) {} }};
}

/* ================= الصفحة الرئيسية ================= */
function Home() {
  const last = LS.get('zk-last-room', '');
  app.innerHTML = `<div class="home">
    <div class="logo">${bolt(60)}</div>
    <h1>موصِل أم عازِل؟</h1>
    <p class="sub">علوم الصف الخامس · الدرس 3.3 · المُوصِلات والعوازِل الكهربائية</p>
    <div class="cards">
      <a class="card" href="#/teacher" style="text-decoration:none;color:inherit">${bulbSVG(90, true)}شاشة المعلمة<small>للسبورة أو جهاز العرض</small><span class="btn primary">فتح الشاشة</span></a>
      <div class="card">${bulbSVG(90, false)}جهاز المجموعة<small>اكتبي رمز الصف ثم اختاري رقم المجموعة</small>
        <input id="code" inputmode="numeric" maxlength="4" placeholder="0000" value="${esc(last)}">
        <div class="grp-pick">${[1, 2, 3, 4, 5, 6].map((n) => `<button data-g="${n}" style="background:${COLORS[n - 1]}">${n}</button>`).join('')}</div>
      </div>
    </div>
  </div>`;
  $$('.grp-pick button').forEach((b) => b.onclick = () => {
    const code = $('#code').value.replace(/\D/g, '');
    if (code.length !== 4) { toast('اكتبي رمز الصف (4 أرقام)', 'bad'); $('#code').focus(); return; }
    LS.set('zk-last-room', code);
    location.hash = `#/g/${b.dataset.g}?r=${code}`;
  });
}

/* ================= شاشة المعلمة ================= */
function Teacher() {
  document.title = 'شاشة المعلمة · موصِل أم عازِل؟';
  const fresh = () => ({room: String(1000 + rnd(9000)), epoch: Date.now().toString(36), stage: 'video', groupsCount: 5, names: defNames(), gameStart: null, finish: [], quizIdx: 0, reveal: false});
  let T = Object.assign(fresh(), LS.get('zk-teacher', {}));
  let groups = {}; // g -> payload
  let online = {}; // g -> true
  let conn = 'CONNECTING';
  let showJoin = false;
  let resetArm = 0;
  const save = () => LS.set('zk-teacher', T);
  save();

  const pub = () => ({epoch: T.epoch, stage: T.stage, groupsCount: T.groupsCount, names: T.names, gameOn: !!T.gameStart, finish: T.finish, quizIdx: T.quizIdx, reveal: T.reveal});
  let link;
  const broadcast = () => link && link.send('T', pub());
  link = connect(T.room, {key: 'teacher', role: 'teacher'}, {
    G(p) {
      if (!p || p.epoch !== T.epoch || !p.g) return;
      const prev = groups[p.g];
      groups[p.g] = p;
      if (p.lastWrong && (!prev || !prev.lastWrong || prev.lastWrong.at !== p.lastWrong.at) && Date.now() - p.lastWrong.at < 8000) flashWrong(p.g, p.lastWrong);
      if (T.gameStart && p.done && !T.finish.find((f) => f.g === p.g)) {
        T.finish.push({g: p.g, t: Date.now() - T.gameStart, m: p.mistakes || 0}); save(); broadcast();
        if (T.finish.length === 1) { confetti(); SFX.win(); } else SFX.ping();
      }
      schedule();
    },
    hi() { broadcast(); },
    presence(state) {
      online = {};
      Object.values(state).flat().forEach((m) => { if (m.role === 'group') online[m.g] = true; });
      schedule();
    },
    status(st) { conn = st; schedule(); },
    ready() { broadcast(); link.send('hello', {epoch: T.epoch}); },
  });
  setInterval(broadcast, 4000);

  const wrongs = {};
  function flashWrong(g, w) { wrongs[g] = {...w, until: Date.now() + 2600}; schedule(); setTimeout(schedule, 2700); }

  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

  function setStage(s) { T.stage = s; if (s === 'quiz') T.reveal = false; save(); broadcast(); showJoin = false; render(); }

  const groupUrl = (g) => `${location.origin}${location.pathname}#/g/${g}?r=${T.room}`;
  const qrSVG = (txt) => { try { const q = qrcode(0, 'M'); q.addData(txt); q.make(); return q.createSvgTag({cellSize: 4, margin: 0, scalable: true}); } catch (e) { return ''; } };

  function ranking() {
    const ids = Array.from({length: T.groupsCount}, (_, i) => i + 1);
    const fin = T.finish.filter((f) => f.g <= T.groupsCount).map((f) => f.g);
    const rest = ids.filter((g) => !fin.includes(g)).sort((a, b) => {
      const pa = groups[a] ? Object.keys(groups[a].placed || {}).length : 0, pb = groups[b] ? Object.keys(groups[b].placed || {}).length : 0;
      if (pb !== pa) return pb - pa;
      return (groups[a]?.mistakes || 0) - (groups[b]?.mistakes || 0);
    });
    return [...fin, ...rest];
  }

  function render() {
    // لا تُعِد الرسم أثناء تعديل اسم مجموعة
    if (document.activeElement && document.activeElement.isContentEditable) return;
    const steps = [['video', 'التهيئة'], ['game', 'لعبة التصنيف'], ['results', 'النتائج'], ['quiz', 'التقييم']];
    const running = T.gameStart && T.finish.length < T.groupsCount;
    app.innerHTML = `<div class="t-wrap">
      <div class="t-top">
        <div class="t-brand"><div class="ic">${bolt(34)}</div><div><h1>موصِل أم عازِل؟</h1><small>علوم الصف الخامس · المُوصِلات والعوازِل الكهربائية</small></div></div>
        <div class="t-steps">${steps.map(([k, l], i) => `<button data-st="${k}" class="${T.stage === k ? 'act' : ''}"><i>${i + 1}</i>${l}</button>`).join('')}</div>
        <div class="t-meta">
          ${T.gameStart && (T.stage === 'game') ? `<div class="timer" id="timer">${fmt((running ? Date.now() : T.gameStart + Math.max(0, ...T.finish.map((f) => f.t))) - T.gameStart)}</div>` : ''}
          <span class="pill"><span class="dot ${conn === 'SUBSCRIBED' ? 'on' : ''}"></span>${conn === 'SUBSCRIBED' ? 'متصل' : 'جارٍ الاتصال…'}</span>
          <span class="code">رمز الصف ${T.room}</span>
          <button class="btn ghost" id="reset" style="font-size:17px;padding:8px 16px">${resetArm > Date.now() ? 'اضغطي للتأكيد' : 'جولة جديدة'}</button>
        </div>
      </div>
      <div class="t-body">${body()}</div>
    </div>`;
    $$('[data-st]').forEach((b) => b.onclick = () => setStage(b.dataset.st));
    $('#reset').onclick = () => {
      if (resetArm > Date.now()) { const keep = {room: T.room, groupsCount: T.groupsCount, names: T.names}; T = Object.assign(fresh(), keep); groups = {}; save(); broadcast(); resetArm = 0; toast('بدأت جولة جديدة'); render(); }
      else { resetArm = Date.now() + 3000; render(); setTimeout(render, 3100); }
    };
    wire();
  }

  function body() {
    if (T.stage === 'video') {
      return `<div class="vid"><video id="vid" src="hook.mp4" poster="poster.jpg" controls playsinline preload="auto"></video></div>
        <div class="t-bar" style="margin-top:12px"><button class="btn primary" data-st2="game">التالي: لعبة التصنيف</button></div>`;
    }
    if (T.stage === 'game') return T.gameStart && !showJoin ? liveView() : joinView();
    if (T.stage === 'results') return resultsView();
    if (T.stage === 'quiz') return quizView();
    return '';
  }

  function joinView() {
    const n = T.groupsCount;
    const cols = n <= 4 ? 4 : n === 5 ? 5 : 6;
    return `<div class="t-bar">
        <span class="lead">امسحن الرمز بجهاز المجموعة</span>
        <span class="muted" style="font-size:20px;font-weight:700">أو افتحن الموقع واكتبن رمز الصف <b style="color:var(--ink)">${T.room}</b></span>
        <span class="pill" style="font-size:18px">عدد المجموعات
          ${[4, 5, 6].map((k) => `<button data-n="${k}" style="width:34px;height:34px;border-radius:50%;font-weight:800;${k === n ? 'background:var(--blue);color:#fff' : 'background:#fff'}">${k}</button>`).join('')}
        </span>
        ${T.gameStart ? `<button class="btn primary" id="back">رجوع إلى اللعبة</button>` : `<button class="btn yellow" id="start" style="font-size:26px;padding:14px 34px">بدء اللعبة ${bolt(26)}</button>`}
      </div>
      <div class="join" style="grid-template-columns:repeat(${cols},1fr)">
        ${Array.from({length: n}, (_, i) => i + 1).map((g) => `<div class="jcard" style="border-color:${online[g] ? COLORS[g - 1] : 'var(--line)'}">
          <div class="num" style="background:${COLORS[g - 1]}">${g}</div>
          <h3 contenteditable="true" spellcheck="false" data-name="${g}">${esc(T.names[g - 1])}</h3>
          <div class="qr">${qrSVG(groupUrl(g))}</div>
          <div class="st"><span class="dot ${online[g] ? 'on' : ''}"></span>${online[g] ? 'متّصلة' : 'بانتظار الانضمام'}</div>
        </div>`).join('')}
      </div>
      <p class="muted" style="text-align:center;font-size:16px;margin:12px 0 0">يمكن تعديل اسم أيّ مجموعة بالضغط عليه.</p>`;
  }

  function liveView() {
    const n = T.groupsCount;
    const allDone = T.finish.filter((f) => f.g <= n).length >= n;
    const order = T.finish.map((f) => f.g);
    return `<div class="t-bar">
        <span class="lead">${allDone ? 'أنهت جميع المجموعات التصنيف!' : 'اسحبن كلّ أداة إلى المصباح المناسب'}</span>
        <button class="btn ghost" id="showjoin">رموز الانضمام</button>
        <button class="btn ${allDone ? 'yellow' : 'primary'}" data-st2="results">عرض النتائج</button>
      </div>
      <div class="live" style="grid-template-columns:repeat(${n},1fr)">
        ${Array.from({length: n}, (_, i) => i + 1).map((g) => {
          const p = groups[g] || {placed: {}, mistakes: 0};
          const placed = p.placed || {};
          const cnt = Object.keys(placed).length;
          const on = Object.keys(placed).filter((k) => placed[k] === 'on');
          const off = Object.keys(placed).filter((k) => placed[k] === 'off');
          const rank = order.indexOf(g);
          const fin = T.finish.find((f) => f.g === g);
          const w = wrongs[g] && wrongs[g].until > Date.now() ? wrongs[g] : null;
          return `<div class="col ${online[g] || groups[g] ? '' : 'off-line'}" style="border-color:${COLORS[g - 1]}33">
            <div class="ch" style="background:${COLORS[g - 1]}"><span class="n">${g}</span><h3>${esc(T.names[g - 1])}</h3><span class="dot ${online[g] ? 'on' : ''}" style="background:${online[g] ? '#fff' : 'rgba(255,255,255,.4)'}"></span></div>
            <div class="pg"><div class="bar"><i style="width:${(cnt / GAME_IDS.length) * 100}%;background:${COLORS[g - 1]}"></i></div><span>${cnt}/${GAME_IDS.length}</span></div>
            <div class="mz on"><div class="mh">${bulbSVG(30, true)}يضيء · موصِل</div><div class="th">${on.map((id) => `<img src="${img(id)}" alt="${esc(item(id).name)}" title="${esc(item(id).name)}">`).join('')}</div></div>
            <div class="mz off" style="margin-bottom:0"><div class="mh">${bulbSVG(30, false)}لا يضيء · عازِل</div><div class="th">${off.map((id) => `<img src="${img(id)}" alt="${esc(item(id).name)}" title="${esc(item(id).name)}">`).join('')}</div></div>
            <div class="ft"><span class="mis">${p.mistakes ? `محاولات خاطئة: ${p.mistakes}` : ''}</span><span>${fin ? fmt(fin.t) : ''}</span></div>
            ${fin ? `<div class="done ${rank === 0 ? 'first' : ''}">${rank === 0 ? 'الأولى! ' : ''}المركز ${rank + 1}</div>` : ''}
            ${w ? `<div class="wrongflash">${esc(item(w.id).name)} ✗ ${w.bin === 'on' ? 'ليست مُوصِلة' : 'ليست عازِلة'}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
  }

  function resultsView() {
    const r = ranking();
    const medal = ['#FFC531', '#A9B4C6', '#D08A4E'];
    const pod = [r[1], r[0], r[2]].map((g, i) => {
      if (!g) return '<div class="pod"></div>';
      const place = [2, 1, 3][i], fin = T.finish.find((f) => f.g === g);
      const h = place === 1 ? 210 : place === 2 ? 150 : 110;
      return `<div class="pod"><div class="medal" style="background:${medal[place - 1]}">${place}</div>
        <div class="nm">${esc(T.names[g - 1])}</div><div class="tm">${fin ? fmt(fin.t) + (fin.m ? ` · ${fin.m} خطأ` : ' · بلا أخطاء') : 'لم تُكمل'}</div>
        <div class="blk" style="height:${h}px;background:${COLORS[g - 1]}">${g}</div></div>`;
    }).join('');
    const list = r.slice(3).map((g, i) => {
      const fin = T.finish.find((f) => f.g === g), p = groups[g];
      return `<div class="rank-row"><span class="r">${i + 4}</span><span class="sw" style="background:${COLORS[g - 1]}"></span><span class="grow">${esc(T.names[g - 1])}</span><span class="muted">${fin ? fmt(fin.t) : `${p ? Object.keys(p.placed || {}).length : 0}/${GAME_IDS.length}`}</span></div>`;
    }).join('');
    const cond = GAME_IDS.filter((id) => item(id).cond), ins = GAME_IDS.filter((id) => !item(id).cond);
    const tiles = (ids) => ids.map((id) => `<div><img src="${img(id)}" alt=""><span>${esc(item(id).name)}</span></div>`).join('');
    return `<div class="res">
      <div><div class="podium">${pod}</div><div class="rank-list">${list}</div></div>
      <div class="key">
        <h2>الإجابة الصحيحة</h2>
        <div class="kz on"><div class="kh">${bulbSVG(54, true)}<div><h3>المصباح يضيء</h3><p>مُوصِلات كهربائية</p></div></div><div class="ki">${tiles(cond)}</div></div>
        <div class="kz off"><div class="kh">${bulbSVG(54, false)}<div><h3>المصباح لا يضيء</h3><p>عوازِل كهربائية</p></div></div><div class="ki">${tiles(ins)}</div></div>
        <div class="rule"><b>المُوصِل الكهربائي:</b> مادّة تسمح بسريان التيار الكهربائي عبرها، مثل الفلزّات (الحديد، النحاس، الألمنيوم).<br><b>العازِل الكهربائي:</b> مادّة لا تسمح بسريان التيار الكهربائي عبرها، مثل الخشب والبلاستيك والمطّاط والزجاج.</div>
        <div class="t-bar"><button class="btn primary" data-st2="quiz">التالي: أسئلة التقييم</button></div>
      </div>
    </div>`;
  }

  function quizView() {
    const n = T.groupsCount, ids = Array.from({length: n}, (_, i) => i + 1);
    if (T.quizIdx >= QUIZ.length) {
      const sc = ids.map((g) => ({g, s: QUIZ.reduce((a, q, qi) => a + ((groups[g]?.answers || {})[qi] === q.a ? 1 : 0), 0)}));
      return `<div class="tq"><h2>نتيجة التقييم</h2><div class="score">${sc.map(({g, s}) => `<div class="row"><span style="width:220px">${esc(T.names[g - 1])}</span><div class="bar"><i style="width:${(s / QUIZ.length) * 100}%;background:${COLORS[g - 1]}"></i></div><span style="direction:ltr">${s}/${QUIZ.length}</span></div>`).join('')}</div>
        <div class="t-bar"><button class="btn ghost" id="qprev">السؤال السابق</button></div></div>`;
    }
    const q = QUIZ[T.quizIdx];
    const who = ids.map((g) => {
      const a = (groups[g]?.answers || {})[T.quizIdx];
      if (a === undefined) return `<span class="pill wait">${esc(T.names[g - 1])} · بانتظار…</span>`;
      if (!T.reveal) return `<span class="pill" style="background:${COLORS[g - 1]}">${esc(T.names[g - 1])} ${check(18)}</span>`;
      const ok = a === q.a;
      return `<span class="pill" style="background:${ok ? 'var(--green)' : 'var(--red)'}">${esc(T.names[g - 1])} ${ok ? check(18) : cross(18)} ${LETTERS[a]}</span>`;
    }).join('');
    return `<div class="tq">
      <div class="qn">السؤال ${T.quizIdx + 1} من ${QUIZ.length}</div>
      <h2>${esc(q.q)}</h2>
      <div class="opts">${q.o.map((o, i) => `<div class="opt ${T.reveal ? (i === q.a ? 'right' : '') : ''}"><span class="let">${LETTERS[i]}</span>${optImg(o) ? `<img src="${img(optImg(o))}" alt="">` : ''}<span>${esc(optText(o))}</span></div>`).join('')}</div>
      <div class="who">${who}</div>
      ${T.reveal ? `<div class="exp">${esc(q.x)}</div>` : ''}
      <div class="t-bar">
        <button class="btn ghost" id="qprev" ${T.quizIdx === 0 ? 'disabled' : ''}>السابق</button>
        ${T.reveal ? '' : '<button class="btn yellow" id="qrev">إظهار الإجابة</button>'}
        <button class="btn primary" id="qnext">${T.quizIdx === QUIZ.length - 1 ? 'النتيجة النهائية' : 'السؤال التالي'}</button>
      </div>
    </div>`;
  }

  function wire() {
    $$('[data-st2]').forEach((b) => b.onclick = () => setStage(b.dataset.st2));
    const st = $('#start');
    if (st) st.onclick = () => { T.gameStart = Date.now(); T.finish = []; save(); broadcast(); SFX.ping(); render(); };
    const bk = $('#back'); if (bk) bk.onclick = () => { showJoin = false; render(); };
    const sj = $('#showjoin'); if (sj) sj.onclick = () => { showJoin = true; render(); };
    $$('[data-n]').forEach((b) => b.onclick = () => { T.groupsCount = +b.dataset.n; save(); broadcast(); render(); });
    $$('[data-name]').forEach((h) => {
      h.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); h.blur(); } };
      h.onblur = () => { const g = +h.dataset.name; const v = h.textContent.trim().slice(0, 24); T.names[g - 1] = v || 'المجموعة ' + g; save(); broadcast(); setTimeout(render, 0); };
    });
    const qp = $('#qprev'); if (qp) qp.onclick = () => { T.quizIdx = Math.max(0, T.quizIdx - 1); T.reveal = false; save(); broadcast(); render(); };
    const qn = $('#qnext'); if (qn) qn.onclick = () => { T.quizIdx = Math.min(QUIZ.length, T.quizIdx + 1); T.reveal = false; save(); broadcast(); render(); };
    const qr = $('#qrev'); if (qr) qr.onclick = () => { T.reveal = true; save(); broadcast(); SFX.ok(); render(); };
  }

  setInterval(() => { const el = $('#timer'); if (el && T.gameStart && T.finish.length < T.groupsCount) el.textContent = fmt(Date.now() - T.gameStart); }, 500);
  render();
}

/* ================= جهاز المجموعة ================= */
function Group(g, room) {
  if (!(g >= 1 && g <= 6) || !/^\d{4}$/.test(room || '')) { location.hash = '#/'; return; }
  LS.set('zk-last-room', room);
  const key = `zk-g-${room}-${g}`;
  const color = COLORS[g - 1];
  const fresh = (epoch) => ({epoch, placed: {}, order: shuffle(GAME_IDS), mistakes: 0, done: false, answers: {}, lastWrong: null});
  let S = LS.get(key, null) || fresh(null);
  let TS = null; // حالة المعلمة
  let conn = 'CONNECTING';
  let offline = false;
  let sel = null;
  const save = () => LS.set(key, S);
  const name = () => (TS && TS.names ? TS.names[g - 1] : 'المجموعة ' + g);

  const payload = () => ({epoch: S.epoch, g, placed: S.placed, mistakes: S.mistakes, done: S.done, answers: S.answers, lastWrong: S.lastWrong});
  let link;
  const send = () => link && S.epoch && link.send('G', payload());
  link = connect(room, {key: 'g' + g + '-' + rnd(1e6), role: 'group', g}, {
    T(p) {
      const first = !TS;
      const prevStage = TS && TS.stage, prevOn = TS && TS.gameOn, prevQ = TS && TS.quizIdx, prevRev = TS && TS.reveal;
      TS = p;
      if (S.epoch !== p.epoch) { S = fresh(p.epoch); save(); }
      if (first) send();
      const changed = first || prevStage !== p.stage || prevOn !== p.gameOn || prevQ !== p.quizIdx || prevRev !== p.reveal;
      if (p.gameOn && !prevOn && !first) { SFX.ping(); keepAwake(); }
      if (changed) render(); else refreshBadge();
    },
    hello() { send(); },
    status(st) { conn = st; refreshBadge(); },
    ready() { link.send('hi', {g}); send(); },
  });
  setInterval(send, 5000);
  setTimeout(() => { if (!TS) render(); }, 8000);

  function top() {
    const cnt = Object.keys(S.placed).length;
    return `<div class="g-top">
      <div class="g-badge" style="background:${color}"><b>${g}</b><span id="gname">${esc(name())}</span></div>
      <div class="title">${bolt(26)} موصِل أم عازِل؟</div>
      <div class="g-prog"><div class="bar"><i style="width:${(cnt / GAME_IDS.length) * 100}%"></i></div><span>${cnt}/${GAME_IDS.length}</span>
      <span class="dot ${conn === 'SUBSCRIBED' ? 'on' : ''}" id="cdot" title="الاتصال"></span></div>
    </div>`;
  }
  function refreshBadge() { const d = $('#cdot'); if (d) d.className = 'dot ' + (conn === 'SUBSCRIBED' ? 'on' : ''); const n = $('#gname'); if (n) n.textContent = name(); }

  function render() {
    const gameOn = offline || (TS && TS.gameOn);
    const stage = offline ? 'game' : TS ? TS.stage : null;
    let inner = '';
    if (!TS && !offline) {
      inner = `<div class="wait"><div class="big-badge" style="background:${color}">${g}</div><div class="spin"></div>
        <h2>جارٍ الاتصال بشاشة المعلمة…</h2><p>رمز الصف: <b style="direction:ltr;display:inline-block">${room}</b></p>
        <button class="btn ghost" id="offline" style="margin-top:8px">اللعب بدون اتصال</button></div>`;
    } else if (stage === 'quiz') {
      inner = quizUI();
    } else if (stage === 'results') {
      const rank = TS.finish ? TS.finish.findIndex((f) => f.g === g) : -1;
      inner = `<div class="wait">${bulbSVG(170, true)}<h2>${rank >= 0 ? `حصلت ${esc(name())} على المركز ${rank + 1}` : 'انتهت اللعبة'}</h2><p>انظرن إلى السبورة لنرى الإجابة الصحيحة معًا</p></div>`;
    } else if (stage === 'game' && gameOn) {
      if (S.done) {
        inner = `<div class="wait">${bulbSVG(190, true)}<h2>أحسنتُنّ! أكملتُنّ التصنيف</h2>
          <p>${S.mistakes ? `عدد المحاولات الخاطئة: ${S.mistakes}` : 'بلا أيّ خطأ، رائع!'}</p><p>انظرن إلى السبورة…</p></div>`;
      } else return renderGame();
    } else {
      inner = `<div class="wait"><div class="big-badge" style="background:${color}">${g}</div>
        <h2>${esc(name())}</h2><p>${stage === 'video' ? 'شاهدن التجربة على السبورة…' : 'استعددن! ستبدأ اللعبة بعد قليل'}</p>${bulbSVG(120, false)}</div>`;
    }
    app.innerHTML = `<div class="g-wrap">${top()}${inner}</div>`;
    const ob = $('#offline'); if (ob) ob.onclick = () => { offline = true; if (!S.epoch) { S = fresh('offline'); save(); } render(); };
    $$('[data-opt]').forEach((b) => b.onclick = () => {
      if (!TS || TS.reveal) return;
      S.answers[TS.quizIdx] = +b.dataset.opt; save(); send(); SFX.pick(); render();
    });
  }

  function quizUI() {
    const qi = TS.quizIdx;
    if (qi >= QUIZ.length) {
      const s = QUIZ.reduce((a, q, i) => a + (S.answers[i] === q.a ? 1 : 0), 0);
      return `<div class="wait">${bulbSVG(150, true)}<h2>انتهى التقييم</h2><p>إجابات صحيحة: ${s} من ${QUIZ.length}</p></div>`;
    }
    const q = QUIZ[qi], mine = S.answers[qi];
    return `<div class="gq"><div class="qn">السؤال ${qi + 1} من ${QUIZ.length}</div><h2>${esc(q.q)}</h2>
      <div class="opts">${q.o.map((o, i) => {
        let c = mine === i ? 'picked' : '';
        if (TS.reveal) c = i === q.a ? 'right' : mine === i ? 'wrong' : '';
        return `<button class="opt ${c}" data-opt="${i}"><span class="let">${LETTERS[i]}</span>${optImg(o) ? `<img src="${img(optImg(o))}" alt="">` : ''}<span>${esc(optText(o))}</span></button>`;
      }).join('')}</div>
      <div class="note">${TS.reveal ? (mine === q.a ? 'إجابة صحيحة! أحسنتُنّ' : mine === undefined ? 'لم تُرسَل إجابة' : 'الإجابة الصحيحة باللون الأخضر') + ` · ${esc(q.x)}` : mine === undefined ? 'اخترن إجابة واحدة' : 'تمّ إرسال إجابتكنّ · يمكن تغييرها قبل إظهار الإجابة'}</div></div>`;
  }

  /* ---------- اللعبة ---------- */
  function renderGame() {
    const rem = S.order.filter((id) => !S.placed[id]);
    const bin = (b) => S.order.filter((id) => S.placed[id] === b).map((id) => `<div class="chip"><img src="${img(id)}" alt=""><span>${esc(item(id).name)}</span></div>`).join('');
    app.innerHTML = `<div class="g-wrap">${top()}
      <div class="zones">
        <div class="zone on" data-zone="on"><div class="z-head">${bulbSVG(92, true, 'zb')}<div><h3>المصباح يضيء</h3><p>مُوصِل كهربائي</p></div></div><div class="bin">${bin('on')}</div></div>
        <div class="zone off" data-zone="off"><div class="z-head">${bulbSVG(92, false)}<div><h3>المصباح لا يضيء</h3><p>عازِل كهربائي</p></div></div><div class="bin">${bin('off')}</div></div>
      </div>
      <div class="tray-wrap"><div class="tray-hint">اسحبن كلّ أداة إلى المصباح المناسب، أو المسنها ثم المسن المصباح</div>
        <div class="tray">${rem.map((id) => `<div class="card ${sel === id ? 'sel' : ''}" data-id="${id}"><img src="${img(id)}" alt=""><span>${esc(item(id).name)}</span></div>`).join('')}</div></div>
    </div>`;
    $$('.zone').forEach((z) => {
      z.classList.toggle('armed', !!sel);
      z.onclick = () => { if (sel) attempt(sel, z.dataset.zone); };
    });
    $$('.card').forEach(bindCard);
  }

  let drag = null;
  function zoneAt(x, y) { const el = document.elementFromPoint(x, y); return el ? el.closest('[data-zone]') : null; }
  function bindCard(card) {
    card.onpointerdown = (e) => {
      e.preventDefault(); ac(); keepAwake();
      drag = {id: card.dataset.id, card, x0: e.clientX, y0: e.clientY, moving: false, clone: null, pid: e.pointerId};
      try { card.setPointerCapture(e.pointerId); } catch (er) {}
    };
    card.onpointermove = (e) => {
      if (!drag || drag.card !== card) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moving && Math.hypot(dx, dy) > 8) {
        drag.moving = true; SFX.pick();
        const c = card.cloneNode(true); c.classList.add('drag'); c.classList.remove('sel');
        c.style.width = card.offsetWidth + 'px'; document.body.appendChild(c); drag.clone = c; card.classList.add('ghosted');
      }
      if (drag.moving) {
        drag.clone.style.left = e.clientX + 'px'; drag.clone.style.top = e.clientY + 'px';
        const z = zoneAt(e.clientX, e.clientY);
        $$('.zone').forEach((zz) => zz.classList.toggle('hover', zz === z));
      }
    };
    const end = (e) => {
      if (!drag || drag.card !== card) return;
      const d = drag; drag = null;
      $$('.zone').forEach((zz) => zz.classList.remove('hover'));
      if (d.moving) {
        d.clone.remove();
        const z = e.type === 'pointerup' ? zoneAt(e.clientX, e.clientY) : null;
        card.classList.remove('ghosted');
        if (z) attempt(d.id, z.dataset.zone); else { sel = null; renderGame(); }
      } else {
        sel = sel === d.id ? null : d.id; SFX.pick();
        $$('.card').forEach((c) => c.classList.toggle('sel', c.dataset.id === sel));
        $$('.zone').forEach((z) => z.classList.toggle('armed', !!sel));
      }
    };
    card.onpointerup = end; card.onpointercancel = end;
  }

  function attempt(id, b) {
    const it = item(id);
    sel = null;
    const right = it.cond === (b === 'on');
    if (right) {
      S.placed[id] = b; S.lastWrong = null; save(); send();
      renderGame();
      if (b === 'on') { SFX.light(); const zb = $('.zb'); if (zb) { zb.classList.remove('flash'); void zb.offsetWidth; zb.classList.add('flash'); } toast(`صحيح! ${it.name}: مُوصِل`, 'ok'); }
      else { SFX.ok(); toast(`صحيح! ${it.name}: عازِل`, 'ok'); }
      if (Object.keys(S.placed).length === GAME_IDS.length) {
        S.done = true; save(); send();
        setTimeout(() => { confetti(); SFX.win(); render(); }, 700);
      }
    } else {
      S.mistakes++; S.lastWrong = {id, bin: b, at: Date.now()}; save(); send();
      SFX.bad(); toast('فكّرن مرة أخرى!', 'bad');
      renderGame();
      const c = $(`.card[data-id="${id}"]`); if (c) { c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 500); }
    }
  }

  // تحميل الصور مسبقًا
  ITEMS.forEach((i) => { const im = new Image(); im.src = img(i.id); });
  render();
}

/* ================= التوجيه ================= */
function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs || '');
  if (parts[0] === 'teacher') Teacher();
  else if (parts[0] === 'g') Group(+parts[1], q.get('r'));
  else Home();
}
window.addEventListener('hashchange', () => location.reload());
route();
})();
