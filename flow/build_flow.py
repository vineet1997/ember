"""Build the deep-time integration record for the 08–12 run."""
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCES = {
    8: "../shrink/index.html",
    9: "../steppe/index.html",
    10: "../sweep/index.html",
    11: "../doors/index.html",
    12: "../unroll/index.html",
}


def main():
    timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    beats = sorted(timeline["beats"], key=lambda beat: beat["id"])
    total = sum(beat["scrollWeight"] for beat in beats)
    if total != 100:
        raise ValueError("Law 01 requires scroll weights to sum to 100, got %s" % total)

    cursor = 0
    selected = []
    for beat in beats:
        start = cursor / total
        cursor += beat["scrollWeight"]
        end = cursor / total
        if 8 <= beat["id"] <= 12:
            selected.append({
                "id": beat["id"], "title": beat["title"],
                "yearsBP": beat["yearsBP"], "scrollWeight": beat["scrollWeight"],
                "t0": start, "t1": end, "src": SOURCES[beat["id"]],
            })

    output = {
        "_readme": "Built from timeline.json. t is the project's one deep-time float; do not edit by hand.",
        "range": [selected[0]["t0"], selected[-1]["t1"]],
        "beats": selected,
    }
    target = HERE / "data" / "run08-12.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(output, indent=1) + "\n", encoding="utf-8")
    print("wrote %s (%s–%s)" % (target, output["range"][0], output["range"][1]))


if __name__ == "__main__":
    main()
