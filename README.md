# Mars Storm Replay: Junior Astronaut Mission Trainer

NASA Space Apps Challenge 2026, Ganja. Challenge #07: *Build a Junior Astronaut Mission Trainer*.

**Play:** `https://<github-user>.github.io/<repo>/` (VERIFY: fill in after the GitHub Pages push)

Students command a Mars base for 10 sols. The 10 sols replay a **real solar storm**:
6 to 15 May 2024, active regions 13663/13664. The flares and proton events come from
NASA's DONKI database. Each sol, the player splits limited power between Life Support,
the Greenhouse and the Radiation Shield. One wrong decision can fail the mission, and the
end screen shows the exact chain of decisions that caused it.

**Who it is for:** children aged 7 to 12, in a classroom, in a 10 to 15 minute session.

**Designed for ages 7-12 (storybook style):** comic panels, big hand-drawn-style text and chunky buttons, short sentences (reading level about age 8), one idea per intro page and one quiz question per screen, and real terms in brackets the first time, for example "space storm (solar flare)". Rovi the robot says one short sentence each sol and changes face (happy, worried, scared, cheering). Four made-up astronauts (Aylin, Kofi, Mei, Leo) each look after one system and their faces react to it. Winning gives a printable Junior Astronaut certificate. Sound effects are made in code, with a mute button, and are off by default.

**After playing, a child can explain** that 4 astronauts need about 3.4 kg of oxygen a day
(4 × 0.84 kg), that the tiny fast particles after a space storm (protons), not its light,
are what is dangerous, and that more shield power means less air and food.

---

## Challenge #07 requirement → where in the game

VERIFY: compare each row with the official 2026 challenge text on spaceappschallenge.org.

| Requirement | Where it is | File |
|---|---|---|
| Mission trainer for junior astronauts | Intro screen, 10-sol mission, feedback after every sol | `index.html`, `src/ui.js` |
| Life Support (oxygen/water) | Gauge 1. Life Support power makes O2 (4 × 0.84 kg needed per sol) and sets water recycling (0 / 93 / 98 %) | `src/game.js` (`simulate`) |
| Energy | Gauge 2. Fixed 5 power units per sol, shared by all systems | `src/game.js` (`RULES.power`), `src/ui.js` (`renderGauges`) |
| Food | Gauge 3. Greenhouse power grows food, the crew eats 4 crew-days per sol | `src/game.js` (`simulate`) |
| Radiation Protection | Gauge 4. Shield power cuts the storm dose; baseline 0.64 mSv/sol always applies | `src/game.js` (`simulate`) |
| Systems depend on each other | Shielding takes power from oxygen and food; low Life Support power cuts both O2 and water | `src/game.js` (`RULES`, `simulate`) |
| A wrong decision can fail the mission | Hard fail if O2, water or food runs out, or the dose goes over 30 mSv. Shield 0 on Sol 8 alone fails the mission (tested) | `src/game.js` (`checkFail`), `tests/core.test.js` |
| The end screen explains why | Sol-by-sol cause-and-effect chain plus "what would have worked" | `src/game.js` (`buildChain`) |
| Uses NASA data | Live DONKI flare + SEP records drive every event card; published NASA values drive oxygen and baseline dose | `data/`, "NASA data sources" panel |
| Teaches real facts | One real fact per sol (formula + NASA value), "What you learned" recap with 3 facts, pre/post 3-question check | `src/game.js` (`pickFact`, `learned`, `QUIZ`) |

## Score map (how each judging criterion is covered)

