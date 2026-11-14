# Submission form: ready-to-paste English text

Space Apps 2026, Ganja. Challenge #07: *Build a Junior Astronaut Mission Trainer*.
Paste each block into the matching field on spaceappschallenge.org. Check each field's length limit on the form.
**Click "Submit for Judging" before 09:00.** Everything in `[brackets]` must be filled in by the team.

---

## Project Name

Mars Storm Replay

## High-Level Summary

*(about 115 words)*

Mars Storm Replay is a browser game that trains junior astronauts aged 7 to 12. Players keep four astronauts safe on a Mars base for 10 sols. Each sol replays a real day of a solar storm recorded in NASA's DONKI database. Every sol, players split 5 power points between Life Support, the Greenhouse and a radiation Shield. Calm days are for saving air and food and for science. Proton storm days need the shield. If the crew is lost, the game shows the chain of the player's own choices that caused it. A 3-question quiz before and after play measures what each child learned, and a teacher panel shows the class average. It runs offline, in English and Azerbaijani.

## Project Demo

**Option A: 30-second video with English subtitles.** Subtitles are in `docs/demo-subtitles.srt`. Record with `index.html?demo=1` at 1280×800 and use the presenter bar for each shot.

| # | Time | Shot (what is on screen) | Presenter-bar button | Subtitle |
|---|---|---|---|---|
| 1 | 0-5 s | Sol 1, calm day. The power cards: put the extra power into air and food, plus a science mission | a) Sol 1 calm | "A calm day on Mars. Save extra air and food while the Sun is quiet." |
| 2 | 5-10 s | Sol 4: the "Message from Earth" panel with the light-delay wave and the warning card | b) Earth warning (sol 4) | "Earth sees a blast on the Sun. The warning takes 16 minutes to reach Mars." |
| 3 | 10-15 s | Sol 8, shield 0: red sky, proton streaks, the report says 24.0 mSv today, mission fails | c) Sol 8 · shield 0 | "Real proton storm, May 2024. Shield at 0: the crew gets 24 mSv in one day." |
| 4 | 15-20 s | Sol 8, shield 3: the 3D dome, storm pieces bouncing off (counter "9 of every 10"), 2.4 mSv | c) Sol 8 · shield 3 | "Shield at 3 blocks 9 of every 10 storm pieces. Only 2.4 mSv." |
| 5 | 20-25 s | Win screen: Gold rank, crew cheering, "The secret storm was 6 to 15 May 2024" | d) Win · Gold | "All 4 astronauts are safe. The secret storm was real: 6 to 15 May 2024." |
| 6 | 25-30 s | The "Sun today" panel on the end screen (NASA data from the last 7 days) | f) Sun today | "And the Sun today? Live NASA DONKI data. Mars Storm Replay." |

**Option B: 7-slide deck (backup).**

1. **Mars Storm Replay.** Team: [team name]. Members: [Name 1], [Name 2], [Name 3], [Name 4]. NASA Space Apps 2026, Ganja. Challenge #07: Build a Junior Astronaut Mission Trainer.
2. **The problem.** Space radiation is one of the biggest dangers on a trip to Mars. Kids hear "radiation" but never feel what a trade-off is: power spent on the shield is not spent on air or food.
3. **Our answer.** A 10-sol mission for ages 7-12. 5 power points a day, 3 systems, 1 optional science mission. Rovi the robot and 4 astronauts react to every choice.
4. **Real NASA data.** Each sol is one real day from NASA DONKI (flares, proton events, blasts): 3 real storm weeks (Sep 2022, May 2024, Nov 2025). Earth warnings arrive with the real light delay. The ground in 3D is real MOLA height data of Gale crater.
5. **Learning you can measure.** A 3-question quiz before and after play. The teacher panel shows each game and the class average (before → after) and exports CSV. No names are stored.
6. **Demo** (screenshots or live): calm day → Earth warning → storm with shield 0 vs 3 → Gold win → "Sun today".
7. **What's next.** More storm weeks, teacher lesson plans, testing with real classes in Ganja. Links: [game link] · [GitHub link].

## Final Project

- Play: `[https://<github-user>.github.io/<repo>/]` (test it in a private window first)
- Demo mode for judges: `[https://<github-user>.github.io/<repo>/?demo=1]`
- Azerbaijani: `[https://<github-user>.github.io/<repo>/?lang=az]`
- Code: `[https://github.com/<github-user>/<repo>]`

## Detailed Description

**What it does.** Mars Storm Replay is a 10-sol mission on a Mars base for children aged 7 to 12. Every sol, the player splits 5 power points between Life Support (oxygen and water recycling), the Greenhouse (food) and the radiation Shield. Each system takes 0 to 3 points, so you can never max out everything. On calm days, an optional science mission costs 1 point and earns a star. These are real rover activities: Ingenuity flights, MOXIE oxygen, Curiosity's RAD, cloud photos and sample tubes. Stars decide the rank: Bronze, Silver or Gold. Each sol replays one real day of a solar storm. Flares and proton (SEP) events come from NASA DONKI. On proton days, radiation hits the base unless the shield is up. A "Message from Earth" arrives with the real Earth-Mars light delay. Sometimes it is too late, because some protons arrive less than an hour after a blast. The mission fails if oxygen, water or food runs out or the dose goes over the game's 30 mSv drill limit. The end screen then shows a cause chain built from the player's own choices, plus a tip. A winner can print a Junior Astronaut certificate. The storm week is a secret until the end ("Mystery storm").

