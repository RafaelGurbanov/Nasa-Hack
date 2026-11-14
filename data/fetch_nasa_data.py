"""
Fetch real NASA DONKI space-weather records for several real storm weeks
("Mystery Storm": the game picks one at random) and cache them for the game
(data/events.json + data/events.js).

Run once (needs internet + a personal key in data/.env):
    python data/fetch_nasa_data.py            # fetch + cache all storm weeks
    python data/fetch_nasa_data.py --raw      # print one raw API response and exit

Design rules (see README / DATA_SOURCES.md):
- The key comes only from the environment / data/.env. It is never written to output.
- The game never needs the API to play; it reads the cached events.js.
- If fetching fails, the existing cache is kept. A SAMPLE file is written only when
  no cache exists, and it is clearly labeled "SAMPLE - NOT REAL NASA DATA".
- Events, dates and flare classes are only ever taken from DONKI records. Nothing is invented.
- Only standard library is used (no pip install needed).
"""

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, "raw")
OUT_JSON = os.path.join(HERE, "events.json")
OUT_JS = os.path.join(HERE, "events.js")

API_BASE = "https://api.nasa.gov/DONKI"
TIMEOUT_S = 40
MAX_RETRIES = 4

# Real storm weeks (10 days = 10 sols). Chosen from a DONKI SEP survey of 2012-2025:
# each week has 10+ SEP records, so the never-changing plan loses (see tests/balance.js).
STORMS = [
    {"id": "2024-05", "start": date(2024, 5, 6), "end": date(2024, 5, 15),
     "label": "the May 2024 storm (active regions 13663/13664)"},
    {"id": "2022-09", "start": date(2022, 9, 25), "end": date(2022, 10, 4),
     "label": "the autumn 2022 storm"},
    {"id": "2025-11", "start": date(2025, 11, 6), "end": date(2025, 11, 15),
     "label": "the November 2025 storm"},
]

# Published reference values (not fetched). Each must be checked against its source.
REFERENCE_VALUES = [
    {"key": "mars_surface_dose_msv_per_day", "value": 0.64, "unit": "mSv/day",
     "label": "Average radiation dose on the Mars surface (Curiosity RAD, Gale crater)",
     "source": "Hassler et al. 2014, Science 343(6169), doi:10.1126/science.1244797",
     "type": "published reference value", "verify": True},
    {"key": "o2_kg_per_crew_per_day", "value": 0.84, "unit": "kg O2 / crew member / day",
     "label": "Oxygen consumed per astronaut per day",
     "source": "NASA Life Support Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570 "
               "(VERIFY exact revision and table); same 0.84 kg average also in NASA NTRS 20100036823",
     "type": "published reference value", "verify": True},
    {"key": "iss_water_recovery_pct", "value": 98, "unit": "% of water recovered",
     "label": "ISS life support water recovery after the Brine Processor Assembly (93-94% before it)",
     "source": "NASA ISS news release, June 2023 (VERIFY URL on nasa.gov)",
     "type": "published reference value", "verify": True},
    {"key": "career_dose_limit_msv", "value": 600, "unit": "mSv (career effective dose)",
     "label": "NASA astronaut career radiation limit",
     "source": "NASA-STD-3001 Volume 1; NASA OCHMO Radiation Protection Technical Brief (VERIFY current revision)",
     "type": "published reference value", "verify": True},
    {"key": "sep_event_dose_limit_msv", "value": 250, "unit": "mSv per solar particle event",
     "label": "Short-term limit for one solar particle event",
     "source": "NASA-STD-3001 Volume 1 (seen via secondary source; VERIFY in the standard)",
     "type": "published reference value", "verify": True},
    {"key": "curiosity_rad_2024_05_20_ugy", "value": 8100, "unit": "micrograys (absorbed dose, one event)",
     "label": "Dose Curiosity RAD measured on Mars during the 20 May 2024 storm from active region 13664 "
              "(about 30 chest X-rays)",
     "source": "NASA/JPL release June 2024 'NASA Watches Mars Light Up During Epic Solar Storm' (VERIFY URL)",
     "type": "published reference value", "verify": True},
    {"key": "mars_trip_months", "value": 7, "unit": "months (one way, typical)",
     "label": "How long a spacecraft takes to fly from Earth to Mars",
     "source": "NASA Mars mission overviews (typical transfer about 7 months; VERIFY page)",
     "type": "published reference value", "verify": True},
    {"key": "osdr_inspiration4_recovery_pct", "value": 95, "unit": "% of measured body markers back to pre-flight levels within months",
     "label": "Inspiration4 (2021, 3-day flight, 4 crew): almost all changes measured in the crew's bodies returned to "
              "normal within months after landing (reported as more than 95%)",
     "source": "NASA Open Science Data Repository (OSDR) / Space Omics and Medical Atlas (SOMA), Nature 2024 "
               "(VERIFY the exact OSDR dataset IDs and the 95% figure in the SOMA papers)",
     "type": "published reference value", "verify": True},
]

