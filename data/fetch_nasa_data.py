"""
Fetch real NASA DONKI space-weather records for the "Real storm replay" window
and cache them for the game (data/events.json + data/events.js).

Run once (needs internet + a personal key in data/.env):
    python data/fetch_nasa_data.py            # fetch + cache
    python data/fetch_nasa_data.py --raw      # print one raw API response and exit

Design rules (see README):
- The key comes only from the environment / data/.env. It is never written to output.
- The game never calls the API at runtime; it reads the cached events.js.
- If fetching fails, the existing cache is kept. A SAMPLE file is written only when
  no cache exists, and it is clearly labeled "SAMPLE - NOT REAL NASA DATA".
- Only standard library is used (no pip install needed).
"""

import argparse
import json
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
# Storm window: active regions 13663/13664, May 2024. 10 days = 10 sols.
START = date(2024, 5, 6)
END = date(2024, 5, 15)
TIMEOUT_S = 40
MAX_RETRIES = 4

# Published reference values (not fetched). Each must be checked against its source.
REFERENCE_VALUES = [
    {
        "key": "mars_surface_dose_msv_per_day",
        "value": 0.64,
        "unit": "mSv/day",
        "label": "Average radiation dose on the Mars surface (Curiosity RAD, Gale crater)",
        "source": "Hassler et al. 2014, Science 343(6169), 'Mars' Surface Radiation "
                  "Environment Measured with the Mars Science Laboratory's Curiosity Rover', "
                  "doi:10.1126/science.1244797",
        "type": "published reference value",
        "verify": True,
    },
    {
        "key": "o2_kg_per_crew_per_day",
        "value": 0.84,
        "unit": "kg O2 / crew member / day",
        "label": "Oxygen consumed per astronaut per day",
        "source": "NASA Life Support Baseline Values and Assumptions Document (BVAD), "
                  "NASA/TP-2015-218570 (VERIFY exact revision and table)",
        "type": "published reference value",
        "verify": True,
    },
]


# ---------------------------------------------------------------- helpers

def load_api_key():
    """Read NASA_API_KEY from the environment, else from data/.env."""
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
    """GET api.nasa.gov/DONKI/<path>. Returns (status, json_or_None, meta).

    Retries timeouts, 429 and 5xx with backoff. Does not retry other 4xx.
    meta never contains the key.
    """
    query = dict(params, api_key=api_key)
    url = f"{API_BASE}/{path}?{urllib.parse.urlencode(query)}"
    safe_url = f"{API_BASE}/{path}?{urllib.parse.urlencode(params)}"
    meta = {"endpoint": safe_url, "status": None, "rate_limit_remaining": None,
            "rate_limit_limit": None, "attempts": 0}
    for attempt in range(1, MAX_RETRIES + 1):
        meta["attempts"] = attempt
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mars-mission-trainer/1.0"})
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                meta["status"] = resp.status
                meta["rate_limit_remaining"] = resp.headers.get("X-RateLimit-Remaining")
                meta["rate_limit_limit"] = resp.headers.get("X-RateLimit-Limit")
                log(f"{path}: HTTP {resp.status}, rate limit remaining "
                    f"{meta['rate_limit_remaining']}/{meta['rate_limit_limit']}")
                body = resp.read().decode("utf-8")
                data = json.loads(body) if body.strip() else []
                return resp.status, data, meta
        except urllib.error.HTTPError as e:
            meta["status"] = e.code
            meta["rate_limit_remaining"] = e.headers.get("X-RateLimit-Remaining")
            log(f"{path}: HTTP {e.code} (attempt {attempt}), rate limit remaining "
                f"{meta['rate_limit_remaining']}")
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt)
                continue
            return e.code, None, meta
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            meta["status"] = "network-error"
            log(f"{path}: network error '{e}' (attempt {attempt})")
            time.sleep(2 ** attempt)
    return meta["status"], None, meta


def save_raw(name, data):
    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, name), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)


def class_rank(cls):
    """'X4.5' -> 4.5e-4 W/m^2 (GOES peak X-ray flux scale). None if unknown."""
    m = re.fullmatch(r"([ABCMX])(\d+(?:\.\d+)?)", cls or "")
    if not m:
        return None
    base = {"A": 1e-8, "B": 1e-7, "C": 1e-6, "M": 1e-5, "X": 1e-4}[m.group(1)]
    return base * float(m.group(2))


def sol_for(ts):
    """Map an ISO time like '2024-05-08T05:09Z' to sol 1..10 (UTC date). None outside window."""
    d = datetime.strptime(ts[:10], "%Y-%m-%d").date()
    if START <= d <= END:
        return (d - START).days + 1
    return None


# ---------------------------------------------------------------- parsing

