# Mars Storm Replay: Junior Astronaut Mission Trainer

NASA Space Apps Challenge 2026, Ganja. Challenge #07: *Build a Junior Astronaut Mission Trainer*.

**Play:** `https://<github-user>.github.io/<repo>/` (VERIFY: fill in after the GitHub Pages push)

Students command a Mars base for 10 sols. The 10 sols replay a **real solar storm**:
6 to 15 May 2024, active regions 13663/13664. The flares and proton events come from
NASA's DONKI database. Each sol, the player splits limited power between Life Support,
the Greenhouse and the Radiation Shield. One wrong decision can fail the mission, and the
end screen shows the exact chain of decisions that caused it.

**Who it is for:** students aged 12 to 16, in a classroom, in a 10 to 15 minute session.

**After playing, a student can explain** why a Mars crew must balance oxygen
(4 × 0.84 kg per sol) against storm shielding, and why the protons after a flare,
not the flare's light, are what raise their radiation dose.

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
| Presentation (15) | `SUBMISSION.md`: timed 5-minute script for 4 speakers, 2-minute demo path, fallback plan, Q&A answers |

---

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
| Run tests | `node tests/core.test.js` |

## Project structure

```
index.html              page layout and styles
src/game.js             MissionCore: all rules and state (no DOM). Others only read it.
src/ui.js               2D screens: quiz, sols, end screen, sources panel
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
3. The learning check exists, but it has not been run with a real class yet, so there are no measured results.

## Use of AI

See [AI_USE.md](AI_USE.md). No NASA logo or NASA branding is used in this project.