# Science missions on calm sols: real Curiosity / Perseverance activities (facts checked 14 Nov 2026).
SCIENCE_MISSIONS = [
    {"id": "heli", "title": "Fly the helicopter", "icon": "🚁",
     "fact": "NASA's Ingenuity helicopter made 72 flights on Mars (2021 to 2024). It was the first powered flight on another planet.",
     "source": "NASA JPL, Ingenuity flight log (first flight 19 April 2021, flight 72 on 18 January 2024)"},
    {"id": "moxie", "title": "Make oxygen from Martian air", "icon": "🫧",
     "fact": "Perseverance's MOXIE machine made 122 grams of oxygen from Mars air. That is about what a small dog breathes in 10 hours.",
     "source": "NASA, 'NASA's Oxygen-Generating Experiment MOXIE Completes Mars Mission', 6 Sept 2023"},
    {"id": "clouds", "title": "Photograph Martian clouds", "icon": "📷",
     "fact": "On 2 February 2023, the Curiosity rover took the first clear photo of sun rays shining through clouds on Mars.",
     "source": "NASA JPL, 'NASA's Curiosity Captures First Sun Rays on Mars', March 2023"},
    {"id": "sample", "title": "Collect a rock sample", "icon": "🪨",
     "fact": "A sample is a small piece of rock kept for study. Perseverance seals rock cores in tubes so a future mission could bring them to Earth.",
     "source": "NASA Mars 2020 Perseverance mission, sample collection"},
    {"id": "rad", "title": "Measure the radiation", "icon": "📡",
     "fact": "Curiosity's RAD tool has measured radiation on Mars since 2012. Our 0.64 mSv per day comes from RAD.",
     "source": "Hassler et al. 2014, Science 343(6169)"},
    {"id": "weather", "title": "Check the Mars weather", "icon": "🌡️",
     "fact": "Curiosity's weather station (REMS) measures air temperature, air pressure and wind in Gale crater.",
     "source": "NASA Mars Science Laboratory, REMS instrument"},
]


# ---------------------------------------------------------------- helpers

