# Data sources (for judges and teachers)

Mars Storm Replay uses real NASA data wherever a number describes the real world, and clearly
labeled **game rules** where we had to simplify so 7-12 year olds can play. Nothing here is invented:
every event, date and flare class comes from a NASA record, and the game's "For teachers" panel
shows the same labels. Items still marked **VERIFY** could not be confirmed in the primary NASA
document itself (the reason is given next to each one).

## 1. Live-fetched NASA data (cached in `data/events.json`, raw responses in `data/raw/<week>/`)

Fetched by `data/fetch_nasa_data.py` from **api.nasa.gov (NASA DONKI, the Space Weather Database
Of Notifications, Knowledge, Information, run by NASA CCMC)** with a personal API key on 14 Nov 2026.

| Dataset (endpoint) | What we use | Why we chose it |
|---|---|---|
| DONKI **SEP** (`/DONKI/SEP`) | Every solar energetic particle (proton) record in each storm week: time, instrument, links | Protons, not flare light, are what raise astronauts' radiation dose. SEP records decide which sols are storm days. |
| DONKI **notifications, type=FLR** (`/DONKI/notifications`) | Full flare reports: start/peak time, class (M/X), source region | Flare classes and times for the event cards. The structured `/DONKI/FLR` endpoint returned **HTTP 404** for every request on 14 Nov 2026, so we use DONKI's own flare notifications. This is recorded in `events.json`. Notifications only report flares of about **M5 and above**. |
| DONKI **CME** (`/DONKI/CME`) | Coronal mass ejection (CME, a huge cloud of Sun material) records, from 3 days before each week | Some proton storms are linked by DONKI to a CME instead of a flare. Used for Earth's warnings. |
| DONKI notifications + SEP, **last 7 days** (live, in the browser) | "The Sun today" panel on the final screen | Links the game to today's real space weather. Called live with `DEMO_KEY`. If the call fails, the game shows a snapshot saved at build time and labels it **"archived data, not live"**. |

### The three real storm weeks ("Mystery Storm")

Chosen from a survey of all DONKI SEP records in 2012, 2013, 2014, 2015, 2017 and 2021-2025.

| Week | Proton (SEP) records per sol 1-10 | Total | Flare reports | Earth-Mars light delay (mid-week) |
|---|---|---|---|---|
| 6-15 May 2024 | 0 0 0 2 4 2 0 6 0 0 | 14 | 24 | 16.1 min (1.94 AU) |
| 25 Sep - 4 Oct 2022 | 0 0 0 0 0 0 4 7 0 2 | 13 | 3 | 6.6 min (0.79 AU) |
| 6-15 Nov 2025 | 0 0 0 0 7 8 1 0 5 2 | 23 | 4 | 20.1 min (2.42 AU) |

**Not used: September 2017.** It is in DONKI, and the 10 Sep 2017 event reached Mars. But the best
10-day window (4-13 Sep 2017) has only **9** SEP records. With the fixed game rule, the never-changing
plan would end at 28.0 mSv and survive, which breaks the balance requirement. It can be added if the
team accepts that, or if the rule changes.

### Earth's warnings (communication delay)

For every storm sol, the game looks at the flares and CMEs that **DONKI itself links** to that sol's
SEP records and takes the earliest one.
- If that blast happened on an **earlier day**, Earth's warning arrives the sol before ("For tomorrow").
- If it happened on the **same day** as the particles, the game says the warning came **too late** ("Today").

Result: most real warnings were too late. That is the honest finding, and it is part of what the game
teaches. When a linked flare has no class in the data we can reach (for example
`2024-05-08T04:20:00-FLR-001`, which is below the M5 notification threshold), the game says "a solar
flare" without a class. A free-text note in the linked DONKI CME record calls it an "initial M3.5",
but we do not parse free text.

### Earth-Mars light delay

Computed in `data/fetch_nasa_data.py` from **NASA JPL "Keplerian Elements for Approximate Positions of
the Major Planets" (E. M. Standish, Table 1, 1800-2050)**. It was checked against two known dates:
0.385 AU at the 31 Jul 2018 close approach, and 2.66 AU at the 27 Jul 2017 conjunction (about 2.67
expected). The delay = distance ÷ speed of light. Real one-way delays range from about 3 to 22 minutes.

## 2. Published reference values (not fetched; each has a source)

