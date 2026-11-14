# Submission pack: Mars Storm Replay

Space Apps 2026, Ganja. Challenge #07: *Build a Junior Astronaut Mission Trainer*.
Everything here is in English and ready to paste. **VERIFY** every length limit on the
official submission form before pasting. Click **"Submit for Judging" before the pitch**,
because late submissions are not judged.

Team roles (replace the names):

| Member | Role | Speaks in pitch |
|---|---|---|
| [Name 1] | Game logic | Demo (2:00) |
| [Name 2] | 3D scene | How it works + creativity |
| [Name 3] | NASA data | NASA data |
| [Name 4] | Submission + pitch | Opening, impact, close |

---

## 1. Form fields (ready to paste)

### Project Name
**Mars Storm Replay**

(Do not use "Starbound" as the project name. That is the name of an existing commercial game.)

### High-Level Summary
Mars Storm Replay is a browser game for students aged 12 to 16. They keep a crew of four
alive on a Mars base for 10 sols. The 10 sols replay a real solar storm, 6 to 15 May 2024,
using flare and proton-event records from NASA's DONKI database. Each sol, players split
limited power between life support, food and radiation shielding. One wrong decision can
fail the mission, and the end screen shows the exact chain of decisions that caused it.
Every number is either live NASA data, a cited NASA reference value, or a clearly labeled
game rule. A 3-question check before and after play shows each student what they learned.

### Project Demo
Pick ONE: a video of 30 seconds or less with English subtitles, OR a deck of 7 slides or
fewer with the team name, members and challenge. The link must open without a password.
VERIFY both limits on the official sheet. If the limit is exceeded, the project cannot go global.
- Video storyboard: section 5 below.
- Deck outline: section 6 below.

### Final Project
`https://<github-user>.github.io/<repo>/` (fill in after the push, then test it in an incognito window)
Code: `https://github.com/<github-user>/<repo>`

### Detailed Description
**What it does.** The player commands a Mars base with four systems that depend on each
other: Life Support (oxygen/water), Energy, Food and Radiation Protection. Each sol shows
that day's real space weather: the flares (class, peak time, region) and any solar
energetic particle (SEP) proton events NASA recorded, each with a link to its DONKI record.
The player sets the power for Life Support, the Greenhouse and the Shield. Power is fixed
at 5 units per sol and never covers everything. After each sol, a report shows what changed and
teaches one real fact with a formula and a NASA value, for example "4 astronauts × 0.84 kg O2 = 3.36 kg per sol".
If oxygen, water or food runs out, or the dose goes over the 30 mSv drill limit, the
mission fails. The end screen then builds a cause-and-effect chain from the player's own
decisions. A "What you learned" recap and a before/after 3-question check close the session.

**How it works.** A Python script (standard library only) calls NASA's DONKI API once with
a personal key, keeps only the fields the game needs, and writes `events.json` plus a
`events.js` copy. It also stores the unchanged API responses. The game is plain HTML and
JavaScript with no build step and no server. It loads `events.js` with a script tag, so it
also runs offline. All rules live in one core file (`src/game.js`). The 2D interface only
reads its state, and so does the optional 3D view. Automated tests check five game outcomes and
that every event card matches a raw NASA record.

**Tools.** HTML, CSS, JavaScript, Python 3, NASA DONKI API (api.nasa.gov), GitHub Pages,
Claude Code (AI coding assistant, see Use of AI). Three.js only if the 3D view ships.

**Why it matters.** Radiation storms are one of the main dangers for crews on Mars. In
May 2024 the same solar active region that is in our game later sent a storm to Mars;
on 20 May 2024 Curiosity measured about 8,100 micrograys, roughly 30 chest X-rays. Our
game lets a classroom live through those real days, sol by sol, and see why shielding,
oxygen and food have to be planned together.

### NASA Data
- **DONKI notifications, type=FLR** (api.nasa.gov), 2024-05-06 to 2024-05-15, fetched
  2026-11-14: 47 messages, 24 full flare reports (M5.0 and above) parsed. These give the
  date, class, peak time, region and record link for every flare on the event cards.
