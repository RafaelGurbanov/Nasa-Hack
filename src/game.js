/*
 * MissionCore - the game rules and state. No DOM code here.
 * The UI (src/ui.js) only READS state and listens to events; its buttons call the actions.
 *
 * Classic script (not an ES module) so the game also runs from file:// offline.
 */
(function (root) {
  "use strict";
  const D = root.MISSION_DATA;
  if (!D || !D.storms || !D.storms.length) { root.MissionCore = null; return; }

  /* ---------------------------------------------------------------- NASA values (from events.json) */
  const REF = Object.fromEntries(D.reference_values.map((r) => [r.key, r]));
  const val = (k) => REF[k].value;

  /* ---------------------------------------------------------------- the storm week being played */
  let ST = D.storms[0];                                       // default: May 2024 (tests rely on this)

  /* ---------------------------------------------------------------- game rules
     Everything below that is not read with val() is a GAME RULE (simplified for play),
     listed in GAME_RULES_TABLE and shown in the sources panel. */
  const CREW = 4;
  const O2_NEED = CREW * val("o2_kg_per_crew_per_day");   // 4 x 0.84 = 3.36 kg per sol
  const BASE_DOSE = val("mars_surface_dose_msv_per_day");  // 0.64 mSv per sol
  const RULES = {
    power: 5,                    // power units available per sol
    maxLevel: 3,
    o2PerLevel: O2_NEED / 2,     // level 2 exactly covers the crew's need
    o2Start: O2_NEED * 3,        // 3 sols of reserve
    o2Max: O2_NEED * 5,
    waterUsePct: 25,             // a full tank lasts 4 sols with no recycling
    recovery: [0, 0.93, val("iss_water_recovery_pct") / 100, val("iss_water_recovery_pct") / 100],
    foodStart: 12,               // food packs = crew-days of food (3 sols)
    foodMax: 20,
    foodPerLevel: 2,             // food packs grown per greenhouse level
    foodNeed: CREW,              // 1 pack per astronaut per sol
    doseFromSep: 4,              // mSv per DONKI SEP record that sol, if unshielded (proxy)
    shieldCut: [0, 0.4, 0.7, 0.9],
    doseLimit: 30,               // mSv drill limit for this 10-sol exercise
    scienceCost: 1,              // a science mission uses 1 of the 5 power points (calm sols only)
    silverStars: 3, goldStars: 5 // end rank: survived = Bronze, +3 stars = Silver, +5 stars = Gold
  };

  /* ---------------------------------------------------------------- text helpers */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) { const [y, m, d] = iso.slice(0, 10).split("-"); return `${+d} ${MONTHS[+m - 1]} ${y}`; }
  function fmtTime(iso) { return iso ? iso.slice(11, 16) + " UTC" : "?"; }
  function fmt(x, d = 2) { return (Math.round(x * 10 ** d) / 10 ** d).toString(); }
  function sign(x, d = 2) { return (x >= 0 ? "+" : "") + fmt(x, d); }

  // Rules table and quiz as text keys (locales/*.json); the screen translates them.
  const K = (k, v) => ({ k, v });
  const GAME_RULES_TABLE = [
    ["rule.crew.k", K("rule.crew.v")],
    ["rule.power.k", K("rule.power.v", { power: RULES.power })],
    ["rule.ls.k", K("rule.ls.v", { perLevel: RULES.o2PerLevel })],
    ["rule.o2.k", K("rule.o2.v", { start: RULES.o2Start, max: RULES.o2Max })],
    ["rule.water.k", K("rule.water.v")],
    ["rule.food.k", K("rule.food.v", { start: RULES.foodStart, per: RULES.foodPerLevel, need: RULES.foodNeed, max: RULES.foodMax })],
    ["rule.dose.k", K("rule.dose.v", { perSep: RULES.doseFromSep })],
    ["rule.shield.k", K("rule.shield.v")],
    ["rule.limit.k", K("rule.limit.v", { limit: RULES.doseLimit })],
    ["rule.sol.k", K("rule.sol.v")],
    ["rule.mystery.k", K("rule.mystery.v", { n: D.storms.length })],
    ["rule.sci.k", K("rule.sci.v", { silver: RULES.silverStars, gold: RULES.goldStars })],
    ["rule.warn.k", K("rule.warn.v")],
    ["rule.advice.k", K("rule.advice.v")]
  ];
  // Quiz for ages 7-12 (text in locales: quiz.N.q / quiz.N.aJ). Values are the game's NASA values.
  const QUIZ = [{ n: 1, correct: 1 }, { n: 2, correct: 0 }, { n: 3, correct: 2 }];

  /* ---------------------------------------------------------------- simulation (pure) */
  function solData(n) {
    return {
      info: ST.sols.find((s) => s.sol === n),
      flares: ST.flares.filter((f) => f.sol === n),
      seps: ST.sep_events.filter((s) => s.sol === n)
    };
  }
  const isCalm = (n) => solData(n).seps.length === 0;

  function newState() {
    return { sol: 1, o2: RULES.o2Start, water: 100, food: RULES.foodStart, dose: 0,
             alloc: { ls: 2, gh: 2, sh: 1, sci: 0 }, log: [], ended: false, fail: null, factsSeen: new Set(),
             stars: 0, missions: [], advice: null };
  }

  /** One sol. Pure: returns the changes and new values, does not modify state. */
  function simulate(state, alloc, n) {
    const sd = solData(n);
    const sci = alloc.sci && sd.seps.length === 0 ? 1 : 0;
    const o2Made = alloc.ls * RULES.o2PerLevel;
    const o2Delta = o2Made - O2_NEED;
    const rec = RULES.recovery[alloc.ls];
    const waterDelta = -(1 - rec) * RULES.waterUsePct;
    const foodDelta = alloc.gh * RULES.foodPerLevel - RULES.foodNeed;
    const stormRaw = sd.seps.length * RULES.doseFromSep;
    const stormDose = stormRaw * (1 - RULES.shieldCut[alloc.sh]);
    return {
      sol: n, date: sd.info.date, alloc: { ls: alloc.ls, gh: alloc.gh, sh: alloc.sh, sci }, o2Made, o2Delta, rec, waterDelta, foodDelta,
      sepCount: sd.seps.length, stormRaw, stormDose, baseDose: BASE_DOSE, sci,
      after: {
        o2: Math.min(RULES.o2Max, state.o2 + o2Delta),
        water: Math.min(100, state.water + waterDelta),
        food: Math.min(RULES.foodMax, state.food + foodDelta),
        dose: state.dose + BASE_DOSE + stormDose
      }
    };
  }

  function checkFail(a) {
    if (a.dose > RULES.doseLimit) return "dose";
    if (a.o2 < 0) return "o2";
    if (a.water <= 0) return "water";
    if (a.food < 0) return "food";
    return null;
  }

  function rank(S) {
    if (S.fail) return null;
    return S.stars >= RULES.goldStars ? "Gold" : S.stars >= RULES.silverStars ? "Silver" : "Bronze";
  }

  /* ---------------------------------------------------------------- science missions (calm sols) */
  function missionFor(n) {
    const calmBefore = ST.sols.filter((s) => s.sol < n && s.sep_count === 0).length;
    const list = D.science_missions || [];
    return list.length ? list[calmBefore % list.length] : null;
  }

  /* ---------------------------------------------------------------- Earth communication */
  /** Real DONKI-based warnings that reach the base on sol n. */
  function earthWarnings(n) { return (ST.earth_warnings || []).filter((w) => w.warn_sol === n); }
  /** Advice from Earth: based on the base when you asked; arrives the next sol. */
  function adviceFor(s) {
    if (s.o2 < O2_NEED * 2) return K("advice.air");
    if (s.food < RULES.foodNeed * 2) return K("advice.food");
    if (s.dose > RULES.doseLimit * 0.5) return K("advice.dose");
    return K("advice.good");
  }

  /* ---------------------------------------------------------------- teaching text (as text keys) */
  function pickFact(S, r) {
    const o2 = val("o2_kg_per_crew_per_day");
    const facts = [];
    if (r.sepCount) facts.push(["sep", K("fact.sep", { ugy: val("curiosity_rad_2024_05_20_ugy") })]);
    if (r.sepCount) facts.push(["limit", K("fact.limit", { career: val("career_dose_limit_msv"), raw: r.stormRaw, dose: r.stormDose })]);
    if (r.alloc.ls < 2) facts.push(["o2", K("fact.o2low", { o2, need: O2_NEED, made: r.o2Made })]);
    if (r.alloc.ls < 2) facts.push(["water", K("fact.water", { pct: val("iss_water_recovery_pct"), rec: Math.round(r.rec * 100) })]);
    if (ST.light_delay && ST.light_delay.minutes) facts.push(["delay", K("fact.delay", { min: Math.round(ST.light_delay.minutes), m1: val("mars_trip_months"), m2: val("mars_trip_months_max") })]);
    facts.push(["osdr", K("fact.osdr")]);
    facts.push(["base", K("fact.base", { dose: BASE_DOSE, total: BASE_DOSE * r.sol })]);
    facts.push(["o2", K("fact.o2", { o2, need: O2_NEED, made: r.o2Made })]);
    const pick = facts.find((f) => !S.factsSeen.has(f[0])) || facts[0];
    S.factsSeen.add(pick[0]);
    return pick[1];
  }

  const SYSKEY = { ls: "sys.ls", gh: "sys.gh", sh: "sys.sh" };
  const at = (r) => K("chain.at", { sol: r.sol, date: r.date });
  const plan = (a) => K("chain.plan", { ls: a.ls, gh: a.gh, sh: a.sh });

  /** Cause-and-effect chain for the end screen: { items: [{k,v}], hint: {k,v} }. */
  function buildChain(S) {
    const L = S.log, last = L[L.length - 1], items = [];
    if (!S.fail) {
      L.filter((r) => r.sepCount).forEach((r) => items.push(K("chain.win.storm", { at: at(r), sh: r.alloc.sh, raw: r.stormRaw, dose: r.stormDose, plan: plan(r.alloc) })));
      items.push(K("chain.win.total", { dose: S.dose, limit: RULES.doseLimit }));
      if (S.stars) items.push(K("chain.win.sci", { n: S.stars }));
      return { items, hint: K("chain.win.hint") };
    }
    if (S.fail === "dose") {
      L.filter((r) => r.stormDose > 0).forEach((r) => items.push(K("chain.dose.item", { at: at(r), n: r.sepCount, sh: r.alloc.sh, pct: Math.round(RULES.shieldCut[r.alloc.sh] * 100), dose: r.stormDose })));
      items.push(K("chain.dose.base", { n: L.length, dose: BASE_DOSE, total: L.length * BASE_DOSE }));
      items.push(K("chain.dose.total", { dose: S.dose, sol: last.sol, limit: RULES.doseLimit }));
      return { items, hint: K("chain.dose.hint") };
    }
    const key = { o2: "o2Delta", water: "waterDelta", food: "foodDelta" }[S.fail];
    const sys = S.fail === "food" ? "gh" : "ls";
    L.filter((r) => r[key] < 0).forEach((r) => {
      const other = ["ls", "gh", "sh"].filter((k) => k !== sys).sort((x, y) => r.alloc[y] - r.alloc[x])[0];
      const why = r.alloc[sys] < 2
        ? K("chain.why.low", { sys: K(SYSKEY[sys]), lvl: r.alloc[sys], other: K("chain.why.other", { sys: K(SYSKEY[other]), lvl: r.alloc[other] }),
                               sci: r.sci ? K("chain.why.sci") : "", storm: r.sepCount ? K("chain.why.storm") : "" })
        : K("chain.why.ok", { sys: K(SYSKEY[sys]), lvl: r.alloc[sys] });
      const what = S.fail === "o2" ? K("chain.what.o2", { made: r.o2Made, need: O2_NEED, d_o2: r.o2Delta })
        : S.fail === "water" ? K("chain.what.water", { rec: Math.round(r.rec * 100), d_w: r.waterDelta })
        : K("chain.what.food", { grew: r.alloc.gh * RULES.foodPerLevel, eat: RULES.foodNeed, d_f: r.foodDelta });
      items.push({ k: "_join", parts: [at(r), why, what] });
    });
    items.push(K("chain.out." + S.fail, { sol: last.sol }));
    return { items, hint: K("chain.res.hint", { sys: K(SYSKEY[sys]) }) };
  }

  /** "What you learned": max 3 facts, real NASA values. */
  function learned(S) {
    return [
      K("learned.1", { need: O2_NEED, o2: val("o2_kg_per_crew_per_day") }),
      K("learned.2", { n: S.log.filter((r) => r.sepCount).length }),
      K("learned.3")
    ];
  }

  /* ---------------------------------------------------------------- state + events */
  const listeners = [];
  function emit(type, payload) {
    for (const fn of listeners) {
      try { fn(type, Core.state, payload); } catch (e) { console.warn("MissionCore listener error:", e); }
    }
  }
  function sum(a) { return a.ls + a.gh + a.sh + (a.sci || 0); }

  const Core = {
    D, REF, val, CREW, O2_NEED, BASE_DOSE, RULES, GAME_RULES_TABLE, QUIZ,
    fmt, fmtDate, fmtTime, sign, solData, isCalm, simulate, checkFail, buildChain, learned, rank,
    missionFor, earthWarnings, adviceFor,
    state: null,
    get storm() { return ST; },
    get storms() { return D.storms; },

    /** Read-only listeners (UI). type: "new" | "alloc" | "sol" | "next" | "end" | "advice". */
    subscribe(fn) { listeners.push(fn); },
    used() { return sum(this.state.alloc); },
    /** Start a game. stormId: a storm id, "random", or nothing (= first storm, used by tests). */
    newGame(stormId) {
      if (stormId === "random") ST = D.storms[Math.floor(Math.random() * D.storms.length)];
      else if (stormId) ST = D.storms.find((s) => s.id === stormId) || D.storms[0];
      else ST = D.storms[0];
      this.state = newState(); emit("new"); return this.state;
    },

    /** Change one system's power level; ignored if it breaks the rules. sci is 0/1 on calm sols only. */
    setLevel(k, lvl) {
      const max = k === "sci" ? 1 : RULES.maxLevel;
      if (k === "sci" && lvl > 0 && !isCalm(this.state.sol)) return false;
      const a = { ...this.state.alloc, [k]: lvl };
      if (lvl < 0 || lvl > max || sum(a) > RULES.power) return false;
      this.state.alloc = a; emit("alloc"); return true;
    },
    setAlloc(a) {
      const sci = a.sci ? 1 : 0;
      const ok = ["ls", "gh", "sh"].every((k) => a[k] >= 0 && a[k] <= RULES.maxLevel) && a.ls + a.gh + a.sh + sci <= RULES.power &&
                 (!sci || isCalm(this.state.sol));
      if (ok) { this.state.alloc = { ls: a.ls, gh: a.gh, sh: a.sh, sci }; emit("alloc"); }
      return ok;
    },
    preview() { return simulate(this.state, this.state.alloc, this.state.sol); },

    /** Ask Earth for advice. The answer arrives next sol. One question per sol. */
    askEarth() {
      const S = this.state;
      if (S.advice && S.advice.askedSol === S.sol) return false;
      S.advice = { askedSol: S.sol, arrivesSol: S.sol + 1, text: adviceFor(S) };
      emit("advice"); return true;
    },
    /** The advice that arrives on sol n (or null). */
    adviceArriving(n) { const a = this.state.advice; return a && a.arrivesSol === n ? a : null; },

    runSol() {
      const S = this.state;
      const r = simulate(S, S.alloc, S.sol);
      Object.assign(S, r.after);
      S.log.push(r);
      if (r.sci) { S.stars += 1; r.mission = missionFor(r.sol); S.missions.push(r.mission ? r.mission.id : "science"); }
      S.fail = checkFail(r.after);
      r.fact = pickFact(S, r);
      emit("sol", r);
      return r;
    },
    /** Returns false when the mission is over. */
    nextSol() {
      const S = this.state;
      if (S.fail || S.sol >= 10) { S.ended = true; emit("end"); return false; }
      S.sol++;
      S.alloc.sci = 0;
      S.alloc.sh = Math.min(S.alloc.sh, RULES.power - S.alloc.ls - S.alloc.gh);
      emit("next");
      return true;
    }
  };

  root.MissionCore = Core;
})(typeof window !== "undefined" ? window : globalThis);
