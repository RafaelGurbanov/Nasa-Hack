// Regression test for the game core. Run: node tests/core.test.js
// Expected numbers were recorded in the browser before the core was moved to src/game.js.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["data/events.js", "src/game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const C = ctx.MissionCore;

function play(plan) {
  C.newGame();
  for (const p of plan) {
    if (p) C.setAlloc({ ls: p[0], gh: p[1], sh: p[2] });
    C.runSol();
    if (!C.nextSol()) break;
  }
  const s = C.state;
  return { fail: s.fail, sol: s.log.length, dose: +s.dose.toFixed(1), o2: +s.o2.toFixed(2), food: s.food };
}

const cases = [
  ["demo path wins", [[2,3,0],[2,3,0],[2,3,0],[2,1,2],[1,1,3],[2,1,2],[3,2,0],[1,1,3],[2,3,0],[2,3,0]],
    { fail: null, sol: 10, dose: 15.2, o2: 8.4, food: 14 }],
  ["one wrong decision (shield 0 on sol 8) fails on dose", [[2,2,1],[2,2,1],[2,2,1],[2,1,2],[1,1,3],[2,1,2],[2,2,1],[3,2,0],[2,2,1],[2,2,1]],
    { fail: "dose", sol: 8, dose: 35.5 }],
  ["all power to shield fails on oxygen", Array(10).fill([1,1,3]), { fail: "o2", sol: 7 }],
  ["no greenhouse fails on food", Array(10).fill([3,0,2]), { fail: "food", sol: 4 }],
  ["never changing the default plan fails on dose", Array(10).fill(null), { fail: "dose", sol: 8, dose: 38.7 }],
];

let failed = 0;
for (const [name, plan, want] of cases) {
  const got = play(plan);
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}  ->  ${JSON.stringify(got)}`);
  if (bad.length) { failed++; console.log("      expected", JSON.stringify(want)); }
}

// Rule guard: the core must refuse plans that use more power than available.
const refused = (C.newGame(), C.setAlloc({ ls: 3, gh: 3, sh: 3 }) === false);
console.log(`${refused ? "PASS" : "FAIL"}  core refuses a plan over the power budget`);
if (!refused) failed++;

// Every flare card must point to a raw record that exists in data/raw.
const raw = JSON.parse(fs.readFileSync(path.join(root, "data/raw/2024-05/notifications_flr.json"), "utf8"));
const ids = new Set(raw.map((r) => r.messageID));
const missing = C.storm.flares.filter((f) => !ids.has(f.message_id)).length;
console.log(`${missing ? "FAIL" : "PASS"}  all ${C.storm.flares.length} flare cards match a raw DONKI record`);
if (missing) failed++;

// ---------------------------------------------------------------- new features
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
  if (!ok) failed++;
}

// Every storm week: every flare card and SEP card matches its raw DONKI file.
for (const st of C.storms) {
  const dir = path.join(root, "data/raw", st.id);
  const notes = new Set(JSON.parse(fs.readFileSync(path.join(dir, "notifications_flr.json"), "utf8")).map((r) => r.messageID));
  const seps = new Set(JSON.parse(fs.readFileSync(path.join(dir, "sep.json"), "utf8")).map((r) => r.sepID));
  const badF = st.flares.filter((f) => !notes.has(f.message_id)).length, badS = st.sep_events.filter((s) => !seps.has(s.sep_id)).length;
  check(`storm ${st.id}: ${st.flares.length} flares + ${st.sep_events.length} SEP records match raw DONKI files`, !badF && !badS);
  const linkedOk = st.earth_warnings.every((w) => !w.blast || st.sep_events.some((s) => s.sol === w.storm_sol && s.linked_ids.includes(w.blast.id)));
  check(`storm ${st.id}: every Earth warning comes from a blast DONKI links to that storm`, linkedOk, st.earth_warnings.map((w) => `sol ${w.storm_sol}:${w.status}`).join(", "));
}

// Science missions: calm sols only, cost 1 power point, +1 star; not allowed on storm sols.
C.newGame("2024-05");
check("science allowed on a calm sol (sol 1) with 2/2/0 + science", C.setAlloc({ ls: 2, gh: 2, sh: 0, sci: 1 }));
check("science + 2/2/1 is over the 5-point budget", !C.setAlloc({ ls: 2, gh: 2, sh: 1, sci: 1 }));
let r = C.runSol();
check("science gives +1 star and does not change air, water or food rules", C.state.stars === 1 && r.o2Delta === 0 && r.foodDelta === 0);
C.nextSol();
check("science choice resets to 0 on the next sol", C.state.alloc.sci === 0);
for (let i = 0; i < 2; i++) { C.runSol(); C.nextSol(); }
check("science is refused on a storm sol (sol 4)", C.state.sol === 4 && !C.setAlloc({ ls: 2, gh: 1, sh: 1, sci: 1 }));

// Ranks.
check("rank: survived with 0-2 stars = Bronze, 3-4 = Silver, 5+ = Gold",
  C.rank({ fail: null, stars: 2 }) === "Bronze" && C.rank({ fail: null, stars: 3 }) === "Silver" && C.rank({ fail: null, stars: 5 }) === "Gold" && C.rank({ fail: "dose", stars: 9 }) === null);

// Ask Earth: the answer arrives next sol, not the same sol.
C.newGame("2024-05");
C.askEarth();
const sameSol = C.adviceArriving(1);
C.runSol(); C.nextSol();
const nextSol = C.adviceArriving(2);
check("Earth's advice arrives the NEXT sol", !sameSol && nextSol && nextSol.askedSol === 1, nextSol && nextSol.text);

// Mystery storm: random pick only chooses real storm weeks.
const picked = new Set();
for (let i = 0; i < 60; i++) { C.newGame("random"); picked.add(C.storm.id); }
check("random storm pick uses only the real storm weeks", [...picked].every((id) => C.storms.some((s) => s.id === id)), [...picked].sort().join(", "));
C.newGame();

console.log(failed ? `\n${failed} test(s) failed` : "\nAll tests passed");
process.exit(failed ? 1 : 0);