def load_api_key():
    key = os.environ.get("NASA_API_KEY", "").strip()
    env_path = os.path.join(HERE, ".env")
    if not key and os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("NASA_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    return key


def log(msg):
    print(f"[fetch] {msg}", flush=True)


def api_get(path, params, api_key):
    """GET api.nasa.gov/DONKI/<path>. Returns (status, json_or_None, meta). meta never has the key."""
    url = f"{API_BASE}/{path}?{urllib.parse.urlencode(dict(params, api_key=api_key))}"
    safe_url = f"{API_BASE}/{path}?{urllib.parse.urlencode(params)}"
    meta = {"endpoint": safe_url, "status": None, "rate_limit_remaining": None, "rate_limit_limit": None, "attempts": 0}
    for attempt in range(1, MAX_RETRIES + 1):
        meta["attempts"] = attempt
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mars-mission-trainer/1.0"})
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                meta["status"] = resp.status
                meta["rate_limit_remaining"] = resp.headers.get("X-RateLimit-Remaining")
                meta["rate_limit_limit"] = resp.headers.get("X-RateLimit-Limit")
                log(f"{path} {params.get('startDate')}..{params.get('endDate')}: HTTP {resp.status}, "
                    f"rate limit remaining {meta['rate_limit_remaining']}/{meta['rate_limit_limit']}")
                body = resp.read().decode("utf-8")
                return resp.status, (json.loads(body) if body.strip() else []), meta
        except urllib.error.HTTPError as e:
            meta["status"] = e.code
            meta["rate_limit_remaining"] = e.headers.get("X-RateLimit-Remaining")
            log(f"{path}: HTTP {e.code} (attempt {attempt})")
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt)
                continue
            return e.code, None, meta
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            meta["status"] = "network-error"
            log(f"{path}: network error '{e}' (attempt {attempt})")
            time.sleep(2 ** attempt)
    return meta["status"], None, meta


def save_raw(folder, name, data):
    d = os.path.join(RAW_DIR, folder)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)


def class_rank(cls):
    m = re.fullmatch(r"([ABCMX])(\d+(?:\.\d+)?)", cls or "")
    if not m:
        return None
    return {"A": 1e-8, "B": 1e-7, "C": 1e-6, "M": 1e-5, "X": 1e-4}[m.group(1)] * float(m.group(2))


def time_from_activity_id(aid):
    """DONKI activity IDs start with their own start time, e.g. '2024-05-08T04:37:00-FLR-001'."""
    m = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})", aid or "")
    return m.group(1) + "Z" if m else None


# ---------------------------------------------------------------- Earth-Mars light delay
# Approximate planet positions from NASA JPL "Keplerian Elements for Approximate Positions of the
# Major Planets" (E. M. Standish), Table 1, valid 1800-2050. Error is small for our use (minutes).
ELEMENTS = {  # a(AU), e, I, L, long.peri, long.node ; then rates per Julian century
    "earth": ((1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0),
              (0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0)),
    "mars": ((1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891),
             (0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343)),
}
AU_LIGHT_SECONDS = 499.004784


def helio_xyz(planet, d):
    jd = 2440587.5 + (datetime(d.year, d.month, d.day, 12, tzinfo=timezone.utc).timestamp() / 86400.0)
    T = (jd - 2451545.0) / 36525.0
    (a, e, I, L, wbar, Om), rates = ELEMENTS[planet]
    a += rates[0] * T; e += rates[1] * T; I += rates[2] * T; L += rates[3] * T; wbar += rates[4] * T; Om += rates[5] * T
    w = wbar - Om
    M = ((L - wbar + 180) % 360) - 180
    Mr = math.radians(M)
    E = Mr + e * math.sin(Mr)
    for _ in range(20):
        E -= (E - e * math.sin(E) - Mr) / (1 - e * math.cos(E))
    xp, yp = a * (math.cos(E) - e), a * math.sqrt(1 - e * e) * math.sin(E)
    w, Om, I = math.radians(w), math.radians(Om), math.radians(I)
    x = (math.cos(w) * math.cos(Om) - math.sin(w) * math.sin(Om) * math.cos(I)) * xp + (-math.sin(w) * math.cos(Om) - math.cos(w) * math.sin(Om) * math.cos(I)) * yp
    y = (math.cos(w) * math.sin(Om) + math.sin(w) * math.cos(Om) * math.cos(I)) * xp + (-math.sin(w) * math.sin(Om) + math.cos(w) * math.cos(Om) * math.cos(I)) * yp
    z = (math.sin(w) * math.sin(I)) * xp + (math.cos(w) * math.sin(I)) * yp
    return x, y, z


