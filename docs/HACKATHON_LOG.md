# What we built: hackathon log

This file was generated from this repository's git history (`git log`), then grouped by hand.
Times are the commit times recorded by the committer's computer (UTC+4, Ganja local time).
Hackathon start: **14 Nov 2026, 11:10 (UTC+4)**.

## Before the hackathon (before 14 Nov 2026 11:10 UTC+4)

**Nothing in this repository.** The first commit is `4d8c8e4` at 14 Nov 16:08, *"Step 0: project setup … hackathon start"*.
No code, data, art or text in this repository was committed before the start.

**Not sure / please check (team):** git only shows what was committed here. If team members had ideas, sketches or notes
outside this repository before 11:10, list them here by hand so judges can see them separately. They earn no points.

The **public resources we used but did not make** (NASA data, three.js, the Mali font) are listed in
[DATA_SOURCES.md](../DATA_SOURCES.md). The AI assistant used is described in [AI_USE.md](../AI_USE.md).

## During the hackathon (from 14 Nov 2026 11:10 UTC+4)

### Features (short list)

- **Data:** a Python script fetches 3 real NASA DONKI storm weeks (solar flares, SEP, CME) and keeps the raw files; it also computes the Earth-Mars light delay and the Earth warnings.
- **Game core:** 10 sols, 5 power points split between Life Support, Greenhouse and Shield, plus an optional science mission; radiation dose from the real SEP events; a cause-chain "why did it fail" screen; ranks (Bronze/Silver/Gold).
- **Storybook UI for kids aged 7-12:** Rovi the robot, 4 crew faces, a Mars scene, stepping stones, a printable certificate, sound (off by default).
- **Message from Earth** with the real light delay, **science missions**, **mystery storm** (3 real weeks), a live **Sun today** panel with an archived fallback.
- **Optional 3D diorama** on real Gale crater terrain (NASA MOLA), with a 2D fallback.
- **Azerbaijani + English** for every text, with a font that has all the Azerbaijani letters.
- **Pre-quiz / post-quiz** and a teacher panel with all data sources; a local class results table with CSV export.
- **Demo mode** (`?demo=1`) for the live presentation.
- **Tests:** a core regression test and a balance check over all storm weeks.

### All commits

| Time (UTC+4) | Commit | What |
|---|---|---|
| 14 Nov 16:08 | `4d8c8e4` | Step 0: project setup (gitignore, env example) - hackathon start |
| 14 Nov 16:12 | `b3aec93` | Step 1: DONKI fetch script + cached May 2024 storm data (events.json/js, raw/) |
| 14 Nov 16:22 | `d9b8508` | Step 3: playable game (index.html), 4 systems, real storm replay, quiz, failure chain; extra NASA reference values |
| 14 Nov 16:29 | `3afc366` | Split core rules into src/game.js (read-only events for 3D), UI into src/ui.js; 4 system gauges; regression test; AI_USE.md |
| 14 Nov 16:29 | `783e441` | Add AI_USE.md running log |
| 14 Nov 16:40 | `bdfea4a` | README (requirement table, score map), SUBMISSION.md, SCORECARD.md, failure-chain screenshot |
| 14 Nov 16:40 | `23d4c1c` | Add SCORECARD.md |
| 14 Nov 16:40 | `c7c4abf` | GitHub Pages: serve files as-is (.nojekyll) |
| 14 Nov 16:43 | `cec361b` | Optional 3D view (visual only, local three.js r149, auto-fallback to 2D); docs updated |
| 14 Nov 16:57 | `ee891e7` | Kids 7-12: simpler text, 3-step intro, emoji systems, kid quiz/facts; realistic procedural 3D Mars (terrain, sky, low sun, astronaut, storm effects) |
| 14 Nov 16:58 | `6253471` | Docs: target audience 7-12, kid design notes, 3D visuals, test log |
| 14 Nov 16:58 | `0013e79` | Scorecard: correct timestamp |
| 14 Nov 16:58 | `6a31e47` | AI_USE: phone emulation test |
| 14 Nov 17:06 | `5b04199` | Design mockups A (cinematic), B (storybook), C (station HUD) for kids 7-12, with screenshots |
| 14 Nov 17:23 | `5c3524f` | Storybook UI (design B): Rovi + named crew with reacting faces, cartoon Mars scene with real-storm effects, stepping stones, certificate, Web Audio... |
| 14 Nov 17:58 | `80310a0` | Data: 3 real DONKI storm weeks (SEP, FLR notifications, CME) with raw files, Earth-Mars light delay, Earth warnings from DONKI links, Sun-today sna... |
| 14 Nov 17:58 | `9c715e0` | Core: mystery storm weeks, science missions (1 power point, +1 star) and Bronze/Silver/Gold rank, Earth warnings and next-sol advice, OSDR and ligh... |
| 14 Nov 17:58 | `a5d7b3f` | UI: Message from Earth with light-delay wave and Today/For tomorrow cards, science mission card, stars and rank, storm reveal, live 'Sun today' wit... |
| 14 Nov 17:58 | `93ad79e` | Tests: checks for science, ranks, advice, warnings and data matching for every week; balance check for all storm weeks |
| 14 Nov 17:58 | `a1b6a92` | Docs: DATA_SOURCES.md (datasets, game rules vs real data, balance results), README and AI_USE updates, feature screenshots |
| 14 Nov 18:04 | `de868c7` | Sources: replace secondary links with primary NASA sources (NASA pages, NASA-STD-3001 V1 4030/4031, SOMA Nature paper); trip time corrected to 7-10... |
| 14 Nov 18:04 | `c54e3c9` | DATA_SOURCES: clarify what VERIFY means now |
| 14 Nov 18:11 | `dd4df26` | 3D step 1: real Gale crater height map from NASA MOLA (64x64, 23 KB) + vendored three.js r149 (local, no CDN) |
| 14 Nov 18:17 | `87162f9` | 3D step 2: toon-shaded Mars base diorama on real Gale crater terrain; reads game state only; drag/zoom/pinch camera with limits + Reset view; click... |
| 14 Nov 18:22 | `eb2b621` | 3D step 3: storm pieces bounce off the dome at the real rule (measured 0.40/0.72/0.91), storm-day Earth text fix, rover + clickable rock in view, M... |
| 14 Nov 21:35 | `f532016` | Task 1: Azerbaijani + English (i18n): all UI text in locales/en.json + az.json (361 keys), AZ/EN switch with browser detection and saved choice, In... |
| 15 Nov 01:07 | `bb5cd43` | Phase A: visible 'AI-generated art' mark (top bar + certificate), English default with ?lang=az, cache live Sun Today 3 h (DEMO_KEY limit), MOXIE c... |

Later commits (this log and after it) are also during the hackathon: see `git log`.
