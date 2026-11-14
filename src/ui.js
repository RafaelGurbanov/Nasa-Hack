/*
 * Storybook user interface (ages 7-12). Reads state from MissionCore (src/game.js)
 * and calls its actions from buttons. Contains no game rules and changes no NASA data.
 * Pictures come from src/art.js, sounds from src/sound.js.
 */
(function () {
  "use strict";
  const C = window.MissionCore, A = window.Art, Sfx = window.Sfx || { play() {}, toggle() { return false; }, on: false };
  const $ = (id) => document.getElementById(id);

  /** Create an element safely: text only, never HTML from data. */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null) continue;                                  // skip unset attributes (e.g. disabled: null)
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

  if (!C || !A) {
    const b = $("banner");
    b.textContent = "Data file data/events.js is missing. Run: python data/fetch_nasa_data.py";
    b.classList.remove("hidden");
    return;
  }

  const { D, RULES, O2_NEED, BASE_DOSE, QUIZ, fmt, fmtDate, fmtTime, sign } = C;
  const S = () => C.state;
  const SCREENS = ["scrIntro", "scrQuiz", "scrGame", "scrEnd", "scrResults"];
  function show(id) {
    SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
    document.body.classList.remove("alarm");
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- crew */
  const CREW = [
    { name: "Aylin", job: "checks the air and water", icon: "🫧", c: "var(--air)" },
    { name: "Kofi", job: "looks after the power", icon: "⚡", c: "var(--energy)" },
    { name: "Mei", job: "grows the food", icon: "🥕", c: "var(--food)" },
    { name: "Leo", job: "watches the radiation", icon: "🛡️", c: "var(--shield)" }
  ];
  const SCORE = { cheering: 1, happy: 1, ok: 0.8, worried: 0.55, scared: 0.3, sad: 0.15 };

  /** Each astronaut reacts to "their" system. */
  function crewStatus(s, storm, beforeRun) {
    const used = s.alloc.ls + s.alloc.gh + s.alloc.sh;
    const o2Sols = s.o2 / O2_NEED, foodSols = s.food / RULES.foodNeed, doseFrac = s.dose / RULES.doseLimit;
    const air = o2Sols >= 2.5 && s.water >= 60 ? "happy" : o2Sols >= 1.5 && s.water >= 40 ? "ok" : o2Sols >= 0.8 && s.water >= 25 ? "worried" : "scared";
    const energy = used === RULES.power ? "happy" : used === RULES.power - 1 ? "ok" : "worried";
    const food = foodSols >= 3 ? "happy" : foodSols >= 2 ? "ok" : foodSols >= 1 ? "worried" : "scared";
    let safe = doseFrac < 0.35 ? "happy" : doseFrac < 0.55 ? "ok" : doseFrac < 0.75 ? "worried" : "scared";
    if (beforeRun && storm && s.alloc.sh < 2 && (safe === "happy" || safe === "ok")) safe = "worried";
    const moods = [air, energy, food, safe];
    if (s.fail) {
      const who = { o2: 0, water: 0, food: 2, dose: 3 }[s.fail];
      moods.forEach((m, i) => { moods[i] = i === who ? "sad" : "worried"; });
    } else if (s.ended) moods.fill("cheering");
    return {
      moods,
      bars: [Math.min(s.o2 / RULES.o2Max, s.water / 100), used / RULES.power, s.food / RULES.foodMax, 1 - doseFrac],
      values: [`${fmt(Math.max(0, s.o2), 1)} kg air · ${Math.round(Math.max(0, s.water))}% water`, `${used} of ${RULES.power} power`,
               `${fmt(Math.max(0, s.food), 0)} food packs`, `${fmt(s.dose, 1)} of ${RULES.doseLimit} mSv`],
      health: moods.reduce((a, m) => a + SCORE[m], 0) / 4
    };
  }

  /* ---------------------------------------------------------------- words (real term in brackets the first time) */
  const told = new Set();
  function term(simple, real) { if (told.has(real)) return simple; told.add(real); return `${simple} (${real})`; }

  /** Rovi says ONE short sentence per sol. */
  function roviBefore(s, sd) {
    if (sd.seps.length) return ["scared", "Storm pieces are coming, so turn the shield up!"];
    if (s.o2 < O2_NEED * 1.5) return ["worried", "Our air is low, so give Life Support more power!"];
    if (s.food < RULES.foodNeed * 1.5) return ["worried", "Our food is low, so give the Greenhouse more power!"];
    if (s.dose > RULES.doseLimit * 0.6) return ["worried", "The radiation is high, so be careful!"];
    if (sd.flares.length) return ["happy", "A big flash on the Sun, but no harmful pieces today!"];
    return ["happy", "A calm day, so let's make extra food and air!"];
  }
  function roviAfter(s, r) {
    if (s.fail) return ["scared", "Oh no, let's see what went wrong."];
    if (r.sepCount && r.alloc.sh >= 2) return ["cheering", "Great shielding, everyone is safe!"];
    if (r.sepCount) return ["worried", "Some storm pieces got in, so use more shield next time."];
    if (r.o2Delta < 0 || r.foodDelta < 0) return ["worried", "Something went down, so check the crew."];
    return ["cheering", "Good job, on to the next sol!"];
  }
  function setRovi(mood, line) {
    $("roviArt").innerHTML = A.rovi(mood);
    $("roviSay").textContent = line;
  }

  /* ---------------------------------------------------------------- intro (one idea per page) */
  let page = 0;
  const PAGES = [
    () => ({ art: art(A.scene("i1"), "panel art tilt-l scene"), title: "Hello, Commander!",
      text: ["You run a base on Mars.", "A day on Mars is called a sol."],
      rovi: ["happy", "Hi! I'm Rovi, your robot helper."] }),
    () => ({ art: el("div", { class: "panel art halftone crewgrid-big tilt-r" },
        ...CREW.map((p, i) => el("div", { class: "who" }, art(A.face(i, "happy")), el("b", {}, p.name), p.job))),
      title: "Meet your crew", text: ["4 astronauts live in your base.", "Each one cares for one job."],
      rovi: ["happy", "They need you!"] }),
    () => ({ art: art(A.scene("i3"), "panel art tilt-l scene storm"), title: "A real space storm",
      text: [`In May 2024, the Sun had a huge ${term("space storm", "solar flare")}.`, "NASA saw it. You will play those 10 real days."],
      rovi: ["worried", "Eek! We must get ready."] }),
    () => ({ art: el("div", { class: "panel art halftone cards-demo tilt-r" },
        el("div", {}, el("span", {}, "🫧"), "Life Support"), el("div", {}, el("span", {}, "🥕"), "Greenhouse"), el("div", {}, el("span", {}, "🛡️"), "Shield")),
      title: "Share your power", text: [`You get ${RULES.power} power points each sol.`, "Air, food and the shield all need power.", "If something runs out, the mission stops."],
      rovi: ["cheering", "You can do it!"] })
  ];
  function renderIntro() {
    const p = PAGES[page]();
    const box = $("scrIntro"); box.replaceChildren();
    const textCol = el("div", { class: "text" },
      el("span", { class: "caption" }, `Page ${page + 1} of ${PAGES.length}`),
      el("h2", {}, p.title), ...p.text.map((t) => el("p", {}, t)),
      el("div", { class: "roviline" }, art(A.rovi(p.rovi[0])), el("div", { class: "bubble left" }, p.rovi[1])),
      el("div", { class: "dots", "aria-hidden": "true" }, ...PAGES.map((_, i) => el("i", { class: i === page ? "on" : "" }))),
      el("div", { class: "row", style: "margin-top:18px" },
        page > 0 ? el("button", { class: "btn plain", id: "btnBack", onclick: () => { Sfx.play("click"); page--; renderIntro(); } }, "← Back") : null,
        page < PAGES.length - 1
          ? el("button", { class: "btn", id: "btnIntroNext", onclick: () => { Sfx.play("click"); page++; renderIntro(); } }, "Next ➜")
          : el("button", { class: "btn red", id: "btnStart", onclick: () => { Sfx.play("go"); startQuiz("pre"); } }, "Start! 3 quick questions ➜")));
    const story = el("div", { class: "story" }, p.art, textCol);
    box.append(story);
    if (p.art.classList.contains("scene")) {
      p.art.append(el("div", { class: "dust" }, ...dustBits(14)), el("div", { class: "zap" }, el("b", {}, "ZAP!")));
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
    const item = QUIZ[qIndex];
    $("scrQuiz").replaceChildren(el("div", { class: "panel quiz tilt-r" },
      art(A.rovi(quizPhase === "pre" ? "worried" : "happy")),
      el("div", {},
        el("span", { class: "caption" }, `${quizPhase === "pre" ? "Before the mission" : "After the mission"} · Question ${qIndex + 1} of ${QUIZ.length}`),
        el("h2", {}, item.q),
        el("div", { class: "answers" }, ...item.a.map((txt, j) =>
          el("button", { class: "answer", "data-q": String(qIndex), "data-a": String(j), onclick: () => answer(j) }, el("b", {}, "ABCD"[j]), txt))),
        el("p", { class: "hand", style: "margin-top:16px;font-size:22px" }, quizPhase === "pre" ? "Just guess. It's OK not to know yet!" : "Let's see what you learned!"))));
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
    $("stones").replaceChildren(...D.sols.map((s) => el("div", {
      class: "stone" + (s.sep_count ? " storm" : "") + (s.sol < S().sol ? " done" : "") + (s.sol === S().sol ? " now" : ""),
      title: `Sol ${s.sol}, ${fmtDate(s.date)}${s.sep_count ? ": storm pieces" : ""}` }, String(s.sol), s.sep_count ? el("span", { class: "bolt" }, "⚡") : null)));
  }
  function renderScene(beforeRun) {
    const s = S(), sd = C.solData(s.sol), st = crewStatus(s, sd.seps.length > 0, beforeRun);
    $("sceneTag").textContent = `Sol ${s.sol} · ${fmtDate(sd.info.date)}`;
    A.updateScene(scene, { storm: sd.seps.length > 0, health: st.health, shield: s.alloc.sh, power: C.used(), food: Math.max(0, s.food) / RULES.foodMax, fail: !!s.fail });
    return st;
  }
  function renderCrew(st) {
    $("crewPanel").replaceChildren(el("h3", {}, "Crew check"), el("div", { class: "crewlist" }, ...CREW.map((p, i) =>
      el("div", { class: "crew" }, art(A.face(i, st.moods[i]), "facewrap"), el("div", {}, el("b", {}, p.name), " ", el("span", { class: "job" }, `${p.icon} ${p.job}`)),
        el("div", { class: "pill", role: "img", "aria-label": `${p.name}: ${st.values[i]}` }, el("i", { style: `--c:${p.c};width:${Math.max(3, Math.min(100, st.bars[i] * 100))}%` })),
        el("div", { class: "job" }, st.values[i])))));
  }
  function renderEvent() {
    const { info, flares, seps } = C.solData(S().sol);
    const card = $("eventCard");
    card.className = "panel event" + (seps.length ? " storm tilt-l" : " tilt-r");
    const kids = [el("span", { class: "caption" }, `Real NASA record for ${fmtDate(info.date)}`)];
    if (seps.length) {
      kids.push(el("h3", {}, "⚠️ Storm pieces are coming!"),
        el("p", { class: "alerttxt" }, `NASA counted ${seps.length} alert${seps.length > 1 ? "s" : ""} of ${term("tiny, fast pieces from the Sun", "protons")} today.`));
    } else if (flares.length) {
      kids.push(el("h3", {}, "☀️ A calm day for the crew"),
        el("p", { class: "alerttxt" }, `The Sun made a big flash of light (${"solar flare"}). Light cannot hurt the crew.`));
    } else {
      kids.push(el("h3", {}, "☀️ A calm day"), el("p", { class: "alerttxt" }, "No big flashes and no harmful pieces today."));
    }
    if (flares.length) kids.push(el("div", { class: "flarechips" }, "Big flashes today:",
      ...flares.map((f) => el("span", { class: "fx " + f.class_letter }, f.class)), el("span", { class: "job" }, "(X = biggest, M = medium)")));
    const det = el("details", {}, el("summary", {}, "Where is this from? (NASA records)"));
    flares.forEach((f) => det.append(el("div", { class: "src" }, `${f.class} solar flare, peak ${fmtTime(f.peak_time)}, region ${f.source_location}` +
      (f.active_region ? ` (AR ${f.active_region})` : "") + (f.linked_sep_id ? " · linked to a proton event" : "") + ". Source: ", el("a", { href: f.record_url }, f.source_line))));
    seps.forEach((s) => det.append(el("div", { class: "src" }, "Source: ", el("a", { href: s.record_url }, s.source_line), s.instruments.length ? ` (${s.instruments.join(", ")})` : "")));
    if (!flares.length && !seps.length) det.append(el("div", { class: "src" }, "No flare of class M5 or higher and no SEP record for this date in NASA DONKI."));
    kids.push(det);
    card.replaceChildren(...kids);
  }
  const SYSTEMS = [
    ["ls", "Life Support", "🫧", "makes air and cleans water", "#bfeaff"],
    ["gh", "Greenhouse", "🥕", "grows food", "#c8f2cc"],
    ["sh", "Shield", "🛡️", "blocks storm pieces", "#e2d4ff"]
  ];
  function renderPower() {
    const s = S(), used = C.used(), left = RULES.power - used;
    $("powerPanel").replaceChildren(
      el("h3", {}, "Share your power ⚡"),
      el("div", { class: "pcards" }, ...SYSTEMS.map(([k, name, icon, what, bg]) => {
        const lvl = s.alloc[k];
        return el("div", { class: "pcard" },
          el("div", { class: "ico", style: `background:${bg}` }, icon), el("div", { class: "nm" }, name), el("div", { class: "what" }, what),
          el("div", { class: "ctl" },
            el("button", { type: "button", "aria-label": `Less power to ${name}`, disabled: lvl <= 0 ? "" : null, onclick: () => { Sfx.play("down"); C.setLevel(k, lvl - 1); } }, "−"),
            el("span", { class: "pips", "aria-label": `${name} power ${lvl} of 3` }, ...[0, 1, 2].map((i) => el("i", { style: i < lvl ? `background:${{ ls: "var(--air)", gh: "var(--food)", sh: "var(--shield)" }[k]}` : "" }))),
            el("button", { type: "button", "aria-label": `More power to ${name}`, disabled: lvl >= RULES.maxLevel || left <= 0 ? "" : null, onclick: () => { Sfx.play("up"); C.setLevel(k, lvl + 1); } }, "+")));
      })),
      el("div", { class: "powerfoot" },
        el("div", { class: "powerleft" }, el("span", { class: "bolts" }, "⚡".repeat(used) + "▫️".repeat(left)), ` ${used} of ${RULES.power} used` + (left ? ` · ${left} left!` : " · great!")),
        el("button", { class: "btn red", id: "btnGo", type: "button", onclick: runSol }, "Go! ➜")));
  }
  function renderSol() {
    const s = S(), sd = C.solData(s.sol);
    renderStones(); renderEvent(); renderPower();
    const st = renderScene(true); renderCrew(st);
    setRovi(...roviBefore(s, sd));
    $("powerPanel").classList.remove("hidden"); $("reportPanel").classList.add("hidden");
    if (sd.seps.length) Sfx.play("zap");
  }
  function runSol() {
    Sfx.play("go");
    C.runSol();
  }
  function renderReport(r) {
    const s = S(), st = renderScene(false); renderCrew(st);
    setRovi(...roviAfter(s, r));
    const li = (ok, good, bad) => el("li", {}, ok ? good : bad);
    $("reportPanel").replaceChildren(
      el("h3", {}, s.fail ? `Sol ${r.sol}: uh-oh!` : `Sol ${r.sol}: done!`),
      el("ul", {},
        li(r.o2Delta >= 0, `😊 Air: everyone can breathe. (${sign(r.o2Delta, 1)} kg)`, `😟 Air went down. (${sign(r.o2Delta, 2)} kg)`),
        li(r.rec >= 0.98, `💧 Water: clean and reused. (${sign(r.waterDelta, 1)}%)`, `😟 Water went down. (${sign(r.waterDelta, 1)}%)`),
        li(r.foodDelta >= 0, `🥕 Food: enough grew. (${sign(r.foodDelta, 0)} packs)`, `😟 Food went down. (${sign(r.foodDelta, 0)} packs)`),
        el("li", {}, r.sepCount
          ? (r.alloc.sh >= 2 ? `🛡️ The shield blocked most storm pieces: only +${fmt(r.stormDose, 1)} mSv got in.` : `⚠️ Storm pieces got in: +${fmt(r.stormDose, 1)} mSv.`)
          : `☀️ No storm pieces. Normal Mars radiation: +${BASE_DOSE} mSv.`)),
      el("div", { class: "fact" }, el("b", {}, "🧠 Real fact: "), r.fact),
      el("div", { class: "row", style: "margin-top:16px" },
        el("button", { class: "btn green", id: "btnNext", type: "button", onclick: () => { Sfx.play("click"); C.nextSol(); } },
          s.fail ? "See what happened ➜" : (s.sol >= 10 ? "Finish the mission 🏁" : "Next sol ➜"))));
    $("powerPanel").classList.add("hidden"); $("reportPanel").classList.remove("hidden");
    Sfx.play(s.fail ? "fail" : (r.o2Delta < 0 || r.foodDelta < 0 || (r.sepCount && r.alloc.sh < 2)) ? "down" : "good");
    $("reportPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function startGame() {
    C.newGame();
    show("scrGame");
    renderSol();
  }

  /* ---------------------------------------------------------------- end */
  function endGame() {
    const s = S(), won = !s.fail;
    const st = crewStatus(s, false, false);
    const chain = C.buildChain(s);
    $("scrEnd").replaceChildren(
      el("div", { class: "panel endhead " + (won ? "win halftone" : "fail") },
        art(A.rovi(won ? "cheering" : "scared")),
        el("div", {},
          el("span", { class: "caption" }, `${s.log.length} sol${s.log.length > 1 ? "s" : ""} of the real ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} storm`),
          el("h2", {}, won ? "You did it! 🎉" : "Mission failed"),
          el("p", { style: "font-size:24px" }, won ? "All 4 astronauts are safe." : "Don't worry. Let's see why."),
          el("div", { class: "crewrow" }, ...CREW.map((_, i) => art(A.face(i, st.moods[i])))),
          el("div", { class: "row", style: "margin-top:14px" },
            won ? el("button", { class: "btn red", id: "btnCert", type: "button", onclick: openCert }, "🏅 Get your certificate") : null,
            el("button", { class: "btn" + (won ? "" : " red"), id: "btnPostQuiz", type: "button", onclick: () => { Sfx.play("click"); startQuiz("post"); } }, "Try the 3 questions again"),
            won ? null : el("button", { class: "btn plain", id: "btnRetry", type: "button", onclick: () => { Sfx.play("click"); startGame(); } }, "Play again")))),
      el("div", { class: "endgrid" },
        el("div", { class: "panel tilt-l" }, el("h3", {}, "What happened, step by step"),
          el("ol", { class: "chain" }, ...chain.items.map((x) => el("li", {}, x))), el("div", { class: "fact" }, "💡 " + chain.hint)),
        el("div", { class: "panel tilt-r" }, el("h3", {}, "🧠 What you learned"),
          el("ol", { class: "learned" }, ...C.learned(s).map((x) => el("li", {}, x))))));
    show("scrEnd");
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
    const today = new Date();
    const date = `${today.getDate()} ${["January","February","March","April","May","June","July","August","September","October","November","December"][today.getMonth()]} ${today.getFullYear()}`;
    $("cert").replaceChildren(el("div", { class: "certpaper", role: "dialog", "aria-label": "Junior Astronaut certificate" },
      art(A.rovi("cheering")),
      el("div", { class: "sub" }, "Certificate"),
      el("h2", {}, "Junior Astronaut"),
      el("p", { style: "font-size:22px" }, "This is to say that"),
      el("input", { type: "text", id: "certName", maxlength: "40", placeholder: "Write your name here", "aria-label": "Your name" }),
      el("p", { style: "font-size:22px" }, `kept 4 astronauts safe on a Mars base for 10 sols,`),
      el("p", { style: "font-size:22px" }, `through the real space storm of ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} (NASA data).`),
      el("p", { class: "job", style: "margin-top:14px" }, `Mars Storm Replay · Space Apps 2026 · Challenge #07 · ${date}`),
      el("div", { class: "seal hand" }, "10 sols", el("br"), "★★★"),
      el("div", { class: "certrow no-print" },
        el("button", { class: "btn red", type: "button", onclick: () => window.print() }, "🖨️ Print"),
        el("button", { class: "btn plain", type: "button", onclick: () => $("cert").classList.add("hidden") }, "Close"))));
    $("cert").classList.remove("hidden");
    $("certName").focus();
  }

  /* ---------------------------------------------------------------- results */
  function showResults() {
    const pre = scores.pre ? scores.pre.filter(Boolean).length : null;
    const post = scores.post.filter(Boolean).length;
    const won = S() && !S().fail;
    $("scrResults").replaceChildren(el("div", { class: "panel halftone" },
      el("div", { class: "endhead win" }, art(A.rovi(pre == null || post >= pre ? "cheering" : "happy")),
        el("div", {}, el("h2", {}, post === 3 ? "Super star! ⭐" : "Nice work!"),
          el("div", { class: "scores" },
            pre == null ? null : el("div", { class: "scorebadge before" }, el("b", {}, `${pre}/3`), "before"),
            pre == null ? null : el("span", { class: "arrow" }, "➜"),
            el("div", { class: "scorebadge after" }, el("b", {}, `${post}/3`), "after")))),
      el("table", {}, el("tr", {}, el("th", {}, "Question"), el("th", {}, "Before"), el("th", {}, "After"), el("th", {}, "Right answer")),
        ...QUIZ.map((q, i) => el("tr", {}, el("td", {}, q.q), el("td", {}, scores.pre ? (scores.pre[i] ? "✅" : "❌") : "-"),
          el("td", {}, scores.post[i] ? "✅" : "❌"), el("td", {}, q.a[q.correct])))),
      el("p", { class: "job" }, "Your answers stay in this browser. Nothing is saved or sent."),
      el("div", { class: "row", style: "margin-top:12px" },
        el("button", { class: "btn red", id: "btnReplay", type: "button", onclick: () => { Sfx.play("click"); startGame(); } }, "Play again 🚀"),
        won ? el("button", { class: "btn", type: "button", onclick: openCert }, "🏅 Certificate") : null)));
    show("scrResults");
    if (post === 3) stars();
  }

  /* ---------------------------------------------------------------- teacher panel (NASA data sources) */
  function renderSources() {
    const b = $("srcBody"); b.replaceChildren();
    b.append(el("h3", {}, "Live-fetched (NASA DONKI via api.nasa.gov)"));
    if (D.data_status.startsWith("SAMPLE")) b.append(el("p", { class: "banner" }, D.data_status));
    for (const s of D.sources) {
      b.append(el("p", {}, el("span", { class: "badge live" }, "live-fetched"), " ", el("b", {}, s.dataset), el("br"),
        `Endpoint: ${s.endpoint} · HTTP ${s.status} · ${s.records} records` + (s.flares_parsed != null ? ` (${s.flares_parsed} flares parsed)` : "") + ` · fetched ${s.fetched_at}`,
        s.fallback_reason ? el("span", {}, el("br"), `Note: used because ${s.fallback_reason}.`) : ""));
    }
    b.append(el("p", {}, `Storm window: ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} (10 sols). ${D.flares.length} flares and ${D.sep_events.length} SEP records, each linked on its event card. Raw API responses: data/raw/.`));
    b.append(el("h3", {}, "Published reference values"));
    b.append(el("table", {}, el("tr", {}, el("th", {}, "Value"), el("th", {}, "What"), el("th", {}, "Source")),
      ...D.reference_values.map((r) => el("tr", {}, el("td", {}, el("span", { class: "badge ref" }, "reference"), ` ${r.value} ${r.unit}`), el("td", {}, r.label), el("td", {}, r.source)))));
    b.append(el("h3", {}, "Game rules (simplified, not NASA data)"));
    b.append(el("table", {}, ...C.GAME_RULES_TABLE.map(([k, v]) => el("tr", {}, el("td", {}, el("span", { class: "badge rule" }, "game rule"), " ", k), el("td", {}, v)))));
    b.append(el("h3", {}, "Honest caveats"));
    b.append(el("ul", {}, ...[...D.caveats, ...D.warnings].map((c) => el("li", {}, c)),
      el("li", {}, "The astronauts (Aylin, Kofi, Mei, Leo) and Rovi the robot are made-up characters."),
      el("li", {}, "All pictures are drawn in code by an AI assistant (Claude). No photos and no NASA logos are used.")));
  }

  /* ---------------------------------------------------------------- wiring */
  C.subscribe((type, state, payload) => {
    if (!state || $("scrGame").classList.contains("hidden") && type !== "end") return;
    if (type === "alloc") { renderPower(); renderCrew(renderScene(true)); }
    else if (type === "sol") renderReport(payload);
    else if (type === "next") renderSol();
    else if (type === "end") endGame();
  });

  scene = $("scene");
  scene.insertAdjacentHTML("afterbegin", A.scene("g"));
  $("dust").append(...dustBits(18));

  const sample = D.data_status.startsWith("SAMPLE");
  $("dataBadge").textContent = sample ? "⚠️ SAMPLE DATA, NOT REAL" : "✅ Real NASA data";
  if (sample) { $("banner").textContent = "SAMPLE DATA - NOT REAL NASA DATA. Run python data/fetch_nasa_data.py."; $("banner").classList.remove("hidden"); }
  $("btnSound").onclick = () => {
    const on = Sfx.toggle();
    $("btnSound").setAttribute("aria-pressed", String(on));
    $("btnSound").textContent = on ? "🔊 Sound: on" : "🔇 Sound: off";
  };
  $("btnTeacher").onclick = () => { renderSources(); $("dlgTeacher").showModal(); };
  $("btnCloseTeacher").onclick = () => $("dlgTeacher").close();
  renderIntro();
})();
