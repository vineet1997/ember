"""Build Beat 13's transport from timeline.json; it authors no historical data."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as handle:
        timeline = json.load(handle)
    beat = next(item for item in timeline["beats"] if item["id"] == 13)
    events = {item["id"]: item for item in timeline["events"]}
    selected = [events[item] for item in beat["events"]]
    with open(os.path.join(ROOT, "data", "sealevel_merged.json"), encoding="utf-8") as handle:
        sea = json.load(handle)["series"]
    output = {
        "_readme": "Built from timeline.json and data/. Do not edit by hand.",
        "beat": beat,
        "events": selected,
        "routes": [item for item in timeline["routes"] if item.get("beat") == 13],
        "sources": {sid: timeline["sources"][sid] for event in selected for sid in event["sourceIds"]},
        "sea": [[item["yrBP"], item["m"]] for item in sea],
        "ice": json.load(open(os.path.join(ROOT, "data", "ice_index.json"), encoding="utf-8")),
        "bathy": json.load(open(os.path.join(ROOT, "data", "bathymetry_meta.json"), encoding="utf-8")),
    }
    target_dir = os.path.join(HERE, "data")
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, "beat13.json")
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(output, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print("wrote %s (%d events, %d routes)" % (target, len(selected), len(output["routes"])))


if __name__ == "__main__":
    main()