def earth_mars_au(d):
    ex, ey, ez = helio_xyz("earth", d)
    mx, my, mz = helio_xyz("mars", d)
    return math.dist((ex, ey, ez), (mx, my, mz))


# ---------------------------------------------------------------- parsing DONKI notifications

FULL_REPORT = re.compile(
    r"Flare start time:\s*(?P<start>\S+?)\.\s*"
    r"Flare peak time:\s*(?P<peak>\S+?)\.\s*"
    r"Flare intensity:\s*(?P<cls>[ABCMX]\d+(?:\.\d+)?) class\.\s*"
    r"Source region:\s*(?P<loc>[NS]\d+[EW]\d+)(?:\s*\(Active Region (?P<ar>\d+)\))?")
ACTIVITY_ID = re.compile(r"Activity ID:\s*(\S+?-FLR-\d+)")


def summary_of(body):
    part = body.split("## Summary:", 1)[1] if "## Summary:" in body else body
    return " ".join(part.split("## Notes", 1)[0].split())


def flares_from_flr_endpoint(records, folder):
    return [{
        "flr_id": r.get("flrID"), "start_time": r.get("beginTime"), "peak_time": r.get("peakTime"),
        "class": r.get("classType"), "source_location": r.get("sourceLocation"),
        "active_region": r.get("activeRegionNum"), "record_url": r.get("link"),
        "raw_ref": {"file": f"raw/{folder}/flr.json", "match_field": "flrID", "value": r.get("flrID")},
        "source_line": f"NASA DONKI FLR record {r.get('flrID')}",
    } for r in records]


def flares_from_notifications(records, folder="2024-05"):
    """Keep only full flare reports; skip 'threshold crossed' quick alerts (no double counting)."""
    out, seen = [], set()
    for r in records:
        s = summary_of(r.get("messageBody", ""))
        m = FULL_REPORT.search(s)
        if not m:
            continue
        key = (m.group("start"), m.group("cls"))
        if key in seen:
            continue
        seen.add(key)
        aid = ACTIVITY_ID.search(s)
        out.append({
            "flr_id": aid.group(1) if aid else None,
            "start_time": m.group("start"), "peak_time": m.group("peak"), "class": m.group("cls"),
            "source_location": m.group("loc"), "active_region": int(m.group("ar")) if m.group("ar") else None,
            "record_url": r.get("messageURL"), "message_id": r.get("messageID"),
            "message_issue_time": r.get("messageIssueTime"),
            "raw_ref": {"file": f"raw/{folder}/notifications_flr.json", "match_field": "messageID", "value": r.get("messageID")},
            "raw_summary": s,
            "source_line": f"NASA DONKI notification {r.get('messageID')} (GOES flare {m.group('cls')}, peak {m.group('peak')})",
        })
    return out


# ---------------------------------------------------------------- one storm week

