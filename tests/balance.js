// Balance check for every real storm week. Run: node tests/balance.js
// (a) the default never-changing plan must LOSE,
// (b) at least one plan must WIN,
// (c) Gold (5+ stars) must be reachable but hard (rare for random players).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { console, Math };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["data/events.js", "src/game.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const C = ctx.MissionCore, R = C.RULES;

/** Every allowed power split for a sol (each 0-3, science 0/1 on calm sols, total <= 5). */
function choices(sol) {
  const out = [], calm = C.isCalm(sol);
  for (let ls = 0; ls <= 3; ls++) for (let gh = 0; gh <= 3; gh++) for (let sh = 0; sh <= 3; sh++)
    for (let sci = 0; sci <= (calm ? 1 : 0); sci++)
      if (ls + gh + sh + sci <= R.power) out.push({ ls, gh, sh, sci });
  return out;
}
function step(s, a, sol) {
  const r = C.simulate(s, a, sol);
  return { o2: r.after.o2, water: r.after.water, food: r.after.food, dose: r.after.dose, stars: s.stars + r.sci, fail: C.checkFail(r.after) };
}
const start = () => ({ o2: R.o2Start, water: 100, food: R.foodStart, dose: 0, stars: 0 });
const rankOf = (s) => (s.stars >= R.goldStars ? "Gold" : s.stars >= R.silverStars ? "Silver" : "Bronze");

/** Exhaustive search with merging of identical states (keeps the best stars and one example plan). */
function search() {
  let states = new Map([["start", { ...start(), plan: [] }]]);
  for (let sol = 1; sol <= 10; sol++) {
    const next = new Map(), opts = choices(sol);
    for (const s of states.values()) for (const a of opts) {
      const n = step(s, a, sol);
      if (n.fail) continue;
      const key = [n.o2.toFixed(2), n.water.toFixed(2), n.food, n.dose.toFixed(2)].join("|");
      const old = next.get(key);
      if (!old || old.stars < n.stars) next.set(key, { ...n, plan: s.plan.concat([`${a.ls}${a.gh}${a.sh}${a.sci ? "+S" : ""}`]) });
    }
    states = next;
  }
  const finals = [...states.values()];
  const best = finals.reduce((b, s) => (!b || s.stars > b.stars ? s : b), null);
  return { survivingEndStates: finals.length, bestStars: best ? best.stars : null, bestPlan: best ? best.plan : null };
}

/** Random players: each sol pick uniformly among allowed splits (or only splits using all 5 points). */
function randomPlayers(n, fullPowerOnly, seed) {
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const res = { win: 0, Bronze: 0, Silver: 0, Gold: 0 };
  for (let i = 0; i < n; i++) {
    let s = start(), dead = false;
    for (let sol = 1; sol <= 10 && !dead; sol++) {
      let opts = choices(sol);
      if (fullPowerOnly) opts = opts.filter((a) => a.ls + a.gh + a.sh + a.sci === R.power);
      s = step(s, opts[Math.floor(rnd() * opts.length)], sol);
      dead = !!s.fail;
    }
    if (!dead) { res.win++; res[rankOf(s)]++; }
  }
  const pct = (k) => ((100 * res[k]) / n).toFixed(2) + "%";
  return { win: pct("win"), Silver: pct("Silver"), Gold: pct("Gold") };
}

let failures = 0;
for (const storm of C.storms) {
  C.newGame(storm.id);
  let s = start(), fail = null, sol = 1;
  for (; sol <= 10 && !fail; sol++) { s = step(s, { ls: 2, gh: 2, sh: 1, sci: 0 }, sol); fail = s.fail; }
  const def = fail ? `LOSES (${fail} on sol ${sol - 1}, dose ${s.dose.toFixed(1)} mSv)` : `survives (dose ${s.dose.toFixed(1)} mSv)`;
  const srch = search();
  const any = randomPlayers(20000, false, 7), full = randomPlayers(20000, true, 11);
  const a = !!fail, b = srch.bestStars !== null, c = b && srch.bestStars >= R.goldStars && parseFloat(full.Gold) < 10;
  console.log(`\n=== ${storm.id} (${storm.window.start} to ${storm.window.end}), SEP per sol: ${storm.sols.map((x) => x.sep_count).join(" ")}`);
  console.log(`(a) default plan 2/2/1 never changed: ${def}  ${a ? "PASS" : "FAIL"}`);
  console.log(`(b) winning plans exist: ${b ? "yes" : "no"} (${srch.survivingEndStates} distinct surviving end states)  ${b ? "PASS" : "FAIL"}`);
  console.log(`(c) best possible stars: ${srch.bestStars} -> ${srch.bestStars >= R.goldStars ? "Gold reachable" : "Gold NOT reachable"}; ` +
              `random players (any split): win ${any.win}, Silver ${any.Silver}, Gold ${any.Gold}; ` +
              `random players (all 5 points used): win ${full.win}, Silver ${full.Silver}, Gold ${full.Gold}  ${c ? "PASS" : "FAIL"}`);
  console.log(`    example best plan (LifeSupport Greenhouse Shield, +S = science): ${srch.bestPlan ? srch.bestPlan.join(" ") : "-"}`);
  if (!(a && b && c)) failures++;
}
console.log(failures ? `\n${failures} storm week(s) FAILED the balance check` : "\nAll storm weeks pass the balance check");
process.exit(failures ? 1 : 0);
