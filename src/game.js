/*
 * MissionCore - the game rules and state. No DOM code here.
 * The UI (src/ui.js) and any 3D layer only READ state and listen to events.
 * Only the UI's buttons call setAlloc / runSol / nextSol.
 *
 * Classic script (not an ES module) so the game also runs from file:// offline.
 */
(function (root) {
  "use strict";
  const D = root.MISSION_DATA;
  if (!D) { root.MissionCore = null; return; }

  /* ---------------------------------------------------------------- NASA values (from events.json) */
  const REF = Object.fromEntries(D.reference_values.map((r) => [r.key, r]));
  const val = (k) => REF[k].value;

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
    foodStart: 12,               // crew-days of food (3 sols)
    foodMax: 20,
    foodPerLevel: 2,             // crew-days grown per greenhouse level
    foodNeed: CREW,              // 1 crew-day per astronaut per sol
    doseFromSep: 4,              // mSv per DONKI SEP record that sol, if unshielded (proxy)
    shieldCut: [0, 0.4, 0.7, 0.9],
    doseLimit: 30                // mSv drill limit for this 10-sol exercise
  };

  /* ---------------------------------------------------------------- text helpers */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) { const [y, m, d] = iso.slice(0, 10).split("-"); return `${+d} ${MONTHS[+m - 1]} ${y}`; }
  function fmtTime(iso) { return iso ? iso.slice(11, 16) + " UTC" : "?"; }
  function fmt(x, d = 2) { return (Math.round(x * 10 ** d) / 10 ** d).toString(); }
  function sign(x, d = 2) { return (x >= 0 ? "+" : "") + fmt(x, d); }

  const GAME_RULES_TABLE = [
    ["Crew size", "4 astronauts"],
    ["Energy: power per sol", RULES.power + " units (it never covers all three systems at full level)"],
    ["Life Support output", "each power level makes " + fmt(RULES.o2PerLevel) + " kg O2, so level 2 covers 4 x 0.84 kg exactly"],
    ["Oxygen reserve at start", fmt(RULES.o2Start) + " kg (3 sols), tank max " + fmt(RULES.o2Max) + " kg"],
    ["Water recycling by Life Support level", "0: 0%, 1: 93%, 2-3: 98% (93% and 98% are the ISS values before and after the brine processor). A full tank lasts 4 sols with no recycling."],
    ["Food", "measured in 'food packs' (1 pack = food for 1 astronaut for 1 day = 1 crew-day). Start " + RULES.foodStart + ", each greenhouse level grows " + RULES.foodPerLevel + ", the crew eats " + RULES.foodNeed + " per sol, store max " + RULES.foodMax],
    ["Storm dose (proxy)", RULES.doseFromSep + " mSv per DONKI SEP record on that date if unshielded. Real Mars storm doses vary a lot; Curiosity measured about 8 mGy on 20 May 2024."],
    ["Shield effect", "levels 1/2/3 cut storm dose by 40% / 70% / 90%. The baseline 0.64 mSv/day from cosmic rays is not cut."],
    ["Drill dose limit", RULES.doseLimit + " mSv for this 10-sol exercise (game rule, far below NASA's 600 mSv career limit)"],
    ["Sol vs date", "1 sol = 1 real UTC date of the storm window (a real sol is 24 h 39 min)"]
  ];

  // Quiz for ages 7-12. Values are the same NASA values used in the game.
  const QUIZ = [
    { q: "One astronaut breathes about 0.84 kg of oxygen each day. There are 4 astronauts. How much oxygen do they need each day?",
      a: ["Less than 1 kg", "About 3.4 kg (4 × 0.84)", "About 10 kg", "None, Mars has air"], correct: 1 },
    { q: "In a space storm (solar flare), what can hurt astronauts on Mars the most?",
      a: ["Tiny, fast pieces from the Sun (protons)", "The bright light", "A loud noise", "Rain"], correct: 0 },
    { q: "The base has only a little power. What happens if you give ALL of it to the shield?",
      a: ["Nothing changes", "The storm stops", "Less air and less food are made", "Mars gets warmer"], correct: 2 }
  ];

  /* ---------------------------------------------------------------- simulation (pure) */
  function solData(n) {
    return {
      info: D.sols.find((s) => s.sol === n),
      flares: D.flares.filter((f) => f.sol === n),
      seps: D.sep_events.filter((s) => s.sol === n)
    };
  }

  function newState() {
    return { sol: 1, o2: RULES.o2Start, water: 100, food: RULES.foodStart, dose: 0,
             alloc: { ls: 2, gh: 2, sh: 1 }, log: [], ended: false, fail: null, factsSeen: new Set() };
  }

  /** One sol. Pure: returns the changes and new values, does not modify state. */
  function simulate(state, alloc, n) {
    const sd = solData(n);
    const o2Made = alloc.ls * RULES.o2PerLevel;
    const o2Delta = o2Made - O2_NEED;
    const rec = RULES.recovery[alloc.ls];
    const waterDelta = -(1 - rec) * RULES.waterUsePct;
    const foodDelta = alloc.gh * RULES.foodPerLevel - RULES.foodNeed;
    const stormRaw = sd.seps.length * RULES.doseFromSep;
    const stormDose = stormRaw * (1 - RULES.shieldCut[alloc.sh]);
    return {
      sol: n, date: sd.info.date, alloc: { ...alloc }, o2Made, o2Delta, rec, waterDelta, foodDelta,
      sepCount: sd.seps.length, stormRaw, stormDose, baseDose: BASE_DOSE,
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

  /* ---------------------------------------------------------------- teaching text */
  function pickFact(S, r) {
    // Facts for ages 7-12: short sentences, real NASA values, real term in brackets.
    const o2 = val("o2_kg_per_crew_per_day");
    const facts = [];
    if (r.sepCount) facts.push(["sep", `The light from a space storm (solar flare) does not hurt the crew. The tiny, fast pieces that come after it (protons) do. On 20 May 2024, a storm from this same part of the Sun reached Mars. NASA's Curiosity rover measured about ${val("curiosity_rad_2024_05_20_ugy").toLocaleString("en-US")} micrograys. That is like 30 chest X-rays!`]);
    if (r.sepCount) facts.push(["limit", `NASA has a safety limit. In a whole career, an astronaut may get at most ${val("career_dose_limit_msv")} mSv of radiation. Today your shield made the storm dose smaller: from ${fmt(r.stormRaw, 1)} to ${fmt(r.stormDose, 1)} mSv.`]);
    if (r.alloc.ls < 2) facts.push(["o2", `Air math: 1 astronaut breathes about ${o2} kg of oxygen a day. That is a bit less than a 1-liter bottle of water weighs. 4 × ${o2} = ${fmt(O2_NEED)} kg. Today your machine made only ${fmt(r.o2Made)} kg.`]);
    if (r.alloc.ls < 2) facts.push(["water", `On the Space Station, NASA cleans and reuses ${val("iss_water_recovery_pct")} of every 100 drops of water, even sweat! Today, with less power, your base reused only ${Math.round(r.rec * 100)} of 100.`]);
    facts.push(["base", `Mars gives a little radiation every day, even with no storm: ${BASE_DOSE} mSv. NASA's Curiosity rover measured this. After ${r.sol} sol${r.sol > 1 ? "s" : ""}, that adds up to ${fmt(BASE_DOSE * r.sol, 2)} mSv.`]);
    facts.push(["o2", `Air math: 4 astronauts × ${o2} kg = ${fmt(O2_NEED)} kg of oxygen each sol. Today your machine made ${fmt(r.o2Made)} kg.`]);
    const pick = facts.find((f) => !S.factsSeen.has(f[0])) || facts[0];
    S.factsSeen.add(pick[0]);
    return pick[1];
  }

  const NAMES = { ls: "Life Support", gh: "Greenhouse", sh: "Shield" };
  function planText(a) { return `Life Support ${a.ls}, Greenhouse ${a.gh}, Shield ${a.sh}`; }
  function biggestOther(a, except) {
    const o = Object.keys(a).filter((k) => k !== except).sort((x, y) => a[y] - a[x])[0];
    return `the ${NAMES[o]} got ${a[o]}`;
  }

  /** Cause-and-effect chain for the end screen (ages 7-12): { items: [text], hint: text }. */
  function buildChain(S) {
    const L = S.log, last = L[L.length - 1], items = [];
    const at = (r) => `Sol ${r.sol} (${fmtDate(r.date)})`;
    if (!S.fail) {
      L.filter((r) => r.sepCount).forEach((r) => items.push(
        `${at(r)}: storm particles! Shield at ${r.alloc.sh}. The storm dose went from ${fmt(r.stormRaw, 1)} down to ${fmt(r.stormDose, 1)} mSv. (${planText(r.alloc)})`));
      items.push(`Total radiation: ${fmt(S.dose, 1)} mSv. That is under the ${RULES.doseLimit} mSv limit. Air, water and food lasted.`);
      return { items, hint: "These were real storm days. NASA recorded them in May 2024." };
    }
    if (S.fail === "dose") {
      L.filter((r) => r.stormDose > 0).forEach((r) => items.push(
        `${at(r)}: ${r.sepCount} storm particle alert${r.sepCount > 1 ? "s" : ""} (protons). Shield at ${r.alloc.sh}. It blocked ${Math.round(RULES.shieldCut[r.alloc.sh] * 100)}%. The crew got +${fmt(r.stormDose, 1)} mSv.`));
      items.push(`Everyday Mars radiation: ${L.length} sols × ${BASE_DOSE} = ${fmt(L.length * BASE_DOSE)} mSv.`);
      items.push(`Total: ${fmt(S.dose, 1)} mSv on Sol ${last.sol}. That is more than the ${RULES.doseLimit} mSv limit. The crew had to go home. Mission failed.`);
      return { items, hint: "Tip: on storm days, turn the shield up to 3. Take 1 power from the greenhouse for that day. On calm days, make extra air and food." };
    }
    const key = { o2: "o2Delta", water: "waterDelta", food: "foodDelta" }[S.fail];
    const sys = S.fail === "food" ? "gh" : "ls";
    L.filter((r) => r[key] < 0).forEach((r) => {
      const why = r.alloc[sys] < 2 ? `The ${NAMES[sys]} got only ${r.alloc[sys]} power (${biggestOther(r.alloc, sys)}${r.sepCount ? `, on a storm day` : ""}).` : `The ${NAMES[sys]} was at ${r.alloc[sys]}.`;
      const what = S.fail === "o2" ? `It made ${fmt(r.o2Made)} kg of oxygen. The crew needed ${fmt(O2_NEED)} kg. (${sign(r.o2Delta)} kg)`
        : S.fail === "water" ? `It reused only ${Math.round(r.rec * 100)} of 100 drops of water. (${sign(r.waterDelta, 1)} %)`
        : `It grew ${r.alloc.gh * RULES.foodPerLevel} food packs. The crew ate ${RULES.foodNeed}. (${sign(r.foodDelta, 1)})`;
      items.push(`${at(r)}: ${why} ${what}`);
    });
    const label = { o2: "The air (oxygen)", water: "The water", food: "The food" }[S.fail];
    items.push(`${label} ran out on Sol ${last.sol}. Mission failed.`);
    return { items, hint: `Tip: give the ${NAMES[sys]} 2 power on most days. Use the shield only on storm days, one day at a time.` };
  }

  /** "What you learned" (ages 7-12), max 3 facts, real NASA values. */
  function learned(S) {
    const stormSols = S.log.filter((r) => r.sepCount).length;
    const o2 = val("o2_kg_per_crew_per_day");
    return [
      `🫧 4 astronauts need about ${fmt(O2_NEED)} kg of oxygen every day (4 × ${o2} kg).`,
      `☀️ The light of a space storm (solar flare) does not hurt. The tiny, fast pieces after it (protons) do. You had ${stormSols} real storm-particle day${stormSols === 1 ? "" : "s"}.`,
      `⚡ Power is shared. More shield means less air and less food. So save extra before a storm!`
    ];
  }

  /* ---------------------------------------------------------------- state + events */
  const listeners = [];
  function emit(type, payload) {
    for (const fn of listeners) {
      try { fn(type, Core.state, payload); } catch (e) { console.warn("MissionCore listener error:", e); }
    }
  }

  const Core = {
    D, REF, val, CREW, O2_NEED, BASE_DOSE, RULES, GAME_RULES_TABLE, QUIZ,
    fmt, fmtDate, fmtTime, sign, solData, simulate, checkFail, buildChain, learned,
    state: null,

    /** Read-only listeners (UI, 3D). type: "new" | "alloc" | "sol" | "next" | "end". */
    subscribe(fn) { listeners.push(fn); },
    used() { const a = this.state.alloc; return a.ls + a.gh + a.sh; },
    newGame() { this.state = newState(); emit("new"); return this.state; },

    /** Change one system's power level; ignored if it breaks the rules. */
    setLevel(k, lvl) {
      const a = { ...this.state.alloc, [k]: lvl };
      if (lvl < 0 || lvl > RULES.maxLevel || a.ls + a.gh + a.sh > RULES.power) return false;
      this.state.alloc = a; emit("alloc"); return true;
    },
    setAlloc(a) {
      const ok = ["ls", "gh", "sh"].every((k) => a[k] >= 0 && a[k] <= RULES.maxLevel) && a.ls + a.gh + a.sh <= RULES.power;
      if (ok) { this.state.alloc = { ls: a.ls, gh: a.gh, sh: a.sh }; emit("alloc"); }
      return ok;
    },
    preview() { return simulate(this.state, this.state.alloc, this.state.sol); },

    runSol() {
      const S = this.state;
      const r = simulate(S, S.alloc, S.sol);
      Object.assign(S, r.after);
      S.log.push(r);
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
      S.alloc.sh = Math.min(S.alloc.sh, RULES.power - S.alloc.ls - S.alloc.gh);
      emit("next");
      return true;
    }
  };

  root.MissionCore = Core;
})(typeof window !== "undefined" ? window : globalThis);