def build_storm(cfg, api_key, fetched_at):
    start, end, folder = cfg["start"], cfg["end"], cfg["id"]
    params = {"startDate": start.isoformat(), "endDate": end.isoformat()}
    sources, warnings = [], []

    def sol_for(ts):
        if not ts:
            return None
        d = datetime.strptime(ts[:10], "%Y-%m-%d").date()
        return (d - start).days + 1 if start <= d <= end else None

    # Flares: FLR endpoint first, then DONKI notifications (type=FLR) if it fails.
    st, flr, meta = api_get("FLR", params, api_key)
    if st == 200 and isinstance(flr, list) and flr:
        save_raw(folder, "flr.json", flr)
        flares = flares_from_flr_endpoint(flr, folder)
        sources.append(dict(meta, dataset="DONKI FLR (solar flares)", records=len(flr), fetched_at=fetched_at, type="live-fetched"))
    else:
        warnings.append(f"DONKI/FLR returned {st} for {folder}; used DONKI notifications (type=FLR) for the same flare reports.")
        st2, notes, meta2 = api_get("notifications", dict(params, type="FLR"), api_key)
        if not (st2 == 200 and isinstance(notes, list)):
            raise RuntimeError(f"No flare data for {folder}")
        save_raw(folder, "notifications_flr.json", notes)
        flares = flares_from_notifications(notes, folder)
        sources.append(dict(meta2, dataset="DONKI notifications, type=FLR (GOES flare reports issued by CCMC)",
                            records=len(notes), flares_parsed=len(flares), fetched_at=fetched_at, type="live-fetched",
                            fallback_for=meta["endpoint"], fallback_reason=f"FLR endpoint HTTP {st} on {fetched_at}"))

    st3, sep, meta3 = api_get("SEP", params, api_key)
    if st3 != 200 or not isinstance(sep, list):
        raise RuntimeError(f"No SEP data for {folder}")
    save_raw(folder, "sep.json", sep)
    sources.append(dict(meta3, dataset="DONKI SEP (solar energetic particle events)", records=len(sep), fetched_at=fetched_at, type="live-fetched"))

    # CMEs: from 3 days before the window so a blast just before sol 1 can still give a warning.
    cparams = {"startDate": (start - timedelta(days=3)).isoformat(), "endDate": end.isoformat()}
    st4, cme, meta4 = api_get("CME", cparams, api_key)
    cme = cme if (st4 == 200 and isinstance(cme, list)) else []
    if st4 == 200:
        save_raw(folder, "cme.json", cme)
    else:
        warnings.append(f"DONKI/CME returned {st4} for {folder}; warnings use flare links only.")
    sources.append(dict(meta4, dataset="DONKI CME (coronal mass ejections: clouds of Sun material)", records=len(cme), fetched_at=fetched_at, type="live-fetched"))

    sep_events = [{
        "sep_id": s.get("sepID"), "event_time": s.get("eventTime"), "sol": sol_for(s.get("eventTime")),
        "instruments": [i.get("displayName") for i in s.get("instruments", [])],
        "linked_ids": [l["activityID"] for l in (s.get("linkedEvents") or []) if "-FLR-" in l.get("activityID", "") or "-CME-" in l.get("activityID", "")],
        "linked_flr_ids": [l["activityID"] for l in (s.get("linkedEvents") or []) if "-FLR-" in l.get("activityID", "")],
        "record_url": s.get("link"),
        "raw_ref": {"file": f"raw/{folder}/sep.json", "match_field": "sepID", "value": s.get("sepID")},
        "source_line": f"NASA DONKI SEP record {s.get('sepID')}",
    } for s in sep]

    linked = {fid: s["sep_id"] for s in sep_events for fid in s["linked_flr_ids"]}
    for f in flares:
        f["sol"] = sol_for(f["peak_time"] or f["start_time"])
        f["class_letter"] = (f["class"] or "?")[0]
        f["peak_flux_w_m2"] = class_rank(f["class"])
        f["linked_sep_id"] = linked.get(f["flr_id"]) if f["flr_id"] else None
    flares = sorted([f for f in flares if f["sol"]], key=lambda f: f["peak_time"])

    cme_by_id = {c.get("activityID"): {"cme_id": c.get("activityID"), "start_time": c.get("startTime"),
                                        "record_url": c.get("link"), "source_line": f"NASA DONKI CME record {c.get('activityID')}"}
                 for c in cme}
    flare_by_id = {f["flr_id"]: f for f in flares if f["flr_id"]}

    sols = []
    for i in range((end - start).days + 1):
        d = start + timedelta(days=i)
        day_flares = [f for f in flares if f["sol"] == i + 1]
        biggest = max(day_flares, key=lambda f: f["peak_flux_w_m2"] or 0, default=None)
        sols.append({"sol": i + 1, "date": d.isoformat(), "flare_count": len(day_flares),
                     "max_class": biggest["class"] if biggest else None,
                     "sep_count": sum(1 for s in sep_events if s["sol"] == i + 1)})

    # Earth's warnings: for every storm sol, find the earliest blast (flare or CME) that DONKI links to
    # its SEP records. Blast on an earlier day -> warning arrives the sol before. Same day -> too late.
    earth_warnings = []
    for sday in [s for s in sols if s["sep_count"]]:
        ids = sorted({i for s in sep_events if s["sol"] == sday["sol"] for i in s["linked_ids"]})
        blasts = []
        for aid in ids:
            t = time_from_activity_id(aid)
            if "-FLR-" in aid:
                f = flare_by_id.get(aid)
                blasts.append({"kind": "flare", "id": aid, "time": t, "class": f["class"] if f else None,
                               "record_url": f["record_url"] if f else None,
                               "source_line": f["source_line"] if f else f"NASA DONKI activity {aid} (linked from the SEP record)"})
            else:
                c = cme_by_id.get(aid)
                blasts.append({"kind": "cme", "id": aid, "time": t, "class": None,
                               "record_url": c["record_url"] if c else None,
                               "source_line": c["source_line"] if c else f"NASA DONKI activity {aid} (linked from the SEP record)"})
        blasts = [b for b in blasts if b["time"]]
        if not blasts:
            earth_warnings.append({"storm_sol": sday["sol"], "status": "none", "warn_sol": sday["sol"], "blast": None})
            continue
        first = min(blasts, key=lambda b: b["time"])
        blast_day = datetime.strptime(first["time"][:10], "%Y-%m-%d").date()
        storm_day = date.fromisoformat(sday["date"])
        on_time = blast_day < storm_day
        earth_warnings.append({"storm_sol": sday["sol"], "status": "on_time" if on_time else "late",
                               "warn_sol": max(1, sday["sol"] - 1) if on_time else sday["sol"], "blast": first})

    mid = start + (end - start) / 2
    au = earth_mars_au(mid)
    return {
        "id": cfg["id"], "label": cfg["label"],
        "window": {"start": start.isoformat(), "end": end.isoformat(), "sols": len(sols),
                   "note": "Sol N = UTC calendar date START + N-1. Real dates, replayed."},
        "light_delay": {"earth_mars_au": round(au, 3), "minutes": round(au * AU_LIGHT_SECONDS / 60, 1), "date": mid.isoformat(),
                        "method": "computed from NASA JPL approximate planetary orbit elements (Standish, Table 1, 1800-2050)"},
        "sources": sources, "warnings": warnings, "sols": sols, "flares": flares,
        "sep_events": sep_events, "earth_warnings": earth_warnings,
    }