FULL_REPORT = re.compile(
    r"Flare start time:\s*(?P<start>\S+?)\.\s*"
    r"Flare peak time:\s*(?P<peak>\S+?)\.\s*"
    r"Flare intensity:\s*(?P<cls>[ABCMX]\d+(?:\.\d+)?) class\.\s*"
    r"Source region:\s*(?P<loc>[NS]\d+[EW]\d+)(?:\s*\(Active Region (?P<ar>\d+)\))?"
)
ACTIVITY_ID = re.compile(r"Activity ID:\s*(\S+?-FLR-\d+)")


def summary_of(body):
    """The '## Summary:' section of a DONKI message, whitespace-collapsed."""
    part = body.split("## Summary:", 1)[1] if "## Summary:" in body else body
    part = part.split("## Notes", 1)[0]
    return " ".join(part.split())


def flares_from_flr_endpoint(records):
    """Structured DONKI/FLR records (used if that endpoint works)."""
    out = []
    for r in records:
        out.append({
            "flr_id": r.get("flrID"),
            "start_time": r.get("beginTime"),
            "peak_time": r.get("peakTime"),
            "class": r.get("classType"),
            "source_location": r.get("sourceLocation"),
            "active_region": r.get("activeRegionNum"),
            "record_url": r.get("link"),
            "raw_ref": {"file": "raw/flr.json", "match_field": "flrID", "value": r.get("flrID")},
            "source_line": f"NASA DONKI FLR record {r.get('flrID')}",
        })
    return out


def flares_from_notifications(records):
    """Parse DONKI notifications (type=FLR). Keeps only full flare reports;
    'threshold crossed' quick alerts are skipped to avoid double counting."""
    out, seen = [], set()
    for r in records:
        s = summary_of(r.get("messageBody", ""))
        m = FULL_REPORT.search(s)
        if not m:
            continue
        key = (m.group("start"), m.group("cls"))
        if key in seen:  # same flare reported twice
            continue
        seen.add(key)
        aid = ACTIVITY_ID.search(s)
        out.append({
            "flr_id": aid.group(1) if aid else None,  # not invented: null when absent
            "start_time": m.group("start"),
            "peak_time": m.group("peak"),
            "class": m.group("cls"),
            "source_location": m.group("loc"),
            "active_region": int(m.group("ar")) if m.group("ar") else None,
            "record_url": r.get("messageURL"),
            "message_id": r.get("messageID"),
            "message_issue_time": r.get("messageIssueTime"),
            "raw_ref": {"file": "raw/notifications_flr.json", "match_field": "messageID",
                        "value": r.get("messageID")},
            "raw_summary": s,
            "source_line": f"NASA DONKI notification {r.get('messageID')} "
                           f"(GOES flare {m.group('cls')}, peak {m.group('peak')})",
        })
    return out


# ---------------------------------------------------------------- build