**Learning and measurement.** The game has a 3-question quiz before play and the same quiz after. Each finished game is stored only in that browser: date, storm week, rank, quiz before, quiz after, no names. The teacher panel shows the class table and the average score before → after, with "Export CSV" and "Reset data" buttons.

**How it works.** A Python script (standard library only) calls NASA's DONKI API. It saves the raw answers and builds `data/events.js`. The game is plain HTML, CSS and JavaScript with no build step and no server, so it also runs from a USB stick without internet. All rules live in one file (`src/game.js`), and the screens only read its state. An optional 3D view (three.js) shows the base on real MOLA height data of Gale crater. It falls back to 2D on weak devices, and phones start in 2D. All text is in English and Azerbaijani (`locales/`). Automated tests check the game outcomes, that every event card matches a raw DONKI record, and that both languages are complete. A balance script searches all plans to prove that each storm week can be won and that the default plan loses.

**Tools and libraries.** HTML, CSS, JavaScript, Python 3, NASA DONKI API, three.js r149 (MIT licence, stored locally), the Mali font (SIL Open Font License 1.1, stored locally), GitHub Pages, and Claude Code (AI coding assistant, see "Use of AI").

**Game rules vs real measurements.** Every number in the game is labelled in the teacher panel as one of three kinds: live-fetched NASA data, a published NASA reference value, or a game rule. Real: the dates, flares and proton events of each sol, the light delay, 0.84 kg of oxygen per astronaut per day, 0.64 mSv per day on Mars (Curiosity RAD), 98 % ISS water recovery, and the Curiosity storm measurement of 20 May 2024. Game rules (simplified so kids can play): 5 power points, 4 mSv per proton record without a shield, the shield blocking 40 %, 70 % or 90 % at levels 1 to 3, and the 30 mSv drill limit. NASA's real limits are 600 mSv for a career and 250 mSv for one event (NASA-STD-3001), and the game says so.

## NASA Data

- **DONKI notifications, type=FLR** (api.nasa.gov): the solar flare reports for each storm week, with class, peak time, region and a link to the record. There are 24 flare cards for May 2024, 3 for Sep-Oct 2022 and 4 for Nov 2025. The DONKI FLR endpoint itself returned HTTP 404 when we fetched, so we used the notifications endpoint for the same reports and say so in the game.
- **DONKI SEP** (solar energetic particle events): 14 records for May 2024, 13 for Sep-Oct 2022 and 23 for Nov 2025. Each record raises that sol's radiation in the game.
- **DONKI CME** (coronal mass ejections): 60, 38 and 64 records. DONKI links SEP events to the flares or CMEs that caused them. We use those links to decide whether Earth's warning arrives in time or too late.
- **DONKI live ("Sun today")**: the end screen asks DONKI for the last 7 days of flare reports and SEP events. If that fails, it shows a saved copy that is clearly labelled "ARCHIVED".
- **Curiosity RAD**: 0.64 mSv per day on the Mars surface (Hassler et al. 2014, *Science*), and about 8,100 micrograys on 20 May 2024 (NASA, 10 Jun 2024).
- **NASA life support constants**: 0.84 kg of oxygen per astronaut per day (NASA BVAD, NASA/TP-2015-218570), and 98 % water recovery on the ISS (NASA, 2023).
- **NASA-STD-3001 Vol. 1**: the 600 mSv career and 250 mSv per-event radiation limits.
- **NASA OSDR / SOMA**: Inspiration4 crew data showing that more than 95 % of the measured markers went back to normal within months (Overbey et al. 2024).
- **NASA MOLA** (Mars Global Surveyor, PDS Geosciences Node): the height map of Gale crater under the 3D base.
- **NASA JPL**: the planet orbit elements used to compute the Earth-Mars light delay for each storm week, and the mission facts on the science cards (Ingenuity, MOXIE, Curiosity, Perseverance).

Full list with links: `DATA_SOURCES.md` in the repository.

## Partner & Other Data

- **three.js r149**, MIT licence: the optional 3D view (stored in `vendor/`).
- **Mali font** (© 2018 The Mali Project Authors, github.com/cadsondemak/Mali), SIL Open Font License 1.1: it has all the Azerbaijani letters. The licence is in `fonts/OFL-Mali.txt`.
- **Images:** no photos and no image files. All pictures (Rovi, the astronauts, the Mars scene, the certificate, the 3D models) were drawn in code by an AI assistant (Claude). The game shows a visible "🤖 AI-generated art" mark in the top bar and on the certificate.
- **Sounds:** generated in the browser with Web Audio, with no sound files.
- No partner space agency data is used.

## Use of AI

We used Claude (Anthropic), through Claude Code, as a coding assistant. It wrote most of the code, the tests and drafts of the documents (including this text), following our design decisions and instructions. The team chose the concept, the audience, the storm weeks and the game rules. We reviewed the results, played the game and decided what to keep. All NASA numbers come from the DONKI API or from cited NASA sources, never from the AI. Each one is labelled in the game's teacher panel.

**AI-generated assets:** all pictures in the game (SVG and three.js drawings made in code by Claude). They carry a visible "🤖 AI-generated art" mark in the top bar of every screen and on the certificate. No AI-generated photos or video are used. If the demo video is a screen recording of the game, the mark is visible in every frame. A full log is in `AI_USE.md`.
