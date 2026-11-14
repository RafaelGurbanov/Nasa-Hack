/*
 * Storybook user interface (ages 7-12), in English and Azerbaijani.
 * Reads state from MissionCore (src/game.js) and calls its actions from buttons. No game rules here.
 * All text comes from locales/*.json through I18N.t(); pictures from src/art.js; sounds from src/sound.js.
 */
(function () {
  "use strict";
  const C = window.MissionCore, A = window.Art, I = window.I18N, Sfx = window.Sfx || { play() {}, toggle() { return false; }, on: false };
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => I.t(k, v);
  const tt = (o) => (o && o.k === "_join" ? o.parts.map(tt).join(": ").replace(/: (?=[^:]*$)/, " ") : o ? t(o.k, o.v) : "");

  /** Create an element safely: text only, never HTML from data. */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "href") { if (/^https:\/\//.test(v)) { n.href = v; n.target = "_blank"; n.rel = "noopener"; } }
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k));
    return n;
  }
  /** Wrap a trusted SVG string from Art (fixed shapes only) in an element. */
  function art(svg, cls) { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = svg; return d; }
  const rovi = (mood) => A.rovi(mood, t("aria.rovi", { mood: t("mood." + mood) }));
  const face = (i, mood) => A.face(i, mood, t("aria.face", { name: CREW[i].name, mood: t("mood." + mood) }));

  if (!C || !A || !I) {
    const b = $("banner"); b.textContent = I ? t("banner.missing") : "Data file data/events.js is missing."; b.classList.remove("hidden");
    return;
  }

  const { D, RULES, O2_NEED, BASE_DOSE, QUIZ } = C;
  const S = () => C.state;
  const num = (x, d) => I.num(x, d);
  const SCREENS = ["scrIntro", "scrQuiz", "scrGame", "scrEnd", "scrResults"];
  let current = "scrIntro";
  function show(id) {
    current = id;
    SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
    document.body.classList.remove("alarm");
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- crew */
  const CREW = [{ name: "Aylin", icon: "🫧", c: "var(--air)" }, { name: "Kofi", icon: "⚡", c: "var(--energy)" },
                { name: "Mei", icon: "🥕", c: "var(--food)" }, { name: "Leo", icon: "🛡️", c: "var(--shield)" }];
  const SCORE = { cheering: 1, happy: 1, ok: 0.8, worried: 0.55, scared: 0.3, sad: 0.15 };

  /** Each astronaut reacts to "their" system. */
  function crewStatus(s, storm, beforeRun) {
    const used = s.alloc.ls + s.alloc.gh + s.alloc.sh + (s.alloc.sci || 0);
    const o2Sols = s.o2 / O2_NEED, foodSols = s.food / RULES.foodNeed, doseFrac = s.dose / RULES.doseLimit;
    const air = o2Sols >= 2.5 && s.water >= 60 ? "happy" : o2Sols >= 1.5 && s.water >= 40 ? "ok" : o2Sols >= 0.8 && s.water >= 25 ? "worried" : "scared";
    const energy = used === RULES.power ? "happy" : used === RULES.power - 1 ? "ok" : "worried";
    const food = foodSols >= 3 ? "happy" : foodSols >= 2 ? "ok" : foodSols >= 1 ? "worried" : "scared";
    let safe = doseFrac < 0.35 ? "happy" : doseFrac < 0.55 ? "ok" : doseFrac < 0.75 ? "worried" : "scared";
    if (beforeRun && storm && s.alloc.sh < 2 && (safe === "happy" || safe === "ok")) safe = "worried";
    const moods = [air, energy, food, safe];
    if (s.fail) { const who = { o2: 0, water: 0, food: 2, dose: 3 }[s.fail]; moods.forEach((m, i) => { moods[i] = i === who ? "sad" : "worried"; }); }
    else if (s.ended) moods.fill("cheering");
    return {
      moods,
      bars: [Math.min(s.o2 / RULES.o2Max, s.water / 100), used / RULES.power, s.food / RULES.foodMax, 1 - doseFrac],
      values: [t("crew.v0", { o2: Math.max(0, s.o2), water: Math.round(Math.max(0, s.water)) }), t("crew.v1", { used, power: RULES.power }),
               t("crew.v2", { food: Math.round(Math.max(0, s.food)) }), t("crew.v3", { dose: s.dose, limit: RULES.doseLimit })],
      health: moods.reduce((a, m) => a + SCORE[m], 0) / 4
    };
  }

  /** Rovi says ONE short sentence per sol. */
  function roviBefore(s, sd) {
    if (sd.seps.length) return ["scared", "rovi.storm"];
    if (s.o2 < O2_NEED * 1.5) return ["worried", "rovi.air"];
    if (s.food < RULES.foodNeed * 1.5) return ["worried", "rovi.food"];
    if (s.dose > RULES.doseLimit * 0.6) return ["worried", "rovi.dose"];
    if (sd.flares.length) return ["happy", "rovi.flare"];
    return ["happy", "rovi.calm"];
  }
  function roviAfter(s, r) {
    if (s.fail) return ["scared", "rovi.fail"];
    if (r.sepCount && r.alloc.sh >= 2) return ["cheering", "rovi.goodShield"];
    if (r.sepCount) return ["worried", "rovi.stormIn"];
    if (r.o2Delta < 0 || r.foodDelta < 0) return ["worried", "rovi.down"];
    return ["cheering", "rovi.good"];
  }
  let roviNow = ["happy", "rovi.calm"];
  function setRovi(mood, key) { roviNow = [mood, key]; $("roviArt").innerHTML = rovi(mood); $("roviSay").textContent = t(key); }

  /* ---------------------------------------------------------------- intro (one idea per page) */
  let page = 0;
  const PAGES = [
    () => ({ art: art(A.scene("i1"), "panel art tilt-l scene"), n: 1, rovi: "happy", vars: {} }),
    () => ({ art: el("div", { class: "panel art halftone crewgrid-big tilt-r" },
        ...CREW.map((p, i) => el("div", { class: "who" }, art(face(i, "happy")), el("b", {}, p.name), t(`crew.${i}.job`)))), n: 2, rovi: "happy", vars: {} }),
    () => ({ art: art(A.scene("i3"), "panel art tilt-l scene storm"), n: 3, rovi: "worried", vars: {} }),
    () => ({ art: el("div", { class: "panel art halftone cards-demo tilt-r" },
        el("div", {}, el("span", {}, "🫧"), t("sys.ls")), el("div", {}, el("span", {}, "🥕"), t("sys.gh")), el("div", {}, el("span", {}, "🛡️"), t("sys.sh"))),
      n: 4, rovi: "cheering", vars: { power: RULES.power } })
  ];
  function renderIntro() {
    const p = PAGES[page](), pre = `intro.${p.n}.`;
    const lines = ["p1", "p2", "p3"].filter((k) => I.has(pre + k)).map((k) => el("p", {}, t(pre + k, p.vars)));
    const textCol = el("div", { class: "text" },
      el("span", { class: "caption" }, t("intro.page", { n: page + 1, total: PAGES.length })),
      el("h2", {}, t(pre + "title")), ...lines,
      el("div", { class: "roviline" }, art(rovi(p.rovi)), el("div", { class: "bubble left" }, t(pre + "rovi"))),
      el("div", { class: "dots", "aria-hidden": "true" }, ...PAGES.map((_, i) => el("i", { class: i === page ? "on" : "" }))),
      el("div", { class: "row", style: "margin-top:18px" },
        page > 0 ? el("button", { class: "btn plain", id: "btnBack", type: "button", onclick: () => { Sfx.play("click"); page--; renderIntro(); } }, t("btn.back")) : null,
        page < PAGES.length - 1
          ? el("button", { class: "btn", id: "btnIntroNext", type: "button", onclick: () => { Sfx.play("click"); page++; renderIntro(); } }, t("btn.next"))
          : el("button", { class: "btn red", id: "btnStart", type: "button", onclick: () => { Sfx.play("go"); startQuiz("pre"); } }, t("btn.startQuiz"))));
    $("scrIntro").replaceChildren(el("div", { class: "story" }, p.art, textCol));
    if (p.art.classList.contains("scene")) {
      p.art.append(el("div", { class: "dust" }, ...dustBits(14)), el("div", { class: "zap", "aria-hidden": "true" }, el("b", {}, "ZAP!")));
      A.updateScene(p.art, { storm: p.art.classList.contains("storm"), health: 1, shield: page === 2 ? 2 : 0, power: 5, food: 1 });
    }
  }
  function dustBits(n) {
    return Array.from({ length: n }, (_, i) => el("i", { style: `top:${(i * 37) % 95}%;width:${20 + (i * 13) % 50}px;animation-duration:${5 + (i * 7) % 7}s;animation-delay:-${(i * 1.3) % 6}s` }));
  }

  /* ---------------------------------------------------------------- quiz (one question per screen) */
  let quizPhase = "pre", qIndex = 0, picks = [];
  const scores = { pre: null, post: null };
  function startQuiz(phase) { quizPhase = phase; qIndex = 0; picks = []; renderQuestion(); show("scrQuiz"); }
  function renderQuestion() {
    const item = QUIZ[qIndex], q = `quiz.${item.n}.`;
    $("scrQuiz").replaceChildren(el("div", { class: "panel quiz tilt-r" },
      art(rovi(quizPhase === "pre" ? "worried" : "happy")),
      el("div", {},
        el("span", { class: "caption" }, `${t(quizPhase === "pre" ? "quiz.before" : "quiz.after")} · ${t("quiz.qof", { n: qIndex + 1, total: QUIZ.length })}`),
        el("h2", {}, t(q + "q")),
        el("div", { class: "answers" }, ...[0, 1, 2, 3].map((j) =>
          el("button", { class: "answer", type: "button", "data-q": String(qIndex), "data-a": String(j), onclick: () => answer(j) }, el("b", {}, "ABCD"[j]), t(q + "a" + j)))),
        el("p", { class: "hand", style: "margin-top:16px;font-size:22px" }, t(quizPhase === "pre" ? "quiz.hintPre" : "quiz.hintPost")))));
  }
  function answer(j) {
    Sfx.play("click");
    picks.push(j);
    if (++qIndex < QUIZ.length) return renderQuestion();
    scores[quizPhase] = picks.map((p, i) => p === QUIZ[i].correct);
    if (quizPhase === "pre") startGame(); else showResults();
  }

  /* ---------------------------------------------------------------- game screen */
  let scene;
  function renderStones() {
    $("stones").setAttribute("aria-label", t("stones.aria"));
    $("stones").replaceChildren(...C.storm.sols.map((s) => el("div", {
      class: "stone" + (s.sep_count ? " storm" : "") + (s.sol < S().sol ? " done" : "") + (s.sol === S().sol ? " now" : ""),
      title: t(s.sep_count ? "stone.storm" : "stone.title", { sol: s.sol }) }, String(s.sol), s.sep_count ? el("span", { class: "bolt" }, "⚡") : null)),
      el("div", { class: "starcount", title: t("stars.title") }, `⭐ ${S().stars}`));
  }
  function renderScene(beforeRun) {
    const s = S(), sd = C.solData(s.sol), st = crewStatus(s, sd.seps.length > 0, beforeRun);
    $("sceneTag").textContent = t("scene.tag", { sol: s.sol, total: C.storm.sols.length, level: levelName() });
    A.updateScene(scene, { storm: sd.seps.length > 0, health: st.health, shield: s.alloc.sh, power: C.used(), food: Math.max(0, s.food) / RULES.foodMax, fail: !!s.fail });
    return st;
  }
  function levelName() { return t("rule.mystery.k"); }
  function renderCrew(st) {
    $("crewPanel").replaceChildren(el("h3", {}, t("crew.title")), el("div", { class: "crewlist" }, ...CREW.map((p, i) =>
      el("div", { class: "crew" }, art(face(i, st.moods[i]), "facewrap"), el("div", {}, el("b", {}, p.name), " ", el("span", { class: "job" }, `${p.icon} ${t(`crew.${i}.job`)}`)),
        el("div", { class: "pill", role: "img", "aria-label": `${p.name}: ${st.values[i]}` }, el("i", { style: `--c:${p.c};width:${Math.max(3, Math.min(100, st.bars[i] * 100))}%` })),
        el("div", { class: "job" }, st.values[i])))));
  }
  function renderEvent() {
    const { flares, seps } = C.solData(S().sol);
    const card = $("eventCard");
    card.className = "panel event" + (seps.length ? " storm tilt-l" : " tilt-r");
    const kids = [el("span", { class: "caption" }, t("event.caption"))];
    const kind = seps.length ? "storm" : flares.length ? "flare" : "calm";
    kids.push(el("h3", {}, t(`event.${kind}.h`)), el("p", { class: "alerttxt" }, t(`event.${kind}.p`, { n: seps.length })));
    if (flares.length) kids.push(el("div", { class: "flarechips" }, t("event.flashes"),
      ...flares.map((f) => el("span", { class: "fx " + f.class_letter }, f.class)), el("span", { class: "job" }, t("event.legend"))));
    const det = el("details", {}, el("summary", {}, t("event.where")));
    flares.forEach((f) => det.append(el("div", { class: "src" }, t("src.flare", { cls: f.class, time: (f.peak_time || "").slice(11, 16) + " UTC", loc: f.source_location,
      ar: f.active_region ? t("src.ar", { ar: String(f.active_region) }) : "", linked: f.linked_sep_id ? t("src.linked") : "" }) + " " + t("src.source"), el("a", { href: f.record_url }, f.source_line))));
    seps.forEach((s) => det.append(el("div", { class: "src" }, t("src.source"), el("a", { href: s.record_url }, s.source_line), s.instruments.length ? ` (${s.instruments.join(", ")})` : "")));
    if (!flares.length && !seps.length) det.append(el("div", { class: "src" }, t("src.none")));
    kids.push(det);
    card.replaceChildren(...kids);
  }
  const SYSTEMS = [["ls", "🫧", "#bfeaff", "var(--air)"], ["gh", "🥕", "#c8f2cc", "var(--food)"], ["sh", "🛡️", "#e2d4ff", "var(--shield)"]];
  function renderPower() {
    const s = S(), used = C.used(), left = RULES.power - used;
    $("powerPanel").replaceChildren(
      el("h3", {}, t("power.title")),
      el("div", { class: "pcards" }, ...SYSTEMS.map(([k, icon, bg, col]) => {
        const lvl = s.alloc[k], name = t("sys." + k);
        return el("div", { class: "pcard", "data-sys": k },
          el("div", { class: "ico", style: `background:${bg}` }, icon), el("div", { class: "nm" }, name), el("div", { class: "what" }, t(`sys.${k}.what`)),
          el("div", { class: "ctl" },
            el("button", { type: "button", "data-k": k, "data-d": "-1", "aria-label": t("aria.less", { sys: name }), disabled: lvl <= 0 ? "" : null, onclick: () => { Sfx.play("down"); C.setLevel(k, lvl - 1); } }, "−"),
            el("span", { class: "pips", role: "img", "aria-label": t("aria.pips", { sys: name, lvl }) }, ...[0, 1, 2].map((i) => el("i", { style: i < lvl ? `background:${col}` : "" }))),
            el("button", { type: "button", "data-k": k, "data-d": "1", "aria-label": t("aria.more", { sys: name }), disabled: lvl >= RULES.maxLevel || left <= 0 ? "" : null, onclick: () => { Sfx.play("up"); C.setLevel(k, lvl + 1); } }, "+")));
      })),
      scienceBox(s, left),
      el("div", { class: "powerfoot", "data-sys": "energy" },
        el("div", { class: "powerleft" }, el("span", { class: "bolts", "aria-hidden": "true" }, "⚡".repeat(used) + "▫️".repeat(left)), " " + t("power.used", { used, power: RULES.power }) + (left ? t("power.left", { left }) : t("power.great"))),
        el("button", { class: "btn red", id: "btnGo", type: "button", onclick: runSol }, t("btn.go"))));
  }
  /** Optional science mission card (calm sols only): costs 1 power point, wins 1 star. */
  function scienceBox(s, left) {
    const m = C.missionFor(s.sol), on = s.alloc.sci === 1;
    if (!C.isCalm(s.sol) || !m) {
      return el("div", { class: "science off", "data-sys": "science" }, el("div", { class: "ico" }, "🔬"),
        el("div", {}, el("div", { class: "nm" }, t("sci.none.t")), el("div", { class: "what" }, t("sci.none.p"))));
    }
    return el("div", { class: "science" + (on ? " on" : ""), "data-sys": "science" }, el("div", { class: "ico" }, m.icon),
      el("div", {}, el("div", { class: "nm" }, t("sci.title", { title: t(`mission.${m.id}.title`) })), el("div", { class: "what" }, t("sci.what"))),
      el("button", { class: "btn" + (on ? " green" : ""), type: "button", id: "btnScience", "aria-pressed": String(on),
        disabled: !on && left <= 0 ? "" : null, onclick: () => { Sfx.play(on ? "down" : "up"); C.setLevel("sci", on ? 0 : 1); } }, t(on ? "sci.on" : "sci.do")));
  }

  /** Message from Earth: radio wave with the real light delay, DONKI-based warnings, advice from the last sol. */
  let earthTimer = null;
  function renderEarth(skipAnim) {
    const s = S(), st = C.storm, mins = st.light_delay && st.light_delay.minutes ? Math.round(st.light_delay.minutes) : null;
    const today = [], tomorrow = [];
    const adv = C.adviceArriving(s.sol);
    if (adv) today.push(el("p", {}, "📨 ", el("b", {}, t("earth.answer")), tt(adv.text), el("span", { class: "job" }, t("earth.answerNote"))));
    const srcLink = (b) => (b ? el("details", {}, el("summary", {}, t("earth.where")),
      el("div", { class: "src" }, t("src.source"), b.record_url ? el("a", { href: b.record_url }, b.source_line) : b.source_line)) : null);
    for (const w of C.earthWarnings(s.sol)) {
      const b = w.blast;
      const what = !b ? "" : b.kind === "flare" ? (b.class ? t("earth.blast.flareCls", { cls: b.class }) : t("earth.blast.flare")) : t("earth.blast.cme");
      if (w.status === "on_time") tomorrow.push(el("p", {}, "⚠️ ", el("b", {}, t("earth.warnB")), t("earth.warnP", { what })), srcLink(b));
      else if (w.status === "late") today.push(el("p", {}, "⏰ ", el("b", {}, t("earth.lateB")), t("earth.lateP", { what })), srcLink(b));
      else today.push(el("p", {}, t("earth.none")));
    }
    if (!today.length && !C.isCalm(s.sol)) {
      const warned = st.earth_warnings.some((w) => w.storm_sol === s.sol && w.status === "on_time");
      today.push(el("p", {}, "⚠️ ", el("b", {}, t("earth.stormB")), t(warned ? "earth.stormWarned" : "earth.stormHere")));
    }
    if (!today.length) today.push(el("p", {}, t("earth.quiet")));
    if (!tomorrow.length) tomorrow.push(el("p", {}, t("earth.noWarn")));
    const asked = s.advice && s.advice.askedSol === s.sol;
    $("earthPanel").replaceChildren(
      el("div", { class: "earthhead" }, el("h3", {}, t("earth.title")), mins ? el("span", { class: "delaychip" }, t("earth.delay", { min: mins })) : null),
      el("div", { class: "wave" + (skipAnim ? " done" : ""), role: "img", "aria-label": t("aria.wave") }, el("i")),
      mins ? el("p", { class: "job" }, t("earth.delayLine", { min: mins })) : null,
      el("p", { class: "msgwait" + (skipAnim ? " hidden" : "") }, t("earth.waiting")),
      el("div", { class: "msgs" + (skipAnim ? "" : " waiting") },
        el("div", { class: "msgcard today" }, el("h4", {}, t("earth.today")), ...today),
        el("div", { class: "msgcard tomorrow" + (C.earthWarnings(s.sol).some((w) => w.status === "on_time") ? " alert" : "") }, el("h4", {}, t("earth.tomorrow")), ...tomorrow)),
      el("div", { class: "row", style: "margin-top:10px" },
        el("button", { class: "btn plain", id: "btnAsk", type: "button", disabled: asked || s.fail ? "" : null, onclick: () => { Sfx.play("click"); C.askEarth(); } }, t(asked ? "earth.sent" : "earth.ask")),
        el("span", { class: "job" }, t("earth.why", { min: mins || "?", m1: C.val("mars_trip_months"), m2: C.val("mars_trip_months_max") }))));
    if (!skipAnim) {
      clearTimeout(earthTimer);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      earthTimer = setTimeout(() => { const m = $("earthPanel").querySelector(".msgs"), w = $("earthPanel").querySelector(".msgwait");
        if (m) m.classList.remove("waiting"); if (w) w.classList.add("hidden"); }, reduce ? 0 : 3000);
    }
  }

  function renderSol() {
    const s = S(), sd = C.solData(s.sol);
    renderStones(); renderEvent(); renderPower(); renderEarth(false);
    const st = renderScene(true); renderCrew(st);
    setRovi(...roviBefore(s, sd));
    $("powerPanel").classList.remove("hidden"); $("reportPanel").classList.add("hidden");
    if (sd.seps.length) Sfx.play("zap");
  }
  function runSol() { Sfx.play("go"); C.runSol(); }
  let lastReport = null;
  function renderReport(r) {
    lastReport = r;
    const s = S(), st = renderScene(false); renderCrew(st);
    setRovi(...roviAfter(s, r));
    const li = (ok, good, bad, v) => el("li", {}, t(ok ? good : bad, v));
    $("reportPanel").replaceChildren(
      el("h3", {}, t(s.fail ? "report.titleBad" : "report.titleOk", { sol: r.sol })),
      el("ul", {},
        li(r.o2Delta >= 0, "report.airOk", "report.airBad", { d_o2: r.o2Delta }),
        li(r.rec >= 0.98, "report.waterOk", "report.waterBad", { d_w: r.waterDelta }),
        li(r.foodDelta >= 0, "report.foodOk", "report.foodBad", { d_f: r.foodDelta }),
        el("li", {}, r.sepCount ? t(r.alloc.sh >= 2 ? "report.shieldGood" : "report.shieldBad", { dose: r.stormDose }) : t("report.calm", { dose: BASE_DOSE })),
        r.sci && r.mission ? el("li", {}, t("report.sci", { title: t(`mission.${r.mission.id}.title`), fact: t(`mission.${r.mission.id}.fact`) })) : null),
      el("div", { class: "fact" }, el("b", {}, t("report.fact")), tt(r.fact)),
      el("div", { class: "row", style: "margin-top:16px" },
        el("button", { class: "btn green", id: "btnNext", type: "button", onclick: () => { Sfx.play("click"); C.nextSol(); } },
          t(s.fail ? "btn.seeWhat" : s.sol >= C.storm.sols.length ? "btn.finish" : "btn.nextSol"))));
    $("powerPanel").classList.add("hidden"); $("reportPanel").classList.remove("hidden");
    $("reportPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function startGame() {
    C.newGame("random");
    show("scrGame");
    renderSol();
  }

  /* ---------------------------------------------------------------- "The Sun today" (live NASA data, archived fallback) */
  const MEDAL = { Gold: "🥇", Silver: "🥈", Bronze: "🥉" };
  function countBigFlares(notes) {
    const seen = new Set();
    for (const n of notes || []) {
      const b = (n.messageBody || "").replace(/\s+/g, " ");
      const c = b.match(/Flare intensity:\s*([ABCMX]\d+(?:\.\d+)?) class/), tm = b.match(/Flare start time:\s*(\S+?)\./);
      if (c && tm) seen.add(tm[1] + c[1]);
    }
    return seen.size;
  }
  let sunData = null;
  async function loadSunToday() {
    const iso = (d) => d.toISOString().slice(0, 10);
    const end = new Date(), start = new Date(end.getTime() - 7 * 864e5);
    const q = `startDate=${iso(start)}&endDate=${iso(end)}&api_key=DEMO_KEY`;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const get = (u) => fetch(u, { signal: ctl.signal }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then((x) => (x.trim() ? JSON.parse(x) : []));
    // Cache a live answer for 3 hours: the shared DEMO_KEY allows only a few calls per hour per network.
    try { const c = JSON.parse(localStorage.getItem("msr-sun") || "null"); if (c && c.live && Date.now() - c.t < 3 * 36e5) { sunData = c; clearTimeout(timer); return renderSun(); } } catch (e) { /* no storage */ }
    try {
      if (navigator.onLine === false) throw new Error("offline");
      const [notes, sep] = await Promise.all([get(`https://api.nasa.gov/DONKI/notifications?${q}&type=FLR`), get(`https://api.nasa.gov/DONKI/SEP?${q}`)]);
      sunData = { live: true, start: iso(start), end: iso(end), big_flares: countBigFlares(notes), sep_records: Array.isArray(sep) ? sep.length : 0 };
      try { localStorage.setItem("msr-sun", JSON.stringify(Object.assign({ t: Date.now() }, sunData))); } catch (e) { /* no storage */ }
    } catch (e) {
      sunData = D.sun_today_archive ? Object.assign({ live: false }, D.sun_today_archive) : { none: true };
    } finally { clearTimeout(timer); }
    renderSun();
  }
  function renderSun() {
    const box = $("sunToday"); if (!box) return;
    const x = sunData;
    if (!x) { box.replaceChildren(el("h3", {}, t("sun.title")), el("p", {}, t("sun.asking"))); return; }
    if (x.none) { box.replaceChildren(el("h3", {}, t("sun.title")), el("p", {}, t("sun.none"))); return; }
    const facts = t("sun.facts", { flares: x.big_flares, seps: x.sep_records });
    box.replaceChildren(
      el("h3", {}, t(x.live ? "sun.liveTitle" : "sun.archTitle")),
      el("p", {}, t(x.live ? "sun.live" : "sun.arch", { start: x.start, end: x.end, facts })),
      el("p", { class: "hand", style: "font-size:24px" }, t("sun.q")),
      el("p", { class: "job" }, (x.live ? t("sun.liveNote") : t("sun.archNote", { date: String(x.fetched_at).slice(0, 10) })) + t("sun.big")));
  }

  /* ---------------------------------------------------------------- end */
  function endGame() {
    const s = S(), won = !s.fail, st = crewStatus(s, false, false), chain = C.buildChain(s), stm = C.storm, rk = C.rank(s);
    $("scrEnd").replaceChildren(
      el("div", { class: "panel endhead " + (won ? "win halftone" : "fail") },
        art(rovi(won ? "cheering" : "scared")),
        el("div", {},
          el("span", { class: "caption" }, t("end.caption", { n: s.log.length })),
          el("h2", {}, t(won ? "end.win" : "end.fail")),
          el("p", { style: "font-size:24px" }, t(won ? "end.winP" : "end.failP")),
          el("p", { class: "reveal" }, t("end.reveal", { start: stm.window.start, end: stm.window.end })),
          won ? el("div", { class: "rankbadge " + rk.toLowerCase() }, t("end.rank", { medal: MEDAL[rk], rank: t("rank." + rk), stars: s.stars })) : null,
          el("div", { class: "crewrow" }, ...CREW.map((_, i) => art(face(i, st.moods[i])))),
          el("div", { class: "row", style: "margin-top:14px" },
            won ? el("button", { class: "btn red", id: "btnCert", type: "button", onclick: openCert }, t("btn.cert")) : null,
            el("button", { class: "btn" + (won ? "" : " red"), id: "btnPostQuiz", type: "button", onclick: () => { Sfx.play("click"); startQuiz("post"); } }, t("btn.quizAgain")),
            won ? null : el("button", { class: "btn plain", id: "btnRetry", type: "button", onclick: () => { Sfx.play("click"); startGame(); } }, t("btn.playAgain"))))),
      el("div", { class: "endgrid" },
        el("div", { class: "panel tilt-l" }, el("h3", {}, t("end.what")),
          el("ol", { class: "chain" }, ...chain.items.map((x) => el("li", {}, tt(x)))), el("div", { class: "fact" }, "💡 " + tt(chain.hint))),
        el("div", { class: "panel tilt-r" }, el("h3", {}, t("end.learned")),
          el("ol", { class: "learned" }, ...C.learned(s).map((x) => el("li", {}, tt(x)))))),
      el("div", { class: "panel suntoday halftone tilt-l", id: "sunToday", "aria-live": "polite" }));
    show("scrEnd");
    renderSun();
    if (!sunData) loadSunToday();
  }
  function onEnd() {
    endGame();
    const won = !S().fail;
    if (won) { Sfx.play("win"); stars(); } else { Sfx.play("fail"); document.body.classList.add("alarm"); }
  }
  function stars() {
    for (let i = 0; i < 36; i++) {
      const sp = el("span", { class: "star", "aria-hidden": "true",
        style: `left:${(i * 29) % 100}vw;font-size:${22 + (i * 7) % 26}px;animation-duration:${2.4 + (i % 7) * 0.35}s;animation-delay:${(i % 9) * 0.15}s` }, i % 3 ? "⭐" : "✨");
      document.body.append(sp);
      setTimeout(() => sp.remove(), 6000);
    }
  }

  /* ---------------------------------------------------------------- certificate (printable) */
  function openCert() {
    Sfx.play("good");
    const old = $("certName"), name = old ? old.value : "", s = S(), rk = C.rank(s);
    const today = new Date().toISOString().slice(0, 10);
    $("cert").replaceChildren(el("div", { class: "certpaper", role: "dialog", "aria-label": t("cert.aria") },
      art(rovi("cheering")),
      el("div", { class: "sub" }, t("cert.sub")), el("h2", {}, t("cert.title")),
      el("p", { style: "font-size:22px" }, t("cert.line1")),
      el("input", { type: "text", id: "certName", maxlength: "40", placeholder: t("cert.name"), "aria-label": t("cert.nameAria"), value: name }),
      el("p", { style: "font-size:22px" }, t("cert.line2", { n: C.storm.sols.length })),
      el("p", { style: "font-size:22px" }, t("cert.line3", { start: C.storm.window.start, end: C.storm.window.end })),
      el("div", { class: "rankbadge " + (rk || "bronze").toLowerCase() }, t("cert.rank", { medal: MEDAL[rk] || "", rank: t("rank." + (rk || "Bronze")), stars: s.stars })),
      el("p", { class: "job", style: "margin-top:14px" }, t("cert.footer", { date: today })),
      el("div", { class: "seal hand" }, t("cert.seal", { n: C.storm.sols.length }), el("br"), "★★★"),
      el("div", { class: "certrow no-print" },
        el("button", { class: "btn red", type: "button", onclick: () => window.print() }, t("btn.print")),
        el("button", { class: "btn plain", type: "button", id: "btnCertClose", onclick: () => $("cert").classList.add("hidden") }, t("btn.close")))));
    $("cert").classList.remove("hidden");
    $("certName").focus();
  }

  /* ---------------------------------------------------------------- results */
  function showResults() {
    const pre = scores.pre ? scores.pre.filter(Boolean).length : null, post = scores.post.filter(Boolean).length, won = S() && !S().fail;
    $("scrResults").replaceChildren(el("div", { class: "panel halftone" },
      el("div", { class: "endhead win" }, art(rovi(pre == null || post >= pre ? "cheering" : "happy")),
        el("div", {}, el("span", { class: "caption" }, t("results.title")), el("h2", {}, t(post === 3 ? "results.star" : "results.nice")),
          el("div", { class: "scores" },
            pre == null ? null : el("div", { class: "scorebadge before" }, el("b", {}, `${pre}/3`), t("results.before")),
            pre == null ? null : el("span", { class: "arrow", "aria-hidden": "true" }, "➜"),
            el("div", { class: "scorebadge after" }, el("b", {}, `${post}/3`), t("results.after"))))),
      el("div", { class: "tablewrap" }, el("table", {}, el("tr", {}, el("th", {}, t("results.q")), el("th", {}, t("results.b")), el("th", {}, t("results.a")), el("th", {}, t("results.right"))),
        ...QUIZ.map((q, i) => el("tr", {}, el("td", {}, t(`quiz.${q.n}.q`)), el("td", {}, scores.pre ? (scores.pre[i] ? "✅" : "❌") : "-"),
          el("td", {}, scores.post[i] ? "✅" : "❌"), el("td", {}, t(`quiz.${q.n}.a${q.correct}`)))))),
      el("p", { class: "job" }, t("results.note")),
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn red", id: "btnReplay", type: "button", onclick: () => { Sfx.play("click"); startGame(); } }, t("btn.playAgainRocket")),
        won ? el("button", { class: "btn", type: "button", onclick: openCert }, t("btn.certShort")) : null)));
    show("scrResults");
    if (post === 3) stars();
  }

  /* ---------------------------------------------------------------- teacher panel (NASA data sources) */
  function dsKey(name) { return /notif/i.test(name) ? "ds.notif" : /SEP/.test(name) ? "ds.sep" : /CME/.test(name) ? "ds.cme" : "ds.flr"; }
  function renderSources() {
    const b = $("srcBody"); b.replaceChildren();
    b.append(el("ul", { class: "kinds" }, ...["live", "ref", "rule"].map((k) => el("li", {}, el("span", { class: "badge " + k }, t("badge." + k)), " " + t("teacher.kind." + k)))));
    if (D.data_status.startsWith("SAMPLE")) b.append(el("p", { class: "banner" }, t("banner.sample")));
    b.append(el("h3", {}, t("teacher.live")));
    for (const st of C.storms) {
      b.append(el("h3", {}, t("teacher.week", { start: st.window.start, end: st.window.end }) + (st === C.storm && S() ? t("teacher.thisGame") : "")));
      const warns = st.earth_warnings.map((w) => t("warn." + w.status, { sol: w.storm_sol })).join(", ") || t("teacher.noWarn");
      b.append(el("p", {}, t("teacher.weekInfo", { flares: st.flares.length, seps: st.sep_events.length, per: st.sols.map((x) => x.sep_count).join(" "),
        min: st.light_delay.minutes, au: st.light_delay.earth_mars_au, warns, id: st.id })));
      for (const s of st.sources) {
        b.append(el("p", {}, el("span", { class: "badge live" }, t("badge.live")), " ", el("b", {}, t(dsKey(s.dataset))), el("br"),
          t("teacher.endpoint", { ep: s.endpoint, status: String(s.status), n: s.records, parsed: s.flares_parsed != null ? t("teacher.parsed", { n: s.flares_parsed }) : "", at: s.fetched_at }),
          s.fallback_reason ? el("span", {}, el("br"), t("teacher.fallback")) : ""));
      }
    }
    b.append(el("h3", {}, t("teacher.science")));
    b.append(el("ul", {}, ...(D.science_missions || []).map((m) => el("li", {}, `${m.icon} ${t(`mission.${m.id}.title`)}: ${t(`mission.${m.id}.fact`)} `, el("span", { class: "job" }, `(${m.source})`)))));
    const a = D.sun_today_archive;
    b.append(el("p", {}, t("teacher.sunNote", { start: a ? a.start : "-", end: a ? a.end : "-" })));
    b.append(el("h3", {}, t("teacher.refs")));
    b.append(el("div", { class: "tablewrap" }, el("table", {}, el("tr", {}, el("th", {}, t("teacher.value")), el("th", {}, t("teacher.what")), el("th", {}, t("teacher.source"))),
      ...D.reference_values.map((r) => el("tr", {}, el("td", {}, el("span", { class: "badge ref" }, t("badge.ref")), ` ${I.num(r.value)} ${r.unit}`),
        el("td", {}, I.has("ref." + r.key) ? t("ref." + r.key) : r.label), el("td", {}, r.source))))));
    b.append(el("p", { class: "job" }, t("teacher.sourcesNote")));
    b.append(el("h3", {}, t("teacher.rules")));
    b.append(el("div", { class: "tablewrap" }, el("table", {}, ...C.GAME_RULES_TABLE.map(([k, v]) => el("tr", {}, el("td", {}, el("span", { class: "badge rule" }, t("badge.rule")), " ", t(k)), el("td", {}, tt(v)))))));
    b.append(el("h3", {}, t("teacher.caveats")));
    const caveats = (D.caveats || []).map((_, i) => (I.has("caveat." + i) ? t("caveat." + i) : D.caveats[i]));
    if ((D.warnings || []).length) caveats.push(t("caveat.flr404"));
    b.append(el("ul", {}, ...caveats.map((c) => el("li", {}, c)), el("li", {}, t("teacher.chars")), el("li", {}, t("teacher.pics")), el("li", {}, t("teacher.font"))));
  }

  /* ---------------------------------------------------------------- static text, language switch */
  function applyStatic() {
    document.title = t("app.t1") + " " + t("app.t2") + (t("app.t3") ? " " + t("app.t3") : "");
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = t("app.desc");
    document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    const sample = D.data_status.startsWith("SAMPLE");
    $("dataBadge").textContent = t(sample ? "top.sample" : "top.realData");
    if (sample) { $("banner").textContent = t("banner.sample"); $("banner").classList.remove("hidden"); }
    $("btnSound").textContent = t(Sfx.on ? "top.soundOn" : "top.soundOff");
    $("btnLang").textContent = t("top.lang");
    $("btnLang").setAttribute("aria-label", t("top.langAria"));
    $("btnLang").setAttribute("lang", I18N.lang === "az" ? "en" : "az");
    $("aiMark").title = t("top.aiTitle");
  }
  function rerender() {
    applyStatic();
    if (current === "scrIntro") renderIntro();
    else if (current === "scrQuiz") renderQuestion();
    else if (current === "scrGame" && S()) {
      renderStones(); renderEvent(); renderPower(); renderEarth(true); renderCrew(renderScene(!lastReport || lastReport.sol !== S().sol));
      setRovi(roviNow[0], roviNow[1]);
      if (lastReport && lastReport.sol === S().sol && !$("reportPanel").classList.contains("hidden")) renderReport(lastReport);
    } else if (current === "scrEnd") endGame();
    else if (current === "scrResults") showResults();
    if ($("dlgTeacher").open) renderSources();
    if (!$("cert").classList.contains("hidden")) openCert();
  }

  /* ---------------------------------------------------------------- wiring */
  C.subscribe((type, state, payload) => {
    if (!state || ($("scrGame").classList.contains("hidden") && type !== "end")) return;
    if (type === "alloc") { renderPower(); renderCrew(renderScene(true)); }
    else if (type === "sol") renderReport(payload);
    else if (type === "next") { lastReport = null; renderSol(); }
    else if (type === "advice") renderEarth(true);
    else if (type === "end") onEnd();
  });
  document.addEventListener("base3d:pick", (e) => {
    const target = document.querySelector(`#powerPanel [data-sys="${e.detail.sys}"]`);
    if (!target || $("powerPanel").classList.contains("hidden")) return;
    document.querySelectorAll(".pick-glow").forEach((x) => x.classList.remove("pick-glow"));
    target.classList.add("pick-glow");
    target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    const btn = target.querySelector("button:not([disabled])");
    if (btn) btn.focus({ preventScroll: true });
    Sfx.play("click");
    setTimeout(() => target.classList.remove("pick-glow"), 2600);
  });

  scene = $("scene");
  scene.insertAdjacentHTML("afterbegin", A.scene("g"));
  $("dust").append(...dustBits(18));
  $("btnSound").onclick = () => { const on = Sfx.toggle(); $("btnSound").setAttribute("aria-pressed", String(on)); $("btnSound").textContent = t(on ? "top.soundOn" : "top.soundOff"); };
  $("btnLang").onclick = () => I.setLang(I.lang === "az" ? "en" : "az");
  I.onChange(rerender);
  $("btnTeacher").onclick = () => { renderSources(); $("dlgTeacher").showModal(); };
  $("btnCloseTeacher").onclick = () => $("dlgTeacher").close();
  window.UI = { rerender, startGame, get screen() { return current; } };
  applyStatic();
  renderIntro();
})();
