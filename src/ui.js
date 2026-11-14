/*
 * 2D user interface (ages 7-12). Reads state from MissionCore (src/game.js) and calls
 * its actions from buttons. Contains no game rules.
 */
(function () {
  "use strict";
  const C = window.MissionCore;
  const $ = (id) => document.getElementById(id);

  /** Create an element safely (text only, never HTML from data). */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
      else if (k === "href") { if (/^https:\/\//.test(v)) { n.href = v; n.target = "_blank"; n.rel = "noopener"; } }
      else n.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k));
    return n;
  }

  if (!C) {
    const b = $("banner");
    b.textContent = "Data file data/events.js is missing. Run: python data/fetch_nasa_data.py";
    b.classList.remove("hidden");
    $("btnIntroNext").disabled = true;
    return;
  }

  const { D, RULES, O2_NEED, BASE_DOSE, QUIZ, fmt, fmtDate, fmtTime, sign } = C;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const S = () => C.state;

  function show(id) {
    for (const s of ["scrIntro", "scrQuiz", "scrGame", "scrEnd", "scrResults"]) $(s).classList.toggle("hidden", s !== id);
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- intro: one idea per card */
  let introStep = 0;
  const steps = document.querySelectorAll(".intro-step");
  function renderIntro() {
    steps.forEach((s, i) => s.classList.toggle("hidden", i !== introStep));
    document.querySelectorAll(".steps i").forEach((d, i) => d.classList.toggle("on", i === introStep));
    const last = introStep === steps.length - 1;
    $("btnIntroBack").classList.toggle("hidden", introStep === 0);
    $("btnIntroNext").classList.toggle("hidden", last);
    $("btnStart").classList.toggle("hidden", !last);
  }

  /* ---------------------------------------------------------------- quiz */
  let quizPhase = "pre";
  const scores = { pre: null, post: null };

  function renderQuiz(phase) {
    quizPhase = phase;
    $("quizTitle").textContent = phase === "pre" ? "🤔 3 quick questions" : "🤔 The same 3 questions again";
    $("quizHint").textContent = phase === "pre"
      ? "It's OK if you don't know yet! Just pick your best guess."
      : "Let's see what you learned on Mars.";
    const f = $("quizForm"); f.replaceChildren();
    QUIZ.forEach((item, i) => {
      const box = el("fieldset", { class: "q" }, el("legend", {}, `${i + 1}. ${item.q}`));
      item.a.forEach((txt, j) => {
        const id = `q${i}a${j}`;
        box.append(el("label", { for: id }, el("input", { type: "radio", name: `q${i}`, id, value: String(j) }), " ", txt));
      });
      f.append(box);
    });
    show("scrQuiz");
  }

  function gradeQuiz() {
    const picks = QUIZ.map((_, i) => {
      const c = document.querySelector(`input[name=q${i}]:checked`);
      return c ? +c.value : null;
    });
    if (picks.includes(null)) { alert("Please pick an answer for all 3 questions."); return; }
    scores[quizPhase] = picks.map((p, i) => p === QUIZ[i].correct);
    if (quizPhase === "pre") startGame(); else showResults();
  }

  /* ---------------------------------------------------------------- game screen */
  function renderTimeline() {
    const t = $("timeline"); t.replaceChildren();
    for (const s of D.sols) {
      t.append(el("div", { class: "tl" + (s.sol === S().sol ? " now" : "") + (s.sol < S().sol ? " done" : ""),
                           title: `${fmtDate(s.date)}: ${s.flare_count} big flashes (solar flares), biggest ${s.max_class || "none"}, ${s.sep_count} particle alerts` },
        el("span", { class: "ico" }, s.sep_count ? "⚠️" : "☀️"), `Sol ${s.sol}`));
    }
  }

  function gauge(cls, label, valueText, frac, sub) {
    const f = clamp(frac, 0, 1);
    return el("div", { class: "gauge " + cls },
      el("div", { class: "label" }, label),
      el("div", { class: "value" }, valueText),
      el("div", { class: "bar" + (f < 0.25 ? " bad" : f < 0.5 ? " warn" : "") }, el("div", { style: `width:${f * 100}%` })),
      sub ? el("div", { class: "muted small" }, sub) : "");
  }

  /** The 4 required systems: Life Support (oxygen/water), Energy, Food, Radiation Protection. */
  function renderGauges() {
    const s = S();
    const o2 = Math.max(0, s.o2), water = Math.max(0, s.water), food = Math.max(0, s.food);
    $("gauges").replaceChildren(
      gauge("air", "🫧 Life Support (oxygen/water)", `${fmt(o2, 1)} kg air · ${Math.round(water)}% water`,
        Math.min(s.o2 / RULES.o2Max, s.water / 100), `The crew breathes ${fmt(O2_NEED)} kg each sol`),
      gauge("energy", "⚡ Energy", `${C.used()} of ${RULES.power} power used`, C.used() / RULES.power,
        "Same power every sol"),
      gauge("food", "🥕 Food", `${fmt(food, 0)} food packs`, s.food / RULES.foodMax, `The crew eats ${RULES.foodNeed} packs each sol`),
      gauge("shield", "🛡️ Radiation Protection", `${fmt(s.dose, 1)} of ${RULES.doseLimit} mSv`, 1 - s.dose / RULES.doseLimit,
        "Radiation dose (mSv). Keep it low!")
    );
  }

  function renderEvent() {
    const { info, flares, seps } = C.solData(S().sol);
    const card = $("eventCard");
    card.className = "panel event" + (seps.length ? " sep" : "");
    card.replaceChildren(el("h3", {}, `Space weather on ${fmtDate(info.date)} (real NASA record)`));
    if (seps.length) {
      card.append(el("p", { class: "alert cls-X" }, "⚠️ Storm particles are coming!"),
        el("p", {}, `NASA counted ${seps.length} alert${seps.length > 1 ? "s" : ""} of tiny, fast pieces from the Sun (protons). They raise the crew's radiation. Turn your shield up!`));
    } else {
      card.append(el("p", { class: "alert", style: "color:var(--good)" }, "☀️ Calm day for the crew"),
        el("p", {}, flares.length
          ? "The Sun made big flashes of light (solar flares). The light can't hurt the crew. No harmful particles came today."
          : "No big flashes and no harmful particles today."));
    }
    if (flares.length) {
      card.append(el("p", { class: "small muted" }, `Big flashes today: `,
        ...flares.map((f, i) => el("span", {}, i ? ", " : "", el("span", { class: "cls-" + f.class_letter }, f.class))),
        " (X is the biggest kind, M is medium)"));
    }
    const det = el("details", {}, el("summary", {}, "Where is this from? (NASA records)"));
    for (const f of flares) {
      det.append(el("div", { class: "flare small" },
        el("span", { class: "cls-" + f.class_letter }, `${f.class} solar flare`),
        ` peaked at ${fmtTime(f.peak_time)}, region ${f.source_location}` + (f.active_region ? ` (AR ${f.active_region})` : ""),
        f.linked_sep_id ? el("span", { class: "badge bad", style: "margin-left:6px" }, "linked to a proton event") : "",
        el("div", { class: "muted" }, "Source: ", el("a", { href: f.record_url }, f.source_line))));
    }
    for (const s of seps) {
      det.append(el("div", { class: "muted small" }, "Source: ", el("a", { href: s.record_url }, s.source_line),
        s.instruments.length ? ` (${s.instruments.join(", ")})` : ""));
    }
    card.append(det);
  }

  const SYSTEMS = [
    ["ls", "🫧 Life Support", "makes air (oxygen) and cleans water"],
    ["gh", "🥕 Greenhouse", "grows food"],
    ["sh", "🛡️ Shield", "blocks storm particles"]
  ];

  function renderAlloc() {
    const rows = $("allocRows"); rows.replaceChildren();
    for (const [k, name, desc] of SYSTEMS) {
      const lvl = S().alloc[k];
      const pips = el("div", { class: "pips", "aria-hidden": "true" },
        ...Array.from({ length: RULES.maxLevel }, (_, i) => el("span", { class: "pip" + (i < lvl ? " on" : "") })));
      const label = name.replace(/^\S+\s/, "");
      const minus = el("button", { type: "button", "aria-label": `Less power to ${label}` }, "−");
      const plus = el("button", { type: "button", "aria-label": `More power to ${label}` }, "+");
      minus.disabled = lvl <= 0;
      plus.disabled = lvl >= RULES.maxLevel || C.used() >= RULES.power;
      minus.onclick = () => C.setLevel(k, lvl - 1);
      plus.onclick = () => C.setLevel(k, lvl + 1);
      rows.append(el("div", { class: "alloc" },
        el("div", {}, el("div", { class: "name" }, name), el("div", { class: "muted small" }, desc)),
        el("div", { class: "stepper" }, minus, pips, el("span", { "aria-live": "polite" }, `${lvl}`), plus)));
    }
    const left = RULES.power - C.used();
    $("powerLine").textContent = `⚡ Power used: ${C.used()} of ${RULES.power}` + (left ? ` (${left} left, use it!)` : " 👍");
    const p = C.preview();
    $("preview").textContent =
      `If you press Go: air ${sign(p.o2Delta, 1)} kg, water ${sign(p.waterDelta, 1)}%, food ${sign(p.foodDelta, 0)} packs, radiation +${fmt(p.baseDose + p.stormDose, 1)} mSv.`;
  }

  function renderSol() {
    $("solTitle").textContent = `Sol ${S().sol} of 10 · ${fmtDate(C.solData(S().sol).info.date)}`;
    renderTimeline(); renderGauges(); renderEvent(); renderAlloc();
    $("allocPanel").classList.remove("hidden");
    $("feedbackPanel").classList.add("hidden");
  }

  function renderReport(r) {
    $("allocPanel").classList.add("hidden");
    renderGauges();
    $("fbTitle").textContent = S().fail ? `Sol ${r.sol}: uh-oh!` : `Sol ${r.sol}: done!`;
    $("fbList").replaceChildren(
      el("li", {}, r.o2Delta >= 0
        ? `😊 Air: everyone can breathe. (${sign(r.o2Delta, 1)} kg oxygen)`
        : `😟 Air went down: ${sign(r.o2Delta, 2)} kg. Life Support needs more power.`),
      el("li", {}, r.rec >= 0.98
        ? `💧 Water: cleaned and reused. (${sign(r.waterDelta, 1)}%)`
        : `😟 Water went down: ${sign(r.waterDelta, 1)}%. Life Support had too little power to clean it.`),
      el("li", {}, r.foodDelta >= 0
        ? `🥕 Food: the greenhouse grew enough. (${sign(r.foodDelta, 0)} packs)`
        : `😟 Food went down: ${sign(r.foodDelta, 0)} packs. The greenhouse needs more power.`),
      el("li", {}, r.sepCount
        ? (r.alloc.sh >= 2
            ? `🛡️ Great shielding! Only ${fmt(r.stormDose, 1)} mSv got through. Without a shield it would be ${fmt(r.stormRaw, 1)}.`
            : `⚠️ The storm hit hard: +${fmt(r.stormDose, 1)} mSv. A stronger shield blocks more.`)
        : `☀️ No storm particles. Just normal Mars radiation: +${BASE_DOSE} mSv.` + (r.alloc.sh ? " (The shield wasn't needed today.)" : ""))
    );
    $("fbFact").replaceChildren(el("b", {}, "🧠 Real fact: "), r.fact);
    $("btnNext").textContent = S().fail ? "See what happened →" : (S().sol >= 10 ? "Finish the mission 🏁" : "Next sol →");
    $("feedbackPanel").classList.remove("hidden");
    $("feedbackPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startGame() { C.newGame(); show("scrGame"); renderSol(); }

  /* ---------------------------------------------------------------- end + results */
  function endGame() {
    show("scrEnd");
    const s = S(), won = !s.fail;
    const t = $("endTitle");
    t.className = won ? "result-win" : "result-fail";
    t.textContent = won ? "🎉 Mission success! All 4 astronauts are safe." : "💥 Mission failed. Now you know why!";
    $("endSummary").textContent = `You played ${s.log.length} sol${s.log.length > 1 ? "s" : ""} of the real ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} storm. ` +
      `At the end: ${fmt(Math.max(0, s.o2), 1)} kg air, ${Math.round(Math.max(0, s.water))}% water, ${fmt(Math.max(0, s.food), 0)} food packs, ${fmt(s.dose, 1)} mSv radiation.`;
    const chain = C.buildChain(s);
    $("endChain").replaceChildren(...chain.items.map((x) => el("li", {}, x)));
    $("endHint").textContent = "💡 " + chain.hint;
    $("endLearned").replaceChildren(...C.learned(s).map((x) => el("li", {}, x)));
  }

  function showResults() {
    show("scrResults");
    const pre = scores.pre ? scores.pre.filter(Boolean).length : null;
    const post = scores.post.filter(Boolean).length;
    const diff = pre == null ? 0 : post - pre;
    $("resultLine").textContent = pre == null
      ? `${post} of 3 right!`
      : `Before: ${pre} of 3 → After: ${post} of 3 ${diff > 0 ? "🎉" : post === 3 ? "⭐" : ""}`;
    $("resultTable").replaceChildren(
      el("tr", {}, el("th", {}, "Question"), el("th", {}, "Before"), el("th", {}, "After"), el("th", {}, "Right answer")),
      ...QUIZ.map((q, i) => el("tr", {}, el("td", {}, q.q),
        el("td", {}, scores.pre ? (scores.pre[i] ? "✓" : "✗") : "-"),
        el("td", {}, scores.post[i] ? "✓" : "✗"),
        el("td", {}, q.a[q.correct]))));
  }

  /* ---------------------------------------------------------------- sources panel (for teachers and judges) */
  function renderSources() {
    const b = $("srcBody"); b.replaceChildren();
    b.append(el("h3", {}, "Live-fetched (NASA DONKI via api.nasa.gov)"));
    if (D.data_status.startsWith("SAMPLE")) b.append(el("p", { class: "banner" }, D.data_status));
    for (const s of D.sources) {
      b.append(el("p", {}, el("span", { class: "badge live" }, "live-fetched"), " ", el("b", {}, s.dataset), el("br"),
        el("span", { class: "small muted" }, `Endpoint: ${s.endpoint} · HTTP ${s.status} · ${s.records} records` +
          (s.flares_parsed != null ? ` (${s.flares_parsed} flares parsed)` : "") + ` · fetched ${s.fetched_at}`),
        s.fallback_reason ? el("span", { class: "small muted" }, el("br"), `Note: used because ${s.fallback_reason}.`) : ""));
    }
    b.append(el("p", { class: "small" }, `Storm window: ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} (10 sols). ${D.flares.length} flares and ${D.sep_events.length} SEP records are used, each with its source line on the event card. Raw API responses: data/raw/.`));
    b.append(el("h3", {}, "Published reference values"));
    const t = el("table", {}, el("tr", {}, el("th", {}, "Value"), el("th", {}, "What"), el("th", {}, "Source")));
    for (const r of D.reference_values) t.append(el("tr", {},
      el("td", {}, el("span", { class: "badge ref" }, "reference"), ` ${r.value} ${r.unit}`),
      el("td", {}, r.label), el("td", {}, r.source)));
    b.append(t);
    b.append(el("h3", { style: "margin-top:14px" }, "Game rules (simplified, not NASA data)"));
    const g = el("table", {});
    for (const [k, v] of C.GAME_RULES_TABLE) g.append(el("tr", {}, el("td", {}, el("span", { class: "badge rule" }, "game rule"), " ", k), el("td", {}, v)));
    b.append(g);
    b.append(el("h3", { style: "margin-top:14px" }, "Honest caveats"));
    b.append(el("ul", {}, ...[...D.caveats, ...D.warnings].map((c) => el("li", { class: "small" }, c))));
  }

  /* ---------------------------------------------------------------- wiring */
  C.subscribe((type, state, payload) => {
    if (type === "alloc") { renderAlloc(); renderGauges(); }
    else if (type === "sol") renderReport(payload);
    else if (type === "next") renderSol();
    else if (type === "end") endGame();
  });

  const sample = D.data_status.startsWith("SAMPLE");
  const badge = $("dataBadge");
  badge.className = "badge " + (sample ? "bad" : "live");
  badge.textContent = sample ? "SAMPLE DATA - NOT REAL" : `Real NASA data · fetched ${D.fetched_at.slice(0, 10)}`;
  if (sample) { $("banner").textContent = "SAMPLE DATA - NOT REAL NASA DATA. Run python data/fetch_nasa_data.py."; $("banner").classList.remove("hidden"); }
  $("introWindow").textContent = `${fmtDate(D.window.start)} to ${fmtDate(D.window.end)}`;
  $("introPower").textContent = RULES.power;
  $("btnIntroNext").onclick = () => { introStep = Math.min(steps.length - 1, introStep + 1); renderIntro(); };
  $("btnIntroBack").onclick = () => { introStep = Math.max(0, introStep - 1); renderIntro(); };
  $("btnStart").onclick = () => renderQuiz("pre");
  $("btnQuizDone").onclick = gradeQuiz;
  $("btnEndSol").onclick = () => C.runSol();
  $("btnNext").onclick = () => C.nextSol();
  $("btnPostQuiz").onclick = () => renderQuiz("post");
  $("btnReplay").onclick = startGame;
  $("btnSources").onclick = () => { renderSources(); $("dlgSources").showModal(); };
  $("btnCloseSources").onclick = () => $("dlgSources").close();
  renderIntro();
})();
