/*
 * 2D user interface. Reads state from MissionCore (src/game.js) and calls its
 * actions from buttons. Contains no game rules.
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
    $("btnStart").disabled = true;
    return;
  }

  const { D, RULES, O2_NEED, BASE_DOSE, QUIZ, fmt, fmtDate, fmtTime, sign } = C;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const S = () => C.state;

  function show(id) {
    for (const s of ["scrIntro", "scrQuiz", "scrGame", "scrEnd", "scrResults"]) $(s).classList.toggle("hidden", s !== id);
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- quiz */
  let quizPhase = "pre";
  const scores = { pre: null, post: null };

  function renderQuiz(phase) {
    quizPhase = phase;
    $("quizTitle").textContent = phase === "pre" ? "Pre-mission check (3 questions)" : "Post-mission check (same 3 questions)";
    $("quizHint").textContent = phase === "pre"
      ? "Don't worry if you don't know. We will compare with your answers after the mission."
      : "Let's see what changed.";
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
    if (picks.includes(null)) { alert("Please answer all 3 questions."); return; }
    scores[quizPhase] = picks.map((p, i) => p === QUIZ[i].correct);
    if (quizPhase === "pre") startGame(); else showResults();
  }

  /* ---------------------------------------------------------------- game screen */
  function renderTimeline() {
    const t = $("timeline"); t.replaceChildren();
    for (const s of D.sols) {
      const cls = s.max_class ? s.max_class[0] : "-";
      t.append(el("div", { class: "tl" + (s.sol === S().sol ? " now" : "") + (s.sol < S().sol ? " done" : ""),
                           title: `${fmtDate(s.date)}: ${s.flare_count} flares, max ${s.max_class || "none"}, ${s.sep_count} SEP records` },
        el("span", { class: "cls cls-" + cls }, cls), `Sol ${s.sol}`,
        s.sep_count ? el("span", { class: "sep" }, " P") : ""));
    }
  }

  function gauge(label, valueText, frac, sub) {
    const f = clamp(frac, 0, 1);
    return el("div", { class: "gauge" },
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
      gauge("Life Support (oxygen/water)", `${fmt(o2)} kg O2 · ${fmt(water, 1)} % water`,
        Math.min(s.o2 / RULES.o2Max, s.water / 100), `crew needs ${fmt(O2_NEED)} kg O2 per sol`),
      gauge("Energy", `${C.used()} / ${RULES.power} power units`, C.used() / RULES.power,
        "fixed supply per sol, shared by all systems"),
      gauge("Food", `${fmt(food, 1)} crew-days`, s.food / RULES.foodMax, `crew eats ${RULES.foodNeed} per sol`),
      gauge("Radiation Protection", `${fmt(s.dose, 1)} mSv dose`, 1 - s.dose / RULES.doseLimit, `drill limit ${RULES.doseLimit} mSv`)
    );
  }

  function renderEvent() {
    const { info, flares, seps } = C.solData(S().sol);
    const card = $("eventCard");
    card.className = "panel event" + (seps.length ? " sep" : "");
    card.replaceChildren(el("h3", {}, `Space weather for ${fmtDate(info.date)} (real NASA record)`));
    if (seps.length) {
      card.append(el("p", {}, el("b", { class: "cls-X" }, "PROTON ALERT: "),
        `DONKI logged ${seps.length} solar energetic particle (SEP) detection${seps.length > 1 ? "s" : ""} for this date. Protons raise the crew's dose, so shield now.`));
    } else {
      card.append(el("p", { class: "muted" }, "No proton (SEP) event recorded for this date. Flares are flashes of light; on their own they do not add dose at the surface in this game."));
    }
    if (!flares.length) card.append(el("p", { class: "muted" }, "No flare of class M5 or higher was reported on this date."));
    for (const f of flares) {
      card.append(el("div", { class: "flare" },
        el("span", { class: "cls-" + f.class_letter }, `${f.class} flare`),
        ` peaked at ${fmtTime(f.peak_time)}, region ${f.source_location}` + (f.active_region ? ` (AR ${f.active_region})` : ""),
        f.linked_sep_id ? el("span", { class: "badge bad", style: "margin-left:6px" }, "linked to a proton event") : "",
        el("div", { class: "muted small" }, "Source: ", el("a", { href: f.record_url }, f.source_line))));
    }
    for (const s of seps) {
      card.append(el("div", { class: "muted small" }, "Source: ", el("a", { href: s.record_url }, s.source_line),
        s.instruments.length ? ` (${s.instruments.join(", ")})` : ""));
    }
  }

  const SYSTEMS = [
    ["ls", "Life Support", "makes oxygen and recycles water"],
    ["gh", "Greenhouse", "grows food"],
    ["sh", "Radiation Shield", "cuts the storm dose"]
  ];

  function renderAlloc() {
    const rows = $("allocRows"); rows.replaceChildren();
    for (const [k, name, desc] of SYSTEMS) {
      const lvl = S().alloc[k];
      const pips = el("div", { class: "pips", "aria-hidden": "true" },
        ...Array.from({ length: RULES.maxLevel }, (_, i) => el("span", { class: "pip" + (i < lvl ? " on" : "") })));
      const minus = el("button", { type: "button", "aria-label": `Less power to ${name}` }, "−");
      const plus = el("button", { type: "button", "aria-label": `More power to ${name}` }, "+");
      minus.disabled = lvl <= 0;
      plus.disabled = lvl >= RULES.maxLevel || C.used() >= RULES.power;
      minus.onclick = () => C.setLevel(k, lvl - 1);
      plus.onclick = () => C.setLevel(k, lvl + 1);
      rows.append(el("div", { class: "alloc" },
        el("div", {}, el("b", {}, name), el("div", { class: "muted small" }, desc)),
        el("div", { class: "stepper" }, minus, pips, el("span", { "aria-live": "polite" }, `${lvl}`), plus)));
    }
    $("powerLine").textContent = `Power used: ${C.used()} / ${RULES.power}` + (C.used() < RULES.power ? " (unused power is wasted)" : "");
    const p = C.preview();
    $("preview").textContent =
      `Forecast for this sol: oxygen ${sign(p.o2Delta)} kg, water ${sign(p.waterDelta, 1)} %, food ${sign(p.foodDelta, 1)} crew-days, ` +
      `dose +${fmt(p.baseDose + p.stormDose, 1)} mSv.`;
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
    $("fbTitle").textContent = `Sol ${r.sol} report`;
    $("fbList").replaceChildren(
      el("li", {}, `Life Support level ${r.alloc.ls}: made ${fmt(r.o2Made)} kg O2, crew used ${fmt(O2_NEED)} kg → ${sign(r.o2Delta)} kg. Water recycled ${Math.round(r.rec * 100)}% → ${sign(r.waterDelta, 1)} %.`),
      el("li", {}, `Greenhouse level ${r.alloc.gh}: food ${sign(r.foodDelta, 1)} crew-days.`),
      el("li", {}, r.sepCount
        ? `Shield level ${r.alloc.sh}: the storm would have given ${fmt(r.stormRaw, 1)} mSv. Your shield let through ${fmt(r.stormDose, 1)} mSv, plus ${BASE_DOSE} mSv baseline.`
        : `No proton event: only the baseline ${BASE_DOSE} mSv.` + (r.alloc.sh ? ` (Shield power was not needed today.)` : ""))
    );
    $("fbFact").replaceChildren(el("b", {}, "Real fact: "), r.fact);
    $("btnNext").textContent = S().fail ? "See what happened" : (S().sol >= 10 ? "Finish mission" : "Next sol");
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
    t.textContent = won ? "MISSION SUCCESS: all 4 astronauts made it through the storm" : "MISSION FAILED";
    $("endSummary").textContent = `You played ${s.log.length} sols of the real ${fmtDate(D.window.start)} to ${fmtDate(D.window.end)} storm. ` +
      `Final: oxygen ${fmt(Math.max(0, s.o2))} kg, water ${fmt(Math.max(0, s.water), 1)} %, food ${fmt(Math.max(0, s.food), 1)} crew-days, dose ${fmt(s.dose, 1)} mSv.`;
    const chain = C.buildChain(s);
    $("endChain").replaceChildren(...chain.items.map((x) => el("li", {}, x)));
    $("endHint").textContent = chain.hint;
    $("endLearned").replaceChildren(...C.learned(s).map((x) => el("li", {}, x)));
  }

  function showResults() {
    show("scrResults");
    const pre = scores.pre ? scores.pre.filter(Boolean).length : null;
    const post = scores.post.filter(Boolean).length;
    $("resultLine").textContent = pre == null
      ? `Post-mission check: ${post} / 3 correct.`
      : `Before the mission: ${pre} / 3 · After the mission: ${post} / 3 (${post - pre >= 0 ? "+" : ""}${post - pre})`;
    $("resultTable").replaceChildren(
      el("tr", {}, el("th", {}, "Question"), el("th", {}, "Before"), el("th", {}, "After"), el("th", {}, "Correct answer")),
      ...QUIZ.map((q, i) => el("tr", {}, el("td", {}, q.q),
        el("td", {}, scores.pre ? (scores.pre[i] ? "✓" : "✗") : "-"),
        el("td", {}, scores.post[i] ? "✓" : "✗"),
        el("td", {}, q.a[q.correct]))));
  }

  /* ---------------------------------------------------------------- sources panel */
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
  badge.textContent = sample ? "SAMPLE DATA - NOT REAL" : `NASA DONKI data, fetched ${D.fetched_at.slice(0, 10)}`;
  if (sample) { $("banner").textContent = "SAMPLE DATA - NOT REAL NASA DATA. Run python data/fetch_nasa_data.py."; $("banner").classList.remove("hidden"); }
  $("introWindow").textContent = `${fmtDate(D.window.start)} to ${fmtDate(D.window.end)}`;
  $("introPower").textContent = RULES.power;
  $("btnStart").onclick = () => renderQuiz("pre");
  $("btnQuizDone").onclick = gradeQuiz;
  $("btnEndSol").onclick = () => C.runSol();
  $("btnNext").onclick = () => C.nextSol();
  $("btnPostQuiz").onclick = () => renderQuiz("post");
  $("btnReplay").onclick = startGame;
  $("btnSources").onclick = () => { renderSources(); $("dlgSources").showModal(); };
  $("btnCloseSources").onclick = () => $("dlgSources").close();
})();
