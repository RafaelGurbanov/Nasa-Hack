# Scorecard (honest self-assessment)

Updated: 14 Nov 2026, about 17:00 (+04:00), on the `3d` branch, after the change of target
audience to ages 7-12. Before the GitHub Pages push and before any human playtest. Each criterion is scored 1-5, weighted as points = score / 5 × weight.

| Criterion | Weight | Score now | Points | Score after the cheapest fix |
|---|---|---|---|---|
| Reliability / validity | 30 | 4 | 24 | 5 (public link + human test) |
| Relevance | 20 | 4 | 16 | 5 (challenge selected + requirement table checked against official text) |
| Impact | 20 | 4 | 16 | 4 (5 needs measured results we do not have) |
| Creativity | 15 | 4 | 12 | 4-5 |
| Presentation | 15 | 3 | 9 | 4-5 (one timed rehearsal) |
| **Total** | 100 | | **77** | about 88-92 |

## 1. Reliability / validity: 4/5

Evidence
- Real NASA data, live-fetched: `data/fetch_nasa_data.py:261` (`build`) gets DONKI notifications (type=FLR) and SEP. Output `data/events.json` holds 24 flares and 14 SEP records, with endpoint, HTTP status, rate limit and `fetched_at` in its `sources` block.
- Every card can be traced: `node tests/core.test.js` passes "all 24 flare cards match a raw DONKI record" (`data/raw/notifications_flr.json`).
- Published constants drive formulas: `src/game.js:21-22` (O2 need = 4 × 0.84; baseline 0.64 mSv), read from `events.json`, not hard-coded.
- Robust fetch: retries 429/5xx/timeouts and logs rate limit headers (`data/fetch_nasa_data.py:127`); a labeled sample is written only if there is no cache (`:367`); DEMO_KEY is refused.
- Runs start to end offline (`file://`) with 0 console messages (Chrome DevTools run, 14 Nov). Screenshots: `docs/screenshot-sol5.png`, `docs/screenshot-failure-chain.png`.
- Labels: sources panel `src/ui.js:217` marks every value as live-fetched, reference or game rule.

Why not 5 yet: there is no public link yet, no human has played it, and 4 reference values are still marked VERIFY.
**Cheapest raise:** push to GitHub Pages, open the link in incognito, and have one member play once and log it in `AI_USE.md`.

## 2. Relevance: 4/5

Evidence
- The 4 required systems as gauges: `src/ui.js:93` (`renderGauges`): Life Support (oxygen/water), Energy, Food, Radiation Protection.
- They depend on each other: shared power `src/game.js:23` (`RULES`), `simulate` at `:86`.
- Hard fail: `checkFail` `src/game.js:107`. One wrong decision fails (test "shield 0 on sol 8").
- Requirement table: `README.md`.

Why not 5 yet: the table has not been checked against the official 2026 challenge text, and the challenge is not yet selected on the site.
**Cheapest raise:** select Challenge #07 on spaceappschallenge.org and compare the table with the official text (10 min).

## 3. Impact: 4/5

Evidence
- Target user stated: README, intro screen (`index.html`).
- One fact per decision with formula + NASA value: `pickFact` `src/game.js:116`.
- "What you learned", 3 facts: `learned` `src/game.js:167`.
- Measurable check: same 3 questions before and after, result shown on screen: `QUIZ` `src/game.js:60`, `showResults` `src/ui.js:201`. Nothing is stored.
- One-sentence outcome: "After playing, a child can explain that 4 astronauts need about 3.4 kg of oxygen a day (4 × 0.84 kg), that the tiny fast particles after a space storm (protons), not its light, are the danger, and that more shield power means less air and food."
- Designed for ages 7-12: big text and buttons, emoji icons, short sentences, one idea per intro card, friendly feedback, real term in brackets (`index.html`, `src/ui.js`). Screenshot: `docs/screenshot-kid-ui.png`.
- Quiz and facts rewritten for ages 7-12 using the same NASA values (`src/game.js` `QUIZ`, `pickFact`, `learned`).

Why not 5: no real users have been measured. We will not claim results we do not have.
**Cheapest raise:** let 2-3 people at the venue play and note their before/after scores as an "informal hallway test (n=3)", clearly labeled.

## 4. Creativity: 4/5

Evidence
- Signature mechanic: real storm replay. Sol N = a real date (`data/events.json` `sols[]`), with a timeline of real max flare class and proton days (`src/ui.js` `renderTimeline`).
- Cause-and-effect failure chain from the player's own decisions: `buildChain` `src/game.js:137`; screenshot `docs/screenshot-failure-chain.png`.
- No other novelty features were added (scope rule kept).

Why not 5: mission-planning trainers exist; what makes ours different is the real-data replay. Judges need to see it in the first 30 s of the demo.
**Cheapest raise:** open the pitch with the real timeline (X flares + "P" days) and the 20 May 2024 Curiosity fact.

## 5. Presentation: 3/5

Evidence
- `SUBMISSION.md`: timed 5-minute script with all 4 members, a tested 2-minute demo path (`tests/core.test.js`, "demo path wins"), a fallback plan, prepared answers to the 3 mandatory questions, a 7-slide outline and a 30-second storyboard.

Why not higher: not rehearsed yet; the video/deck is not made yet.
**Cheapest raise:** one full timed rehearsal before 06:00 with each speaker holding their own section.

Visual support for the demo: the 3D Mars base (`src/scene3d.js`) shows calm vs storm days clearly (`docs/screenshot-3d-calm.png`, `docs/screenshot-3d-storm.png`). It is visual only and falls back to 2D (tested).

## Risks that could lower the score

| Risk | Effect | Mitigation |
|---|---|---|
| "Submit for Judging" not clicked before the pitch | not judged | Member 4 owns it, deadline 08:30 |
| Demo or video over its limit | cut off / cannot go global | rehearse with a timer; video ≤ 30 s |
| 3D view breaks the page | Reliability drops | 3D is optional, in a separate file, with automatic fallback to 2D (tested: three.js removed → 2D wins) |
| Audience changed late (7-12) | Impact claims out of date | all docs updated on the `3d` branch; merge to `main` only after a human test |
| Judge asks about the storm-dose proxy | credibility | answer is ready (SUBMISSION.md, Q3 item 1) |