| Criterion (points) | Evidence |
|---|---|
| Reliability / validity (30) | Live DONKI data cached in `data/events.json`. Every card links to its DONKI record and matches `data/raw/`. Every number is labeled live-fetched, published reference or game rule. Runs offline. Tests in `tests/core.test.js` |
| Relevance (20) | Exactly the 4 required systems, which depend on each other, plus a hard fail rule. Table above |
| Impact (20) | Target user stated. One fact per decision, a 3-fact recap, and a pre/post learning check shown on screen. No measured results are claimed yet |
| Creativity (15) | One signature mechanic: the real storm replay (sol N = a real date from the NASA record), plus the cause-and-effect failure chain |
| Presentation (15) | [`docs/PITCH.md`](docs/PITCH.md) (5-minute script, judge answers), [`SUBMISSION_FORM.md`](SUBMISSION_FORM.md) (form text, video storyboard, 7-slide outline), demo mode `?demo=1` |

---

## Visuals

All pictures are cartoon SVG drawn in code (`src/art.js`, `src/story.css`): layered Mars hills, rocks and craters, a base that glows when the crew is fine and dims when it is in trouble, solar panels that light up with the power in use, a greenhouse whose plants grow with the food store, and a shield dome. On real proton days the sky turns red, dust blows, proton streaks fall, the Sun turns angry and spiky with a ZAP burst, and the shield glows. The pictures only read the game state; they never change the rules.

**AI-made visuals:** every picture (Rovi, the astronauts, the Mars scene, the certificate) was drawn in code by an AI assistant (Claude). No photos, no image files and no NASA logos are used. The optional 3D view (three.js r149, local) shows the base on real NASA MOLA terrain of Gale crater and falls back to 2D. A visible "🤖 AI-generated art" mark is in the top bar of every screen and on the certificate.

## NASA data

| Value | Type | Source |
|---|---|---|
| 24 solar flares (M5.0+), 6 to 15 May 2024 | live-fetched | `https://api.nasa.gov/DONKI/notifications?type=FLR` (47 messages, full reports parsed) |
| 14 solar energetic particle (SEP) records | live-fetched | `https://api.nasa.gov/DONKI/SEP` |
| 0.64 mSv/day on the Mars surface | published reference | Hassler et al. 2014, *Science* 343, Curiosity RAD |
| 0.84 kg O2 per crew member per day | published reference | NASA BVAD (VERIFY table and revision) |
| 98 % ISS water recovery (93-94 % before) | published reference | NASA, June 2023 (VERIFY URL) |
| 600 mSv career limit, 250 mSv per SEP event | published reference | NASA-STD-3001 Vol. 1 (VERIFY revision) |
| about 8,100 micrograys, Curiosity, 20 May 2024 | published reference | NASA/JPL, June 2024 (VERIFY URL) |

All other numbers (power units, start reserves, shield percentages, the 30 mSv drill limit,
4 mSv per SEP record) are **game rules**. They are listed in the game's sources panel and
are not NASA data.

**Honest notes**
- The DONKI `FLR` endpoint returned HTTP 404 on 14 Nov 2026 (other DONKI endpoints worked).
  The script still tries it first, then reads the same flare reports from DONKI
  notifications. The fallback and its reason are stored in `events.json`.
- Flares are observed by GOES from Earth's side of the Sun. Flare class is X-ray brightness
  at Earth, not dose at Mars. The game uses proton (SEP) records for dose and flare class only as context.
- earthaccess was not used: NASA Earthdata holds Earth-observation data, and no dataset there
  fits Mars radiation or life support.

## Run it

| What | How |
|---|---|
| Play offline | Double-click `index.html` (no server, no install) |
| Re-fetch NASA data | Put your key from api.nasa.gov in `data/.env` (see `data/.env.example`), then run `python data/fetch_nasa_data.py` (Python 3.9+, standard library only) |
| Print one raw API record | `python data/fetch_nasa_data.py --raw` |
| Run tests | `node tests/core.test.js` and `node tests/balance.js` |
| Demo mode (presenter bar) | open `index.html?demo=1` |
| Azerbaijani | press "🌐 Azərbaycanca" in the top bar, or open `index.html?lang=az` |

## Project structure