| Value | Used for | Source |
|---|---|---|
| **0.64 mSv/day** on the Mars surface | Everyday radiation each sol | **Curiosity RAD**: Hassler et al. 2014, *Science* 343(6169) |
| about **8,100 micrograys**, 20 May 2024 | Storm fact | NASA, ["NASA Watches Mars Light Up During Epic Solar Storm"](https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/), 10 Jun 2024 (Curiosity RAD) |
| **0.84 kg O2** per astronaut per day | Oxygen math (4 × 0.84 = 3.36 kg) | **NASA life support constants**: BVAD, NASA/TP-2015-218570 (REV2 2022), as cited with 0.84 kg in NASA [ICES-2017-87](https://ntrs.nasa.gov/api/citations/20170010337/downloads/20170010337.pdf) (p. 31) and [Jones 2023](https://ntrs.nasa.gov/api/citations/20230013555/downloads/Take%20or%20Make%20in%20space.pdf). **VERIFY**: the BVAD table itself was not opened, and one NASA table ([NTRS 20150003005](https://ntrs.nasa.gov/api/citations/20150003005/downloads/20150003005.pdf)) lists 0.82 kg |
| **98 %** ISS water recovery (93-94 % before) | Water recycling levels | NASA, ["NASA Achieves Water Recovery Milestone on International Space Station"](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/), 20 Jun 2023 |
| **600 mSv** career limit, **250 mSv** per SEP event | Safety-limit fact | [NASA-STD-3001 Vol. 1](https://standards.nasa.gov/sites/default/files/standards/NASA/C/nasa-std-3001-vol-1-rev-c-signature.pdf), requirements [V1 4030] and [V1 4031]; same values in Rev B (2022) and Rev C |
| **7 to 10 months** Earth to Mars | "Why no instant help" fact | NASA, ["How Long Does it Take to Get to the Moon... Mars... Jupiter?"](https://www.nasa.gov/directorates/smd/how-long-does-it-take-to-get-to-the-moon-mars-jupiter-we-asked-a-nasa-expert-episode-51/) ("seven to ten months … relatively direct route") |
| Inspiration4: **more than 95 %** of measured markers back to baseline within months | Astronaut health fact | Overbey et al. 2024, ["The Space Omics and Medical Atlas (SOMA) and international astronaut biobank"](https://pmc.ncbi.nlm.nih.gov/articles/PMC11357981/), *Nature* 632:1145-1154, doi:10.1038/s41586-024-07639-y. Data in **NASA OSDR**, e.g. OSD-572, OSD-573, OSD-574, OSD-630 ([NASA OSDR news](https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/)). **VERIFY**: the full OSDR ID list is in the paper's Supplementary Table 9, which we could not open |
| Ingenuity: 72 flights, first on 19 Apr 2021 | Science card | NASA JPL Ingenuity flight log |
| MOXIE: 122 g of oxygen from Mars air | Science card | NASA, 6 Sep 2023 |
| Curiosity: first clear sun rays through Martian clouds, 2 Feb 2023 | Science card | NASA JPL, March 2023 |
| Perseverance seals rock cores in tubes; Curiosity RAD since 2012; Curiosity REMS weather station | Science cards | NASA Mars 2020 and MSL mission pages |

## 3. Game rules (simplifications, NOT measurements)

| Rule | Value |
|---|---|
| Power per sol | 5 points, each system 0-3, total ≤ 5 |
| Life Support | each level makes half of the crew's daily oxygen; level 2 = exactly enough |
| Water recycling by Life Support level | 0 % / 93 % / 98 % / 98 % (the ISS values reused as levels) |
| Food | "food packs" (1 pack = 1 astronaut for 1 day); greenhouse level 2 = exactly enough |
| Starting reserves | oxygen for 3 sols, food for 3 sols, water tank 100 % |
| Storm dose | **4 mSv per DONKI SEP record** on that sol if unshielded. This is a teaching proxy, not a dose model. |
| Shield | levels 1/2/3 block 40 / 70 / 90 % of the storm dose (not the everyday dose) |
| Dose limit | **30 mSv** for this 10-sol drill (far below NASA's real 600 mSv career limit) |
| Sol = date | 1 sol = 1 UTC date of the storm week (a real sol is 24 h 39 min) |
| Science mission | calm sols only; uses 1 of the 5 power points; +1 ⭐ |
| Rank | survived = Bronze, 3+ ⭐ = Silver, 5+ ⭐ = Gold |
| Ask Earth | the answer arrives the next sol, based on how the base looked when you asked |
| Characters | Rovi the robot and the astronauts Aylin, Kofi, Mei and Leo are made up |

## 4. Balance check (`node tests/balance.js`)

| Week | Never-changing plan (2/2/1) | Can a plan win? | Best possible stars | Random players using all 5 points: win / Gold |
|---|---|---|---|---|
| May 2024 | loses on sol 8 (38.7 mSv) | yes | 6 (Gold) | 16.8 % / 0.56 % |
| Sep-Oct 2022 | loses on sol 8 (31.5 mSv) | yes | 7 (Gold) | 19.2 % / 2.21 % |
| Nov 2025 | loses on sol 6 (39.8 mSv) | yes | 5 (Gold) | 3.0 % / 0.00 % |

The search tries every allowed power split on every sol, merging identical states. "Hard" here means
fewer than 10 % of random full-power players reach Gold.

## 5. What is NOT NASA data

- All pictures are drawn in code by an AI assistant (Claude); see `AI_USE.md`. There are no photos, image files or NASA logos.
- Sounds are generated by code (Web Audio). There are no audio files.

## 6. 3D view terrain (Gale crater)

- **Data:** NASA Mars Global Surveyor **MOLA** Mission Experiment Gridded Data Record, 16 px/degree (`MGS-M-MOLA-5-MEGDR-L3-V1.0`), from the [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/). Producer per the official label: MGS MOLA Science Team (D. E. Smith, NASA Goddard Space Flight Center).
- **Credit line used in the game:** "Ground: real NASA MOLA height data of Gale crater, where Curiosity landed (heights ×3)."
- **Processing:** `data/build_gale_heightmap.py` cuts 64 × 64 samples (about 4° × 4°) around Gale crater, giving `data/gale_heightmap.js` (23 KB). Check: the Curiosity landing site reads −4509 m (NASA gives about −4501 m).
- **Game rules (not measurements):** heights ×3 so kids can see the crater, and a flat pad around the base.
- **Licence:** NASA PDS data are generally free to use (VERIFY: no explicit licence text in the label). Not HiRISE / UArizona: HiRISE height models only cover small strips, so MOLA was used for the whole crater.