def build(api_key):
    params = {"startDate": START.isoformat(), "endDate": END.isoformat()}
    sources, warnings = [], []
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1) Flares: try the structured FLR endpoint first.
    st, flr, meta = api_get("FLR", params, api_key)
    flares, flare_source = [], None
    if st == 200 and isinstance(flr, list) and flr:
        save_raw("flr.json", flr)
        flares = flares_from_flr_endpoint(flr)
        flare_source = dict(meta, dataset="DONKI FLR (solar flares)", records=len(flr),
                            fetched_at=fetched_at, type="live-fetched")
    else:
        warnings.append(f"DONKI/FLR returned {st}; using DONKI notifications (type=FLR) "
                        "for the same flare reports.")
        log(warnings[-1])
        st2, notes, meta2 = api_get("notifications", dict(params, type="FLR"), api_key)
        if st2 == 200 and isinstance(notes, list) and notes:
            save_raw("notifications_flr.json", notes)
            flares = flares_from_notifications(notes)
            flare_source = dict(meta2, dataset="DONKI notifications, type=FLR "
                                "(GOES flare reports issued by CCMC)", records=len(notes),
                                flares_parsed=len(flares), fetched_at=fetched_at,
                                type="live-fetched", fallback_for=meta["endpoint"],
                                fallback_reason=f"FLR endpoint HTTP {st} on {fetched_at}")
    if not flares:
        raise RuntimeError("No flare data from either DONKI FLR or notifications.")
    sources.append(flare_source)

    # 2) Solar energetic particle (SEP) events - the particles that actually raise dose.
    st3, sep, meta3 = api_get("SEP", params, api_key)
    sep = sep if (st3 == 200 and isinstance(sep, list)) else []
    if st3 != 200:
        warnings.append(f"DONKI/SEP returned {st3}; SEP links left empty.")
    else:
        save_raw("sep.json", sep)
    sources.append(dict(meta3, dataset="DONKI SEP (solar energetic particle events)",
                        records=len(sep), fetched_at=fetched_at, type="live-fetched"))

    sep_events = [{
        "sep_id": s.get("sepID"),
        "event_time": s.get("eventTime"),
        "sol": sol_for(s.get("eventTime", "")),
        "instruments": [i.get("displayName") for i in s.get("instruments", [])],
        "linked_flr_ids": [l["activityID"] for l in (s.get("linkedEvents") or [])
                           if "-FLR-" in l.get("activityID", "")],
        "record_url": s.get("link"),
        "raw_ref": {"file": "raw/sep.json", "match_field": "sepID", "value": s.get("sepID")},
        "source_line": f"NASA DONKI SEP record {s.get('sepID')}",
    } for s in sep]

    linked = {fid: s["sep_id"] for s in sep_events for fid in s["linked_flr_ids"]}
    for f in flares:
        f["sol"] = sol_for(f["peak_time"] or f["start_time"])
        f["class_letter"] = (f["class"] or "?")[0]
        f["peak_flux_w_m2"] = class_rank(f["class"])
        f["linked_sep_id"] = linked.get(f["flr_id"]) if f["flr_id"] else None
    flares = sorted([f for f in flares if f["sol"]], key=lambda f: f["peak_time"])

    sols = []
    for i in range((END - START).days + 1):
        d = START + timedelta(days=i)
        day_flares = [f for f in flares if f["sol"] == i + 1]
        biggest = max(day_flares, key=lambda f: f["peak_flux_w_m2"] or 0, default=None)
        sols.append({
            "sol": i + 1,
            "date": d.isoformat(),
            "flare_count": len(day_flares),
            "max_class": biggest["class"] if biggest else None,
            "sep_count": sum(1 for s in sep_events if s["sol"] == i + 1),
        })

    return {
        "data_status": "REAL - live-fetched from NASA DONKI via api.nasa.gov",
        "window": {"start": START.isoformat(), "end": END.isoformat(), "sols": len(sols),
                   "note": "Sol N = UTC calendar date START + N-1. Real dates, replayed."},
        "fetched_at": fetched_at,
        "sources": sources,
        "warnings": warnings,
        "caveats": [
            "DONKI flares are observed by GOES from Earth orbit. Flare class (C/M/X) is "
            "peak X-ray brightness at Earth, not radiation dose at Mars. The game uses "
            "class only as a teaching proxy for storm strength.",
            "DONKI notifications only report flares of about M5.0 and above, so smaller "
            "flares in this window are not included.",
        ],
        "reference_values": REFERENCE_VALUES,
        "sols": sols,
        "flares": flares,
        "sep_events": sep_events,
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
    """Only used when no real cache exists. Clearly labeled; no fake flare records."""
    data = {
        "data_status": "SAMPLE - NOT REAL NASA DATA",
        "sample_reason": reason,
        "window": {"start": START.isoformat(), "end": END.isoformat(), "sols": 10},
        "fetched_at": None,
        "sources": [],
        "warnings": ["Fetch failed. Re-run data/fetch_nasa_data.py with internet access."],
        "caveats": [],
        "reference_values": REFERENCE_VALUES,
        "sols": [{"sol": i + 1, "date": (START + timedelta(days=i)).isoformat(),
                  "flare_count": 0, "max_class": None, "sep_count": 0} for i in range(10)],
        "flares": [],
        "sep_events": [],
    }
    write_outputs(data)


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--raw", action="store_true", help="print one raw FLR notification and exit")
    ap.add_argument("--allow-demo-key", action="store_true",
                    help="allow DEMO_KEY (testing only, not for the final fetch)")
    args = ap.parse_args()

    api_key = load_api_key()
    if not api_key:
        sys.exit("NASA_API_KEY missing. Copy data/.env.example to data/.env and add your key.")
    if api_key == "DEMO_KEY" and not args.allow_demo_key:
        sys.exit("DEMO_KEY is not allowed for the final fetch. Use a personal key from api.nasa.gov.")

    if args.raw:
        st, data, _ = api_get("notifications", {"startDate": "2024-05-08",
                                                "endDate": "2024-05-08", "type": "FLR"}, api_key)
        print(json.dumps(data[0] if data else data, indent=2, ensure_ascii=False))
        return

    try:
        data = build(api_key)
    except Exception as e:  # noqa: BLE001 - report every failure loudly
        log(f"FETCH FAILED: {e}")
        if os.path.exists(OUT_JSON):
            log("Keeping existing cached events.json / events.js (not overwritten).")
        else:
            log("No cache found. Writing a SAMPLE file labeled 'NOT REAL NASA DATA'.")
            write_sample(str(e))
        sys.exit(1)

    write_outputs(data)
    log(f"{len(data['flares'])} flares, {len(data['sep_events'])} SEP events, "
        f"{len(data['sols'])} sols. Warnings: {len(data['warnings'])}")
    for s in data["sols"]:
        log(f"  sol {s['sol']:>2} {s['date']}  flares={s['flare_count']}  "
            f"max={s['max_class']}  SEP={s['sep_count']}")


if __name__ == "__main__":
    main()