- **DONKI SEP**, same window: 14 solar energetic particle records. These drive the storm
  dose on the sol they occur (game proxy: 4 mSv per record when unshielded).
- **DONKI FLR** was requested first but returned HTTP 404 on 14 Nov 2026. We report this
  openly. The same flare reports come from the notifications endpoint.
- **Published NASA reference values:** 0.64 mSv/day on the Mars surface (Curiosity RAD,
  Hassler et al. 2014); 0.84 kg O2 per crew member per day (NASA BVAD); 98 % ISS water
  recovery (NASA 2023); 600 mSv career limit and 250 mSv per SEP event (NASA-STD-3001);
  about 8,100 micrograys measured by Curiosity on 20 May 2024 (NASA/JPL).
- In-game, the "NASA data sources" panel labels every value as live-fetched, published
  reference value, or game rule.

### Partner & Other Data
None. (Only NASA data and published NASA references are used. No partner agency data.)
VERIFY: if a reference value is replaced by a non-NASA source, list it here.

### Use of AI
We used Claude (Anthropic) through Claude Code as a coding assistant. It wrote most of the
code and documentation drafts (data fetch script, game logic, 2D interface, tests) based on
our design decisions. All NASA numbers come from the live DONKI API or from cited NASA
sources, never from the AI. Every value is labeled in the game's "NASA data sources" panel.
We tested the game with automated tests and by playing it ourselves. No AI-generated images
or video are used. Full log: AI_USE.md in the repository.
(Only keep "by playing it ourselves" once AI_USE.md has real human test rows.)

---

## 2. Built before vs during the hackathon

| | What | Evidence |
|---|---|---|
| Before the hackathon (14 Nov 11:00) | No code in this repository. [TEAM: if you had a pre-hackathon Moon skeleton or idea notes, name them here. None of that code is used.] | — |
| During the hackathon | Everything in the repository: fetch script, cached data, game core, 2D interface, tests, docs | `git log`: first commit 14 Nov 16:08 (+04:00), every step committed after that |

Show `git log --format="%h %ad %s" --date=iso` on screen if a judge asks.

---

## 3. Five-minute pitch script (300 s, all 4 members speak)

| Time | Speaker | Says / shows |
|---|---|---|
| 0:00-0:35 | [Name 4] | "In May 2024 the Sun fired X-class flares for ten days in a row. A week later, the same active region hit Mars with the biggest radiation spike Curiosity had measured since it landed. What if your class had been the crew? Mars Storm Replay is a 10-to-15-minute trainer for students aged 12 to 16. They run a Mars base through those exact ten days." |
| 0:35-1:15 | [Name 3] | Shows the "NASA data sources" panel. "Every sol is a real date. We fetched 24 flares and 14 proton events from NASA's DONKI API with our own key, cached them, and every card links to its NASA record. The FLR endpoint was down during the hackathon (it returned 404), so we used DONKI notifications for the same flare reports, and the panel says so. Oxygen and baseline radiation use published NASA values: 0.84 kg O2 per astronaut per day and 0.64 mSv per day from Curiosity. Everything else is labeled 'game rule'." |
| 1:15-3:15 | [Name 1] | **Live demo (section 4).** |
| 3:15-3:55 | [Name 2] | "Four systems depend on each other: power is fixed, and shielding costs oxygen and food. All rules live in one core file; the 2D screen and the 3D view only read it, so the view can never change the science. Our one signature idea is the real storm replay, and when you fail, the game shows you why." Shows the failure-chain screenshot: "Shield 0 on Sol 8: 6 real proton records, +24 mSv, mission over." |
| 3:55-4:35 | [Name 4] | "Every sol teaches one fact with a formula. The end screen recaps three. A 3-question check before and after play shows the student what changed. We have not run it with a class yet, so we claim no results, only that the measurement is built in. After 15 minutes, a student can explain why a crew must trade shielding against oxygen, and why protons, not flare light, raise the dose." |
| 4:35-5:00 | [Name 4] | "Next: real Curiosity dose data, Mars-Sun geometry, and a classroom pilot. Everything you saw was built during this hackathon, and the git history shows it. Thank you." |