def sun_today(api_key, fetched_at):
    """Snapshot of the last 7 days (used by the game only if the live call fails, labeled 'archived')."""
    today = datetime.now(timezone.utc).date()
    p = {"startDate": (today - timedelta(days=7)).isoformat(), "endDate": today.isoformat()}
    st, notes, _ = api_get("notifications", dict(p, type="FLR"), api_key)
    st2, sep, _ = api_get("SEP", p, api_key)
    if st != 200 or st2 != 200:
        return None
    return {"start": p["startDate"], "end": p["endDate"], "fetched_at": fetched_at,
            "big_flares": len(flares_from_notifications(notes or [], "sun-today")), "sep_records": len(sep or []),
            "note": "Big flares = DONKI flare reports (class about M5 and above)."}


def build(api_key):
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    storms = [build_storm(cfg, api_key, fetched_at) for cfg in STORMS]
    return {
        "data_status": "REAL - live-fetched from NASA DONKI via api.nasa.gov",
        "fetched_at": fetched_at,
        "storms": storms,
        "warnings": [w for s in storms for w in s["warnings"]],
        "caveats": [
            "DONKI flares are observed by GOES from Earth orbit. Flare class (C/M/X) is peak X-ray brightness at "
            "Earth, not radiation dose at Mars. The game uses SEP (proton) records for dose and flare class only as context.",
            "DONKI notifications only report flares of about M5.0 and above, so smaller flares are not included.",
            "Earth's warnings use the flares/CMEs that DONKI itself links to each SEP record. If the blast and the "
            "particles are on the same day, the game says the warning came too late.",
            "The light delay is computed for the middle of each storm week from approximate orbit formulas.",
        ],
        "reference_values": REFERENCE_VALUES,
        "science_missions": SCIENCE_MISSIONS,
        "sun_today_archive": sun_today(api_key, fetched_at),
    }


