"""
Everything slice/index.html reads, built from the project's own sources.

  data/bathymetry.png       -> slice/data/bathy_global.png   2048x1024, the limb
  timeline.json             -> slice/data/film.json          beats, events, routes, copy
  data/sealevel_merged.json ->   "                           the sea-level curve
  data/temperature.json     ->   "                           the NGRIP proxy

The three high-resolution frame tiles and every measurement are built by
data/build_beat06.py, data/verify_wallacea.py and data/build_beat0507.py,
which need data/raw/.

PHASE 5. This used to emit beat06.json and it now emits film.json, because it
now carries beats 05, 06 and 07 on ONE continuous t. That is not packaging: it
is Law 01. See the note under tSpan below.

Run:  python slice/build_slice.py
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(HERE, "data")

# Beats 05, 06 and 07, in one span, on one t.
#
# The alternative was three separately addressable slices, and it was rejected
# on Law 01. The film has one number. Three artifacts would need three t
# windows, three camera splines and three copies of the state function, and the
# two places where this work is most likely to fail - 05's release into 06, and
# 06's pull-back into 07 - are exactly the boundaries that a three-artifact
# build makes unscrubbable. A boundary you cannot scrub across is a boundary you
# cannot direct.
#
# Beat 07 also settles a claim that no single beat can hold: when the pale light
# goes out, that colour must be absent for the REST OF THE FILM. That is a
# statement about t in [0.44, 1.0] - beats that do not exist yet. It is testable
# only because stateFor(t) is total over the whole span, and it is testable
# today only because the span is not chopped up.
#
# Separately ADDRESSABLE is a different thing from separately BUILT, and the
# film keeps it: #t=0.2650 and #beat=05 both jump to a shot.
BEATS = [5, 6, 7]
LEAD_IN, LEAD_OUT = 0.015, 0.015          # t either side, so the cuts can be judged

TILES = ["bathy_sunda.json", "bathy_redsea.json", "bathy_europe.json"]
TILE_KEY = {"bathy_sunda.json": "sunda", "bathy_redsea.json": "redsea",
            "bathy_europe.json": "europe"}


def global_texture():
    """Half-size copy of the film's global elevation raster, for the limb and far context.

    Terrain-RGB is linear in R and G with the same weights, so box-averaging the
    channels is box-averaging the elevation. Halving is exact on a 4096x2048 grid.
    """
    src = Image.open(os.path.join(ROOT, "data", "bathymetry.png")).convert("RGB")
    a = np.asarray(src, np.float32)
    v = a[:, :, 0] * 256.0 + a[:, :, 1]
    h, w = v.shape
    v = v.reshape(h // 2, 2, w // 2, 2).mean(axis=(1, 3))
    q = np.clip(np.rint(v), 0, 65535).astype(np.uint16)
    rgb = np.zeros((h // 2, w // 2, 3), np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    p = os.path.join(OUT, "bathy_global.png")
    Image.fromarray(rgb, "RGB").save(p, optimize=True)
    print("  bathy_global.png  %dx%d  %.1f MB" % (w // 2, h // 2, os.path.getsize(p) / 1048576))
    return {"file": "bathy_global.png", "w": w // 2, "h": h // 2}


def thin(series, lo, hi, keep_every):
    """Keep full resolution inside [lo,hi] years BP, thin outside it."""
    out = []
    for i, (x, y) in enumerate(series):
        if lo <= x <= hi or i % keep_every == 0:
            out.append([x, round(y, 4)])
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(ROOT, "timeline.json"), encoding="utf-8"))
    sl = json.load(open(os.path.join(ROOT, "data", "sealevel_merged.json"), encoding="utf-8"))
    tp = json.load(open(os.path.join(ROOT, "data", "temperature.json"), encoding="utf-8"))

    print("textures:")
    glob = global_texture()
    tiles = {}
    for fn in TILES:
        tiles[TILE_KEY[fn]] = json.load(open(os.path.join(OUT, fn), encoding="utf-8"))["tile"]
        t = tiles[TILE_KEY[fn]]
        print("  %-14s %dx%d  %.0f-%.0fE %.0f-%.0fN  %.2f km/px"
              % (TILE_KEY[fn], t["w"], t["h"], t["lon0"], t["lon1"], t["lat0"], t["lat1"],
                 t["kmPerPx"]))

    gap  = json.load(open(os.path.join(OUT, "wallacea_gap.json"), encoding="utf-8"))
    door = json.load(open(os.path.join(OUT, "doors.json"), encoding="utf-8"))
    pale = json.load(open(os.path.join(OUT, "pale_extent.json"), encoding="utf-8"))

    beats = [{"id": b["id"], "y0": b["yearsBP"][0], "y1": b["yearsBP"][1],
              "w": b["scrollWeight"], "title": b["title"], "act": b["act"]}
             for b in tl["beats"]]
    tot = sum(b["w"] for b in beats); acc = 0
    for b in beats:
        b["t0"] = round(acc / tot, 6); acc += b["w"]; b["t1"] = round(acc / tot, 6)
    mine = [b for b in beats if b["id"] in BEATS]

    ev = {e["id"]: e for e in tl["events"]}
    specs, events, seen = {}, [], set()
    for bid in BEATS:
        spec = [b for b in tl["beats"] if b["id"] == bid][0]
        specs[str(bid)] = {"title": spec["title"], "yearsBP": spec["yearsBP"],
                           "motion": spec["motion"], "onScreen": spec["onScreen"],
                           "slug": spec["slug"], "act": spec["act"],
                           "tentpole": spec.get("tentpole", False)}
        for eid in spec["events"]:
            if eid in seen:
                continue
            seen.add(eid)
            e = ev[eid]
            events.append({k: e[k] for k in
                           ("id", "type", "label", "region", "coordinates", "dateRange",
                            "dateNote", "confidence", "sourceIds", "beat", "why") if k in e}
                          | ({"dispute": e["dispute"]} if "dispute" in e else {})
                          | ({"authorship": e["authorship"]} if "authorship" in e else {}))

    want_routes = {"breakout": 5, "breakout-north": 5, "to-sahul": 6, "to-europe": 7}
    routes = [r for r in tl["routes"] if r["id"] in want_routes]
    ranges = [r for r in tl["ranges"] if r["beat"] in BEATS]

    sea = [[p["yrBP"], p["m"]] for p in sl["series"]]
    sea.sort(key=lambda p: p[0])
    temp = tp["series"]
    if isinstance(temp[0], dict):
        temp = [[p.get("yrBP", p.get("yr")), p.get("d18O", p.get("v"))] for p in temp]
    temp.sort(key=lambda p: p[0])

    src = {k: tl["sources"][k] for e in events for k in e.get("sourceIds", [])
           if k in tl["sources"]}

    y_hi = max(s["yearsBP"][0] for s in specs.values())
    y_lo = min(s["yearsBP"][1] for s in specs.values())

    out = {
        "_readme": "Built by slice/build_slice.py from timeline.json and data/. "
                   "Nothing here is authored in this file. Law 01: t is derived from "
                   "beats[] and everything else is a lookup on t.",
        "beats": beats,
        "beatIds": BEATS,
        "tSpan": [round(mine[0]["t0"] - LEAD_IN, 6), round(mine[-1]["t1"] + LEAD_OUT, 6)],
        "specs": specs,
        "events": events,
        "routes": routes,
        "ranges": ranges,
        "sources": src,
        "sea": sea,
        "temp": thin(temp, y_lo - 2000, y_hi + 2000, 4),
        "measured": {"tiles": tiles, "global": glob,
                     "tileChecks": json.load(open(os.path.join(OUT, "bathy_sunda.json"),
                                                  encoding="utf-8"))["checks"],
                     "wallacea": gap, "doors": door, "pale": pale},
        "compressionRatio": round(
            max((b["y0"] - b["y1"]) / (b["t1"] - b["t0"]) for b in beats) /
            min((b["y0"] - b["y1"]) / (b["t1"] - b["t0"]) for b in beats)),
    }
    p = os.path.join(OUT, "film.json")
    json.dump(out, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    stale = os.path.join(OUT, "beat06.json")
    if os.path.exists(stale):
        os.remove(stale)
        print("  removed beat06.json - film.json supersedes it, and two of them is two "
              "sources of truth")

    print("data:")
    print("  film.json  %.0f KB  %d events  %d routes  %d ranges  %d sea  %d temp  %d pale pts"
          % (os.path.getsize(p) / 1024, len(events), len(routes), len(ranges),
             len(sea), len(out["temp"]), len(pale["points"])))
    print("  t span %.4f - %.4f" % (out["tSpan"][0], out["tSpan"][1]))
    for b in mine:
        print("    beat %02d  t %.4f - %.4f   %6d - %-6d BP   motion %d   %s"
              % (b["id"], b["t0"], b["t1"], b["y0"], b["y1"],
                 specs[str(b["id"])]["motion"], b["title"]))
    print("  compression ratio %d:1" % out["compressionRatio"])


if __name__ == "__main__":
    main()
