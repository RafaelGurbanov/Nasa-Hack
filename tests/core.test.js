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
const raw = JSON.parse(fs.readFileSync(path.join(root, "data/raw/notifications_flr.json"), "utf8"));
const ids = new Set(raw.map((r) => r.messageID));
const missing = C.D.flares.filter((f) => !ids.has(f.message_id)).length;
console.log(`${missing ? "FAIL" : "PASS"}  all ${C.D.flares.length} flare cards match a raw DONKI record`);
if (missing) failed++;

console.log(failed ? `\n${failed} test(s) failed` : "\nAll tests passed");
process.exit(failed ? 1 : 0);