```
index.html              page layout and styles
src/game.js             MissionCore: all rules and state (no DOM). Others only read it.
src/ui.js               2D screens: quiz, sols, end screen, sources panel
src/story.css           storybook look (comic panels, colours, print style for the certificate)
src/art.js              all pictures as SVG drawn in code (Rovi, astronauts, Mars scene) - AI-made
src/sound.js            small sound effects made with Web Audio (no files), off by default
src/i18n.js             English / Azerbaijani text (locales/*.json -> locales/locales.js)
src/demo.js             presenter bar, only with ?demo=1
src/scene3d.js          optional 3D diorama (vendor/three.min.js, data/gale_heightmap.js)
design/                 the 3 design mockups (A, B, C); B was chosen
data/fetch_nasa_data.py fetches DONKI, writes the cache below
data/events.json|.js    cached NASA data (.js is loaded by the page, so it works offline)
data/raw/               unchanged API responses, to check any card against
tests/core.test.js      regression tests for the core
docs/                   screenshots
AI_USE.md               how AI was used, what humans tested
```

## Limitations and next steps

1. The storm dose is a game proxy (4 mSv per SEP record), not a physics model. Next: drive it from real Curiosity RAD dose data.
2. The flare geometry is Earth-based; Mars' position relative to the Sun is not modeled.
3. The learning check exists and the teacher panel now stores results (this browser only, CSV export), but it has not been run with a real class yet, so there are no measured results.
4. "Sun today" uses NASA's shared DEMO_KEY (a few calls per hour per network). When the limit is reached it shows the archived copy, labelled as archived.
5. Levels and a guided training round are not built yet; each game is a random real storm week.

## Use of AI

See [AI_USE.md](AI_USE.md). No NASA logo or NASA branding is used in this project.

## New in this version (3d branch)

- **Submission texts:** [SUBMISSION_FORM.md](SUBMISSION_FORM.md), [docs/PITCH.md](docs/PITCH.md), [docs/demo-subtitles.srt](docs/demo-subtitles.srt), [docs/HACKATHON_LOG.md](docs/HACKATHON_LOG.md) (built before vs during the hackathon).
- **Demo mode** (`?demo=1`): presenter bar that replays valid plans on the real May 2024 week (calm day, Earth warning, sol 8 with shield 0 vs 3, Gold win, loss chain, Sun today). Demo games are not saved.
- **Class results:** each finished game (date, storm week, rank, quiz before/after; no names) is stored in this browser; the teacher panel shows the average and exports CSV.
- **English + Azerbaijani** (`locales/`), Mali font (OFL) with all Azerbaijani letters.

- **Mystery storm:** each game picks one of 3 real DONKI storm weeks (May 2024, Sep-Oct 2022, Nov 2025). The date stays secret until the end screen reveals it.
- **Message from Earth:** a radio wave fills up, labeled with the real Earth-Mars light delay for that week (6.6 to 20.1 minutes). "Today" and "For tomorrow" cards show Earth's warnings, based on the flares and CMEs DONKI links to each proton storm. Most real warnings came too late, and the game says so. "Ask Earth for advice" answers only on the next sol.
- **Science missions:** on calm sols there is an optional real rover activity (Ingenuity, MOXIE, Curiosity clouds, rock samples, RAD, weather). It uses 1 of the 5 power points and earns 1 ⭐. End rank: Bronze / Silver (3 ⭐) / Gold (5 ⭐), also shown on the certificate.
- **The Sun today:** the final screen asks NASA DONKI live for the last 7 days. If that fails, it shows a saved snapshot clearly labeled "archived data, not live".
- **Astronaut health fact** from NASA OSDR (Inspiration4 / SOMA).
- Tests: `node tests/core.test.js` (rules + data matching) and `node tests/balance.js` (every storm week: the never-changing plan loses, a plan wins, Gold is reachable but rare).
- Full list of datasets, and of game rules vs real measurements: **[DATA_SOURCES.md](DATA_SOURCES.md)**.