def write_outputs(data):
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// Generated by data/fetch_nasa_data.py - do not edit by hand.\n")
        f.write("// Loaded with a <script> tag so the game also runs offline (file://).\n")
        f.write("window.MISSION_DATA = ")
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    log(f"wrote {OUT_JSON} and {OUT_JS}")


def write_sample(reason):
    """Only used when no real cache exists. Clearly labeled; no fake records."""
    s = STORMS[0]
    data = {"data_status": "SAMPLE - NOT REAL NASA DATA", "sample_reason": reason, "fetched_at": None,
            "storms": [{"id": s["id"], "label": s["label"], "window": {"start": s["start"].isoformat(), "end": s["end"].isoformat(), "sols": 10},
                        "light_delay": {"minutes": None}, "sources": [], "warnings": [], "flares": [], "sep_events": [], "earth_warnings": [],
                        "sols": [{"sol": i + 1, "date": (s["start"] + timedelta(days=i)).isoformat(), "flare_count": 0, "max_class": None, "sep_count": 0} for i in range(10)]}],
            "warnings": ["Fetch failed. Re-run data/fetch_nasa_data.py with internet access."], "caveats": [],
            "reference_values": REFERENCE_VALUES, "science_missions": SCIENCE_MISSIONS, "sun_today_archive": None}
    write_outputs(data)


def main():
    ap = argparse.ArgumentParser(description="Fetch NASA DONKI storm weeks for Mars Storm Replay")
    ap.add_argument("--raw", action="store_true", help="print one raw FLR notification and exit")
    ap.add_argument("--allow-demo-key", action="store_true", help="allow DEMO_KEY (testing only)")
    args = ap.parse_args()
    api_key = load_api_key()
    if not api_key:
        sys.exit("NASA_API_KEY missing. Copy data/.env.example to data/.env and add your key.")
    if api_key == "DEMO_KEY" and not args.allow_demo_key:
        sys.exit("DEMO_KEY is not allowed for the final fetch. Use a personal key from api.nasa.gov.")
    if args.raw:
        _, data, _ = api_get("notifications", {"startDate": "2024-05-08", "endDate": "2024-05-08", "type": "FLR"}, api_key)
        print(json.dumps(data[0] if data else data, indent=2, ensure_ascii=False))
        return
    try:
        data = build(api_key)
    except Exception as e:  # noqa: BLE001 - report every failure loudly
        log(f"FETCH FAILED: {e}")
        if os.path.exists(OUT_JSON):
            log("Keeping existing cached events.json / events.js (not overwritten).")
        else:
            write_sample(str(e))
        sys.exit(1)
    write_outputs(data)
    for s in data["storms"]:
        log(f"{s['id']}: {len(s['flares'])} flares, {len(s['sep_events'])} SEP, light delay {s['light_delay']['minutes']} min "
            f"({s['light_delay']['earth_mars_au']} AU)")
        log("   sols: " + " ".join(f"{x['sol']}:{x['sep_count']}" for x in s["sols"]))
        log("   warnings: " + "; ".join(f"storm sol {w['storm_sol']} -> {w['status']} (sol {w['warn_sol']})" for w in s["earth_warnings"]))
    log(f"sun today archive: {data['sun_today_archive']}")


if __name__ == "__main__":
    main()
