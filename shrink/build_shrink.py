"""Build Beat 08's on-screen record from the project sources."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as handle:
        timeline = json.load(handle)
    beat = next(item for item in timeline["beats"] if item["id"] == 8)
    events = {item["id"]: item for item in timeline["events"]}
    selected = [events[item] for item in beat["events"]]
    with open(os.path.join(ROOT, "data", "sealevel_merged.json"), encoding="utf-8") as handle:
        sea = json.load(handle)["series"]
    with open(os.path.join(ROOT, "data", "ice_index.json"), encoding="utf-8") as handle:
        ice = json.load(handle)
    with open(os.path.join(ROOT, "data", "bathymetry_meta.json"), encoding="utf-8") as handle:
        bathy = json.load(handle)
    output = {
        "_readme": "Built from timeline.json and data/. Do not edit by hand.",
        "beat": beat,
        "events": selected,
        "routes": [item for item in timeline["routes"] if item.get("beat") == 8],
        "sources": {source: timeline["sources"][source] for event in selected for source in event["sourceIds"]},
        "sea": [[item["yrBP"], item["m"]] for item in sea],
        "ice": ice,
        "iceCoverage": {
            "fromBP": 26000,
            "note": "The local ICE-6G atlas begins at 26 ka. This 39–26.5 ka beat deliberately renders no inferred ice field."
        },
        "bathy": bathy,
        "finalCamera": {"lon": 170, "lat": 65, "alt": 1.35, "pitch": 23, "bearing": 78},
    }
    output_dir = os.path.join(HERE, "data")
    os.makedirs(output_dir, exist_ok=True)
    target = os.path.join(output_dir, "beat08.json")
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=1, ensure_ascii=False)
    print("wrote %s (%d events)" % (target, len(selected)))


if __name__ == "__main__":
    main()
