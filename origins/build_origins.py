"""Build Act I scene records from the shared project timeline and earth data."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def main():
    timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    events = {event["id"]: event for event in timeline["events"]}
    sea = json.loads((ROOT / "data" / "sealevel_merged.json").read_text(encoding="utf-8"))["series"]
    ice = json.loads((ROOT / "data" / "ice_index.json").read_text(encoding="utf-8"))
    bathy = json.loads((ROOT / "data" / "bathymetry_meta.json").read_text(encoding="utf-8"))
    output = HERE / "data"
    output.mkdir(exist_ok=True)
    for beat in timeline["beats"]:
        if beat["id"] not in range(1, 5):
            continue
        selected = [events[event_id] for event_id in beat["events"]]
        record = {
            "_readme": "Built from timeline.json and data/. Do not edit by hand.",
            "beat": beat,
            "events": selected,
            "sources": {source: timeline["sources"][source] for event in selected for source in event["sourceIds"]},
            "sea": [[item["yrBP"], item["m"]] for item in sea],
            "ice": ice,
            "bathy": bathy,
        }
        (output / ("beat%02d.json" % beat["id"])).write_text(
            json.dumps(record, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        print("wrote beat %02d" % beat["id"])


if __name__ == "__main__":
    main()
