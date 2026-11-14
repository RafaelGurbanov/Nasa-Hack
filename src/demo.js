/*
 * Presenter bar for the 5-minute live demo. Only active with ?demo=1 (hidden in normal play).
 * Every jump replays VALID plans through the real game core (MissionCore.setAlloc / runSol / nextSol),
 * so what the judges see is real game state on the real May 2024 storm week, not a fake screen.
 * Games played in demo mode are not saved to the class results.
 */
(function () {
  "use strict";
  if (!/[?&]demo=1\b/.test(location.search)) return;
  const C = window.MissionCore, UI = window.UI;
  const WEEK = "2024-05";
  // A Gold plan for May 2024 (checked with the game rules in node): calm sols 2/2/0 + science,
  // storm sols 4-6 shield 2, the big storm on sol 8 shield 3.  [life support, greenhouse, shield, science]
  const CALM = [2, 2, 0, 1], STORM = [2, 1, 2, 0], BIG = [1, 1, 3, 0];
  const GOLD = [CALM, CALM, CALM, STORM, STORM, STORM, CALM, BIG, CALM, CALM];
  const DEFAULT = Array(10).fill([2, 2, 1, 0]);   // never changing the plan: loses on sol 8 (dose)

  const set = (a) => C.setAlloc({ ls: a[0], gh: a[1], sh: a[2], sci: a[3] || 0 });
  function playTo(plan, sol) {            // start the week and play sols 1..sol-1 with the plan
    UI.startGame(WEEK);
    for (let i = 0; i < sol - 1; i++) { set(plan[i]); C.runSol(); C.nextSol(); }
    note("");
  }
  function playAll(plan) {
    UI.startGame(WEEK);
    for (const a of plan) { set(a); C.runSol(); if (!C.nextSol()) break; }
    note("");
  }
  function sol8(shield) {
    playTo(GOLD, 8);
    set(shield === 3 ? [1, 1, 3, 0] : [3, 2, 0, 0]);
    C.runSol();                                     // the report panel shows today's dose
    const r = C.state.log[C.state.log.length - 1];
    note(`Sol 8, shield ${shield}: storm dose today ${r && r.stormDose != null ? r.stormDose.toFixed(1) : "?"} mSv · total ${C.state.dose.toFixed(1)} of 30 mSv`);
  }
  let noteEl;
  function note(s) { noteEl.textContent = s; }
  const jumps = [
    ["a", "Sol 1 calm", () => playTo(GOLD, 1)],
    ["b", "Earth warning (sol 4)", () => playTo(GOLD, 4)],
    ["c0", "Sol 8 · shield 0", () => sol8(0)],
    ["c3", "Sol 8 · shield 3", () => sol8(3)],
    ["d", "Win · Gold", () => playAll(GOLD)],
    ["e", "Loss · cause chain", () => playAll(DEFAULT)],
    ["f", "Sun today", () => { playAll(GOLD); setTimeout(() => { const s = document.getElementById("sunToday"); if (s) s.scrollIntoView({ block: "center" }); }, 300); }],
  ];
  const bar = document.createElement("nav");
  bar.className = "demobar"; bar.setAttribute("aria-label", "Presenter demo bar");
  bar.innerHTML = "<b>DEMO</b>";
  for (const [id, label, fn] of jumps) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.jump = id; b.textContent = `${id[0]}) ${label}`;
    b.onclick = () => { document.querySelectorAll(".star").forEach((x) => x.remove()); window.scrollTo({ top: 0 }); fn(); };
    bar.append(b);
  }
  noteEl = document.createElement("span"); noteEl.className = "demonote"; noteEl.setAttribute("aria-live", "polite");
  bar.append(noteEl);
  document.body.append(bar);
  document.body.classList.add("demo");
  window.DEMO = { jumps: Object.fromEntries(jumps.map(([id, , fn]) => [id, fn])) };
})();