Rules: one rehearsal with a timer by 06:00. If a section runs over by 10 s, cut words, not the demo.

## 4. Two-minute demo path (avoids failure, tested)

Open the game before the pitch. Skip the quiz by answering quickly (any answers).

| Sol | Set Life Support / Greenhouse / Shield | Say |
|---|---|---|
| 1 | 2 / 3 / 0 | "X4.5 flare today, but no protons, so no shield. We bank food." |
| 2-3 | 2 / 3 / 0 | (click through quickly) "Big flares, still no protons." |
| 4 | 2 / 1 / 2 | "Proton alert from the real record. Shield up, food down for one sol." |
| 5 | 1 / 1 / 3 | "Four proton detections. Full shield; oxygen dips by 1.68 kg." Read the fact line aloud. |
| 6 | 2 / 1 / 2 | |
| 7 | 3 / 2 / 0 | "Quiet sol: refill oxygen." |
| 8 | 1 / 1 / 3 | "Six proton records, the biggest day. Shield 3 cuts 24 mSv to 2.4." |
| 9-10 | 2 / 3 / 0 | |

End result, tested by `tests/core.test.js`: **MISSION SUCCESS**, dose 15.2 mSv, oxygen 8.4 kg,
food 14 crew-days. Then show the end-screen chain and the "What you learned" recap.

## 5. 30-second video storyboard (English subtitles, VERIFY limit)

| Sec | Picture | Subtitle |
|---|---|---|
| 0-4 | Title screen | "May 2024: a real solar storm. Could your class keep a Mars crew alive?" |
| 4-9 | Timeline with X flares and P marks | "Every sol is a real date from NASA's DONKI space-weather data." |
| 9-15 | Power plan: shield up on a proton alert | "Shielding costs power. Power also makes oxygen and grows food." |
| 15-21 | Sol report with the fact line | "Each choice teaches a real fact: 4 astronauts × 0.84 kg O2 = 3.36 kg a day." |
| 21-26 | Failure chain screen | "Fail, and you see exactly why." |
| 26-30 | Success screen + link | "Mars Storm Replay. Space Apps Ganja 2026, Challenge #07." |

Record the screen with the browser at 1280×720. Subtitles must be burned into the video.

## 6. Seven-slide deck outline (if a deck is used instead of the video)

1. **Title:** Mars Storm Replay. Team name, 4 members, Challenge #07 Build a Junior Astronaut Mission Trainer.
2. **Problem + user:** Radiation storms are a top danger on Mars. Students aged 12-16, 10-15 minutes, classroom.
3. **What it is:** 4 systems that depend on each other, 10 sols, hard fail. Screenshot of a sol.
4. **Real storm replay:** 6-15 May 2024 timeline. DONKI flares + SEP records. One card shown with its source line.
5. **Learning:** one fact per decision, 3-fact recap, before/after check. Failure-chain screenshot.
6. **NASA data, honestly:** live vs reference vs game rule table. FLR 404 fallback.
7. **Built here + next:** git timeline; next = RAD dose data, Mars geometry, classroom pilot. Link.

## 7. Fallback plan (if the internet or the page fails)

| Problem | Do this (in this order) |
|---|---|
| Venue Wi-Fi down | Open `index.html` from the laptop's copy of the repo (works from `file://`, no internet needed; tested) |
| Laptop fails | Second laptop or a phone with the GitHub Pages link already open and loaded |
| Everything fails | Show `docs/screenshot-sol5.png` and `docs/screenshot-failure-chain.png` and talk through the demo path |
| 3D view breaks | Ignore it. The 2D game is the full product, and the 3D view is visual only |

Before the pitch: laptop charged, game open in 2 tabs (fresh start, failure screen), screen
resolution tested on the projector, notifications off.

## 8. Mandatory judge questions: prepared answers

