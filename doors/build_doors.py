"""Build the Beat 11 transport from the project's record.

    .venv\\Scripts\\python.exe doors\\build_doors.py

The scene has no hand-authored dates, places, or final camera.  Keeping those
in one generated document means the scene, its join with Beat 12, and the
timeline remain one claim rather than three similar-looking ones.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BEAT = 11

# This is the final Beat 11 pose, not an unroll default.  The unroll consumes
# this same document, so a later camera change has one place to make it.
FINAL_CAMERA = {"lon": 38.0, "lat": 36.5, "alt": 3.60, "pitch": 6.0,
                "bearing": 0.0}


def main():
    with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as f:
        timeline = json.load(f)
    with open(os.path.join(ROOT, "data", "sealevel_merged.json"), encoding="utf-8") as f:
        sea = json.load(f)["series"]
    with open(os.path.join(ROOT, "data", "ice_index.json"), encoding="utf-8") as f:
        ice = json.load(f)
    with open(os.path.join(ROOT, "data", "bathymetry_meta.json"), encoding="utf-8") as f:
        bathy = json.load(f)

    beat = next(b for b in timeline["beats"] if b["id"] == BEAT)
    by_id = {e["id"]: e for e in timeline["events"]}
    events = [by_id[eid] for eid in beat["events"]]
    missing = [e["id"] for e in events
               if any(s not in timeline["sources"] for s in e["sourceIds"])]
    if missing:
        raise SystemExit("refusing to write: unresolved sources for " + ", ".join(missing))

    out = {
        "_readme": "Built by doors/build_doors.py from timeline.json and data/. Do not edit by hand.",
        "beat": {k: beat[k] for k in ("id", "title", "slug", "yearsBP", "motion", "onScreen")},
        "events": events,
        "sources": {sid: timeline["sources"][sid] for event in events for sid in event["sourceIds"]},
        "sea": [[p["yrBP"], p["m"]] for p in sea],
        "ice": ice,
        "bathy": bathy,
        "finalCamera": FINAL_CAMERA,
    }
    out_dir = os.path.join(HERE, "data")
    os.makedirs(out_dir, exist_ok=True)
    target = os.path.join(out_dir, "beat11.json")
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("wrote %s" % target)
    print("  %d events, %d sources; final camera %.1fE %.1fN alt %.2f" %
          (len(events), len(out["sources"]), FINAL_CAMERA["lon"], FINAL_CAMERA["lat"], FINAL_CAMERA["alt"]))


if __name__ == "__main__":
    main()
