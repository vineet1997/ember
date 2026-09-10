"""Build Beat 14's on-screen record from the project timeline."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def main():
    timeline = json.load(open(os.path.join(ROOT, "timeline.json"), encoding="utf-8"))
    beat = next(item for item in timeline["beats"] if item["id"] == 14)
    events = {item["id"]: item for item in timeline["events"]}
    selected = [events[item] for item in beat["events"]]
    sea = json.load(open(os.path.join(ROOT, "data", "sealevel_merged.json"), encoding="utf-8"))["series"]
    out = {"_readme": "Built from timeline.json and data/. Do not edit by hand.", "beat": beat,
           "events": selected, "sources": {sid: timeline["sources"][sid] for e in selected for sid in e["sourceIds"]},
           "sea": [[p["yrBP"], p["m"]] for p in sea],
           "ice": json.load(open(os.path.join(ROOT, "data", "ice_index.json"), encoding="utf-8")),
           "bathy": json.load(open(os.path.join(ROOT, "data", "bathymetry_meta.json"), encoding="utf-8"))}
    target_dir = os.path.join(HERE, "data"); os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, "beat14.json")
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=1, ensure_ascii=False); handle.write("\n")
    print("wrote %s (%d events)" % (target, len(selected)))


if __name__ == "__main__":
    main()
