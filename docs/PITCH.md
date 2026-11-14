# Pitch: 5 minutes + 3 minutes of questions

Open `index.html?demo=1` on the laptop **before** going on stage (1280×800 or bigger, sound off).
The presenter bar at the bottom has the buttons a) to f). Keep a second tab open with `?demo=1&lang=az` only if you want to show the Azerbaijani version.
If the projector or the internet fails, the game still works from the file (no internet needed). "Sun today" then shows the archived data with a clear label.

| Time | Who | Part |
|---|---|---|
| 0:00-0:40 | [Name 4] | Problem |
| 0:40-1:20 | [Name 2] | Solution |
| 1:20-3:50 | [Name 1] | Live demo (demo mode) |
| 3:50-4:30 | [Name 3] | NASA data |
| 4:30-5:00 | [Name 4] | Impact + next steps |

## 0:00-0:40 · Problem

"In May 2024, the Sun threw its strongest storm at Earth in more than 20 years. A few days later, a storm from the same region reached Mars. NASA's Curiosity rover measured about 8,100 micrograys on the ground, roughly 30 chest X-rays. Future astronauts on Mars will have to make choices with limited power: air, food, or a shield? Kids in our schools hear the word 'radiation', but they never feel a trade-off like that. Challenge #07 asks for a junior astronaut mission trainer. We built one."

## 0:40-1:20 · Solution

"Mars Storm Replay is a browser game for ages 7 to 12. You keep 4 astronauts safe for 10 sols. Every sol you have 5 power points for Life Support, the Greenhouse and the Shield. You can never max out everything. The twist: every sol is a real day from NASA's space weather database, and you don't know which storm it is until the end. If you lose, the game shows you exactly which of your choices caused it. It works offline, on a phone or a laptop, in English and Azerbaijani."

## 1:20-3:50 · Live demo (2:30)

1. **a) Sol 1 calm** (25 s): "A calm day. Rovi says: save extra air and food. And a science mission: these are real rover activities, like MOXIE making oxygen on Mars."
2. **b) Earth warning** (30 s): "Sol 4. A message from Earth. Mars is 16 light-minutes away, so the warning comes late. This one says a storm is coming tomorrow. That is real: DONKI links this proton event to the blast that caused it."
3. **c) Sol 8 · shield 0** (25 s): "The biggest proton day of the real storm. With the shield at 0, the crew gets 24 mSv in one day, and the mission fails." Point to the report.
4. **c) Sol 8 · shield 3** (30 s): "Same day, shield at 3. In 3D you can see the storm pieces bouncing off the dome: 9 out of 10, exactly the game rule. Only 2.4 mSv." Drag the 3D view once.
5. **d) Win · Gold** (20 s): "Gold rank. And now the secret is revealed: it was the real storm of 6 to 15 May 2024." Click "Print certificate" only if there is time.
6. **e) Loss · cause chain** (20 s): "If you never change the plan, you lose on sol 8. The game shows why, step by step, with a tip."

## 3:50-4:30 · NASA data

"Every number has a source. Open 'For teachers'." Click the button. "Each value is labelled as live NASA data, a NASA reference value, or a game rule. The storms come from DONKI: flare reports, proton events and coronal mass ejections for 3 real storm weeks. The air math uses NASA's 0.84 kg of oxygen per astronaut per day. The everyday radiation, 0.64 mSv per day, comes from Curiosity's RAD. The 3D ground is real MOLA height data of Gale crater." Close the panel, then click **f) Sun today**: "And this asks NASA about the Sun right now."

## 4:30-5:00 · Impact + next steps

"Who is it for? Children aged 7 to 12 in a classroom. How do we measure it? Every child does the same 3-question quiz before and after. The teacher panel shows the class average, before and after, and exports a CSV, with no names stored. Next: more storm weeks, a lesson plan for teachers, and testing in real classes here in Ganja. Thank you!"

---

## Answers to the 3 judge questions

**1. "What did you build during the hackathon?"**
"Everything in the repository. The first commit was at 16:08 on 14 November, after the 11:10 start, and every step is committed. The 'What we built' link in the teacher panel lists all the commits (docs/HACKATHON_LOG.md). We used Claude Code as an AI coding assistant, and that is written in AI_USE.md. We used three.js and the Mali font, both open licences, and we credit them."
*(Team: if you had any ideas or sketches before 11:10, say so here honestly.)*

**2. "Which NASA data? Show it."**
Open the teacher panel: "DONKI notifications FLR, SEP and CME, fetched with our script. The raw answers are in data/raw/ for every week, and a test checks that every card in the game matches a raw record." Show `data/raw/2024-05/sep.json` if asked. "The reference values are from NASA sources: Curiosity RAD, the NASA life support constants, NASA-STD-3001, the Inspiration4 data in OSDR. MOLA gives the terrain."

**3. "What doesn't work yet / what would you add?"**
- "'Sun today' uses NASA's shared DEMO_KEY, which allows only a few calls per hour per network. If the limit is reached, it shows our saved copy with an 'ARCHIVED' label."
- "Levels and a guided training round are designed but not built yet. Right now each game is a random 'mystery' storm week."
- "The dose numbers are simplified game rules (4 mSv per proton record, 30 mSv drill limit). They are labelled as rules, not real doses."
- "The class results are stored only in one browser. A real classroom version would need a teacher account."
- "We have not tested with real children yet. That is the next step."
