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
    ["Food", "start " + RULES.foodStart + " crew-days, each greenhouse level grows " + RULES.foodPerLevel + ", the crew eats " + RULES.foodNeed + " per sol, store max " + RULES.foodMax],
    ["Storm dose (proxy)", RULES.doseFromSep + " mSv per DONKI SEP record on that date if unshielded. Real Mars storm doses vary a lot; Curiosity measured about 8 mGy on 20 May 2024."],
    ["Shield effect", "levels 1/2/3 cut storm dose by 40% / 70% / 90%. The baseline 0.64 mSv/day from cosmic rays is not cut."],
    ["Drill dose limit", RULES.doseLimit + " mSv for this 10-sol exercise (game rule, far below NASA's 600 mSv career limit)"],
    ["Sol vs date", "1 sol = 1 real UTC date of the storm window (a real sol is 24 h 39 min)"]
  ];

  const QUIZ = [
    { q: "Each astronaut uses about 0.84 kg of oxygen per day. How much does a crew of 4 need per sol?",
      a: ["0.84 kg", "3.36 kg", "8.4 kg", "0.21 kg"], correct: 1 },
    { q: "In a solar storm, what raises the radiation dose for astronauts on the Mars surface the most?",
      a: ["The bright flash of light from the flare", "Fast protons from the Sun (a solar energetic particle event)",
          "Heat from the flare", "Dust blown by the storm"], correct: 1 },
    { q: "Your base has limited power. What happens if you put almost all power into the radiation shield?",
      a: ["Nothing, the shield is free", "Oxygen making and food growing slow down, so oxygen or food can run out",
          "Radiation goes up", "The base gets more power"], correct: 1 }
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
    const facts = [];
    if (r.sepCount) facts.push(["sep", `Flares are flashes of light. The dangerous part is the fast protons that can follow them. On 20 May 2024, a storm from the same active region 13664 gave Curiosity's RAD detector on Mars about ${val("curiosity_rad_2024_05_20_ugy").toLocaleString("en-US")} micrograys, about 30 chest X-rays (NASA, 2024).`]);
    if (r.sepCount) facts.push(["limit", `NASA limits an astronaut's whole-career radiation dose to ${val("career_dose_limit_msv")} mSv, and one solar particle event to ${val("sep_event_dose_limit_msv")} mSv (NASA-STD-3001). Your shield cut today's storm dose from ${fmt(r.stormRaw, 1)} to ${fmt(r.stormDose, 1)} mSv.`]);
    if (r.alloc.ls < 2) facts.push(["o2", `Oxygen math: each astronaut uses about ${val("o2_kg_per_crew_per_day")} kg O2 per day (NASA life-support value). 4 × ${val("o2_kg_per_crew_per_day")} = ${fmt(O2_NEED)} kg, but your recycler made only ${fmt(r.o2Made)} kg.`]);
    if (r.alloc.ls < 2) facts.push(["water", `The ISS recycles about ${val("iss_water_recovery_pct")}% of its water, including sweat and urine (NASA, 2023). With less power, your recycler recovered only ${Math.round(r.rec * 100)}%.`]);
    facts.push(["base", `Even with no storm, Curiosity measured an average ${BASE_DOSE} mSv per day on the Mars surface (Hassler et al., Science 2014). After ${r.sol} sols that adds up to ${fmt(BASE_DOSE * r.sol, 2)} mSv, and shields don't stop most of it.`]);
    facts.push(["o2", `Oxygen math: 4 astronauts × ${val("o2_kg_per_crew_per_day")} kg = ${fmt(O2_NEED)} kg of O2 per sol. Your recycler made ${fmt(r.o2Made)} kg.`]);
    const pick = facts.find((f) => !S.factsSeen.has(f[0])) || facts[0];
    S.factsSeen.add(pick[0]);
    return pick[1];
  }

  const NAMES = { ls: "Life Support", gh: "Greenhouse", sh: "Shield" };
  function planText(a) { return `Life Support ${a.ls}, Greenhouse ${a.gh}, Shield ${a.sh}`; }
  function biggestOther(a, except) {
    const o = Object.keys(a).filter((k) => k !== except).sort((x, y) => a[y] - a[x])[0];
    return `${NAMES[o]} took ${a[o]}`;
  }

  /** Cause-and-effect chain for the end screen: { items: [text], hint: text }. */
  function buildChain(S) {
    const L = S.log, last = L[L.length - 1], items = [];
    const at = (r) => `Sol ${r.sol} (${fmtDate(r.date)})`;
    if (!S.fail) {
      L.filter((r) => r.sepCount).forEach((r) => items.push(
        `${at(r)}: proton alert, shield ${r.alloc.sh}, storm dose cut from ${fmt(r.stormRaw, 1)} to ${fmt(r.stormDose, 1)} mSv (${planText(r.alloc)}).`));
      items.push(`Total dose ${fmt(S.dose, 1)} mSv stayed under the ${RULES.doseLimit} mSv drill limit, and no supply ran out.`);
      return { items, hint: "Real crews would face this too: these are the actual proton events NASA recorded in May 2024." };
    }
    if (S.fail === "dose") {
      L.filter((r) => r.stormDose > 0).forEach((r) => items.push(
        `${at(r)}: ${r.sepCount} proton detection${r.sepCount > 1 ? "s" : ""} in the real record. Shield at level ${r.alloc.sh} cut ${Math.round(RULES.shieldCut[r.alloc.sh] * 100)}%, so +${fmt(r.stormDose, 1)} mSv.`));
      items.push(`Baseline Mars radiation: ${L.length} sols × ${BASE_DOSE} mSv = ${fmt(L.length * BASE_DOSE)} mSv.`);
      items.push(`Total ${fmt(S.dose, 1)} mSv went over the ${RULES.doseLimit} mSv drill limit on Sol ${last.sol}. The crew had to evacuate. MISSION FAILED.`);
      return { items, hint: "What would have worked: on proton-alert sols, put the Shield at 3 and take 1 power from the Greenhouse or Life Support for that sol. Use the quiet sols to rebuild food and oxygen." };
    }
    const key = { o2: "o2Delta", water: "waterDelta", food: "foodDelta" }[S.fail];
    const sys = S.fail === "food" ? "gh" : "ls";
    L.filter((r) => r[key] < 0).forEach((r) => {
      const why = r.alloc[sys] < 2 ? `${NAMES[sys]} got only ${r.alloc[sys]} power (${biggestOther(r.alloc, sys)}${r.sepCount ? `, during a real proton alert` : ""})` : `${NAMES[sys]} at ${r.alloc[sys]}`;
      const what = S.fail === "o2" ? `the recycler made ${fmt(r.o2Made)} kg O2 but the crew needed ${fmt(O2_NEED)} kg → ${sign(r.o2Delta)} kg`
        : S.fail === "water" ? `water was recycled at only ${Math.round(r.rec * 100)}% → ${sign(r.waterDelta, 1)} %`
        : `the greenhouse grew ${r.alloc.gh * RULES.foodPerLevel} crew-days but the crew ate ${RULES.foodNeed} → ${sign(r.foodDelta, 1)} crew-days`;
      items.push(`${at(r)}: ${why}, so ${what}.`);
    });
    const label = { o2: "Oxygen reserve", water: "Water tank", food: "Food store" }[S.fail];
    items.push(`${label} ran out on Sol ${last.sol}. MISSION FAILED.`);
    return { items, hint: `What would have worked: keep ${NAMES[sys]} at level 2 or more on most sols. Take power for the shield only on proton-alert sols, and only for one sol at a time.` };
  }

  function learned(S) {
    const stormSols = S.log.filter((r) => r.sepCount).length;
    const o2 = val("o2_kg_per_crew_per_day");
    return [
      `Oxygen: crew need = astronauts × ${o2} kg per day. 4 × ${o2} = ${fmt(O2_NEED)} kg every sol.`,
      `Solar flares are light. Fast protons (SEP events) are what raise the dose. You faced ${stormSols} real proton-alert sol${stormSols === 1 ? "" : "s"}, on top of Mars' everyday ${BASE_DOSE} mSv per day.`,
      `Power is shared. Every unit you gave the shield was taken from oxygen or food. That trade-off is why a base needs reserves before a storm.`
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
