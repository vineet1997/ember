"""Build the master 14-beat deep-time record from timeline.json."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCES = {
    1: "../origins/index.html?beat=1", 2: "../origins/index.html?beat=2",
    3: "../origins/index.html?beat=3", 4: "../origins/index.html?beat=4",
    5: "../slice/index.html", 6: "../slice/index.html", 7: "../slice/index.html",
    8: "../shrink/index.html", 9: "../steppe/index.html", 10: "../sweep/index.html",
    11: "../doors/index.html", 12: "../unroll/index.html", 13: "../ocean/index.html",
    14: "../epilogue/index.html",
}


def main():
    timeline = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    beats = sorted(timeline["beats"], key=lambda item: item["id"])
    total = sum(item["scrollWeight"] for item in beats)
    if total != 100:
        raise ValueError("Scroll weights must total 100, got %s" % total)
    cursor, out = 0, []
    for beat in beats:
        start = cursor / total; cursor += beat["scrollWeight"]; end = cursor / total
        out.append({"id": beat["id"], "title": beat["title"], "yearsBP": beat["yearsBP"],
                    "scrollWeight": beat["scrollWeight"], "t0": start, "t1": end,
                    "src": SOURCES[beat["id"]]})
    target = HERE / "data" / "film.json"; target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps({"_readme": "One global deep-time t, built from timeline.json.", "range": [0, 1], "beats": out}, indent=1) + "\n", encoding="utf-8")
    print("wrote %s (14 beats, 0.0–1.0)" % target)


if __name__ == "__main__":
    main()