**(1) What did you build during the hackathon?**
"Everything in our repository: the NASA fetch script, the cached storm data, the game core
with its 4 systems and failure chain, the 2D interface, the tests and the docs. Our first
commit is 14 November at 16:08, and each step after that is committed; we can show `git log`.
Before the hackathon we had [nothing / only the idea: TEAM fill in], and none of that is in the code."

**(2) Which NASA data did you use?**
"NASA DONKI through api.nasa.gov with our personal key, for 6 to 15 May 2024, fetched on
14 November 2026. We used the notifications endpoint with type FLR, which gave 47 messages
and 24 flare reports of class M5 and above, and the SEP endpoint, which gave 14 proton
records. The FLR endpoint itself returned 404 during the hackathon; we record that in the
data file. Published reference values: 0.64 mSv per day from Curiosity RAD, 0.84 kg O2
per astronaut per day from NASA BVAD, 98 percent ISS water recovery, and NASA-STD-3001
limits. Live data drives the events; reference values drive the formulas. Power units,
shield percentages and the 30 mSv drill limit are game rules, and the game says so."

**(3) What does not work yet / what would you add next?**
1. "The storm dose is a proxy: 4 mSv per proton record, not a physics model. Next we would
   use real Curiosity RAD dose data."
2. "The flares are seen from Earth. We do not yet model where Mars was relative to the Sun."
3. "The learning check is built, but we have not run it with a class, so we have no measured
   results yet. Next is a pilot in a school in Ganja."

**Likely extra questions**
- *Why only M5+ flares?* DONKI notifications only report flares of about M5 and above. The caveat is in the data panel.
- *Is the game too easy or too hard?* Five tested outcomes: the planned path wins; shield 0 on Sol 8 alone fails; all-shield runs out of oxygen on Sol 7; no greenhouse runs out of food on Sol 4.
- *Why is a sol one Earth date?* A simplification for replaying real dates. A real sol is 24 h 39 min, and the game says so.

---

## 9. Project page text (for the Space Apps project page)

**Mars Storm Replay: live through a real solar storm on Mars**

On 6 May 2024 the Sun began ten days of intense activity: more than twenty major flares,
several of them X-class, and repeated bursts of energetic protons. Our game turns those
exact ten days into ten sols on a Mars base. Students aged 12 to 16 take command of a crew of four.

Every sol, a real NASA space-weather record appears: which flares erupted, when they
peaked, and whether a proton storm followed. Players have only 5 units of power to share
between making oxygen and recycling water, growing food, and shielding the crew. Shield
too little and the crew's dose climbs past the limit; shield too much and the oxygen runs
out. When a mission fails, the game shows the student the chain of their own decisions
that led there, sol by sol.

Every number in the game is labeled: live from NASA's DONKI API, a published NASA value
(like Curiosity's 0.64 mSv per day on the Mars surface), or a game rule. Each decision
teaches one real fact, and a short check before and after play shows each student what
they learned.

Built in 24 hours at Space Apps Ganja 2026 for Challenge #07.

---

## 10. Final checklists

**Deployment (run on the public link)**
- [ ] Opens in an incognito window, with no login and no password
- [ ] Works offline: open the local `index.html` with Wi-Fi off and play 1 sol
- [ ] Works on a phone (portrait): buttons tappable, no sideways scroll
- [ ] Loads in under 5 seconds (DevTools Network tab, "Fast 4G")
- [ ] No console errors (DevTools Console) during a full demo path
- [ ] `node tests/core.test.js` shows "All tests passed"

**Disqualification check**
- [ ] NASA data used and shown (DONKI cards + sources panel). Without it, Reliability is capped
- [ ] Challenge #07 selected on spaceappschallenge.org. Without it, Relevance is capped
- [ ] Only our own work presented; AI use disclosed (AI_USE.md); pre-hackathon section filled in
- [ ] All 4 members present at the pitch (anyone absent is not judged)
- [ ] "Submit for Judging" clicked before the pitch
- [ ] No NASA logo anywhere (repo, page, deck, video)
- [ ] No API key in the repo (`data/.env` is git-ignored)
