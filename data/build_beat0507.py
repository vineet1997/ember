"""
The earth for beats 05 and 07, cut from the same ETOPO 2022 bedrock grid the
rest of the film uses, at its native 60" (1.85 km).

Beat 05 is a LOCKED CAMERA. That raises the resolution bar rather than lowering
it: a shot that never moves gives the eye ten thousand years to study one
frame, and the global 4096-wide texture puts nine kilometres in a pixel. Both
doors out of Africa are a few pixels wide there. The water at Bab-el-Mandeb is
about 30 km across; at 9.8 km/px that is three pixels, and the film would be
drawing a rumour.

Beat 07 is Europe and west Asia, orbital and close.

It also measures, on the real grid, the claim beat 05 puts on screen.
BOTH DOORS, because the route is unresolved (timeline.json, dispersal-route,
confidence "band") and a film that draws one door and measures one door has
chosen the route on the reader's behalf.

    THE QUANTITY, stated before the code that computes it:

    door bottleneck(S) = over all island-hopping routes from the African
    landmass to the Eurasian landmass THROUGH THIS CORRIDOR ONLY, at sea
    level S, the smallest achievable longest single water hop.

    Identical to the Wallacea definition in verify_wallacea.py - deliberately,
    because the film puts the two numbers in one sentence and they must be the
    same measurement. It is NOT the coast-to-coast distance across the strait,
    and it is NOT the width of the shipping channel.

    The corridor is what makes it a door. Africa and Eurasia are one land
    component at every sea level in the record - you can always walk around by
    Sinai - so a global bottleneck is 0 km and says nothing at all. Each
    corridor box isolates one door and asks what that door costs.

Run:  python data/build_beat0507.py
"""
import json, os, sys
import numpy as np
import h5py
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from verify_wallacea import bottleneck, read_box, seed          # one algorithm, not two

OUT = os.path.join(os.path.dirname(HERE), "slice", "data")
R_EARTH = 6371.0088
E_MIN, E_MAX = -11000.0, 9000.0
SCALE = (E_MAX - E_MIN) / 65535.0

# ---------------------------------------------------------------- render tiles
# Beat 05 holds both doors, the Red Sea between them, and the Persian Gulf -
# which at this beat's sea levels is not a gulf. The frame is wide because the
# route is unresolved and the shot must not choose.
REDSEA = dict(file="bathy_redsea.png", lon0=28.0, lon1=62.0, lat0=4.0, lat1=36.0)
# Beat 07 is Europe and west Asia. East to 60E so the pale extent has somewhere
# to be that is not only Europe; north only to 61N because there is no ice
# channel before 26 ka and the film must not draw an ice sheet it cannot source.
# South to 30N because the Levant sites are inside the pale extent and a tile
# that stopped at 33N would have put them over the edge of the world.
EUROPE = dict(file="bathy_europe.png", lon0=-12.0, lon1=60.0, lat0=30.0, lat1=61.0)

# ------------------------------------------------------------------ the doors
# Corridor boxes, each drawn tight enough that the only way from the African
# seed to the Eurasian seed is through this one door.
DOORS = [
    dict(id="bab-el-mandeb", label="Bab-el-Mandeb",
         box=(41.0, 46.5, 10.0, 16.5), africa=(42.4, 12.6), eurasia=(45.2, 13.6),
         note="The southern door."),
    dict(id="sinai", label="Sinai",
         box=(30.0, 38.0, 24.0, 33.0), africa=(31.0, 26.5), eurasia=(36.0, 31.5),
         note="The northern door."),
]

# The beat's own sea levels, plus the record's extremes, so "at any sea level"
# is a measurement and not a manner of speaking.
SEAS = [0.0, -68.3, -73.9, -84.7, -85.7, -90.3, -131.0]


def build_tile(spec, f):
    z, lat, lon = read_box(f, spec["lon0"], spec["lon1"], spec["lat0"], spec["lat1"])
    z = z[::-1, :]                                   # source is south-up, texture north-up
    h, w = z.shape
    q = np.clip((z - E_MIN) / SCALE, 0, 65535).astype(np.uint16)
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    p = os.path.join(OUT, spec["file"])
    Image.fromarray(rgb, "RGB").save(p, optimize=True)
    back = (rgb[:, :, 0].astype(np.float32) * 256 + rgb[:, :, 1]) * SCALE + E_MIN
    err = float(np.abs(back - z).max())
    km = 2 * np.pi * R_EARTH / (360 * 60)
    print("  %-18s %dx%d  %5.1f MB  %.2f km/px  decode err %.4f m"
          % (spec["file"], w, h, os.path.getsize(p) / 1048576, km, err))
    out = dict(spec)
    out.update(w=w, h=h, kmPerPx=round(km, 3), maxDecodeErrorM=round(err, 4),
               scale=SCALE, offset=E_MIN)
    return out, z


def land_fraction(z, seas):
    """Share of the tile's own box standing above the waterline. Box-relative,
    so it may only ever be quoted next to the box it was measured in."""
    return [{"seaM": s, "landFracBox": round(float((z > s).mean() * 100), 2)} for s in seas]


# Beat 05's locked frame contains the Persian Gulf, and at this beat's sea
# levels it is not a gulf. That is worth a label, so it is worth a measurement.
#
#   THE QUANTITY: the share of the box (48-57E, 24-30.5N) - the Gulf basin,
#   excluding the Gulf of Oman - standing above the waterline at sea level S.
#   A box-relative area fraction, quoted only ever next to its own box.
GULF = (48.0, 57.0, 24.0, 30.5)


def gulf_dry(f):
    z, lat, lon = read_box(f, *GULF)
    rows = [{"seaM": s, "dryFracBox": round(float((z > s).mean() * 100), 2)} for s in SEAS]
    print("  Persian Gulf box %.0f-%.0fE %.0f-%.0fN, share standing dry:" % GULF)
    for r in rows:
        print("    sea %7.1f m | %5.1f%%" % (r["seaM"], r["dryFracBox"]))
    return {"what": "Share of the Persian Gulf basin standing above the waterline.",
            "box": GULF, "definition": "Area fraction of the box above sea level S on "
                                       "ETOPO 2022 bedrock at 60 arc-seconds. Box-relative: "
                                       "quote it only next to this box.",
            "rows": rows}


def probe(lab, lat, lon, plon, plat):
    j = int(np.abs(lon - plon).argmin())
    i = int(np.abs(lat - plat).argmin())
    return int(lab[i, j])


def measure_doors(f):
    rows = []
    for d in DOORS:
        z, lat, lon = read_box(f, *d["box"])
        A, E = seed(*d["africa"]), seed(*d["eurasia"])
        print("  %-14s corridor %s  %.0f-%.0fE %.0f-%.0fN"
              % (d["label"], z.shape, d["box"][0], d["box"][1], d["box"][2], d["box"][3]))
        for sea in SEAS:
            for minpx in (1, 10, 100):
                lab, _ = ndimage.label(z > sea)
                la = probe(lab, lat, lon, *d["africa"])
                le = probe(lab, lat, lon, *d["eurasia"])
                if la == 0 or le == 0:
                    continue                          # a seed under water is not a valid probe
                if la == le:
                    # the two sides are ONE land component: the door is dry and the
                    # smallest achievable longest hop is zero, by definition
                    r = {"bottleneckKm": 0.0, "hops": 1,
                         "gapFrom": None, "gapTo": None, "dry": True}
                else:
                    r = bottleneck(z, lat, lon, sea, minpx, A, E)
                    if r is None:
                        continue
                    r["dry"] = False
                r.update(doorId=d["id"], seaM=sea, minIslandPx=minpx,
                         minIslandKm2=round(minpx * 1.855 ** 2, 1))
                rows.append(r)
                if minpx == 10:
                    print("    sea %7.1f m | islands >= %6.1f km2 | %s"
                          % (sea, r["minIslandKm2"],
                             "DRY - one land component" if r["dry"] else
                             "bottleneck %5.1f km  %s -> %s"
                             % (r["bottleneckKm"], r["gapFrom"], r["gapTo"])))
    return rows


# ------------------------------------------------------- the pale light's field
# The second population OCCUPIES; it does not travel. Routes are the wrong
# shape for that, so beat 07 reads timeline.json/ranges instead - and this turns
# the authored ring into the points the renderer actually draws, ON LAND, with
# the order they go out baked in as data rather than hidden in the film's code.
PALE_STEP = 1.9                    # degrees; ~120 points survive the land mask
PALE_SEA = -82.0                   # mid-beat sea level: land as it stood at 41 ka


def in_ring(poly, lon, lat):
    """Even-odd ray cast. Vectorised over a grid of candidate points."""
    inside = np.zeros(lon.shape, bool)
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        crosses = ((y0 > lat) != (y1 > lat))
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (x1 - x0) * (lat - y0) / (y1 - y0) + x0
        inside ^= crosses & (lon < xint)
    return inside


def pale_field(poly, z, spec):
    lonv = np.arange(spec["lon0"] + PALE_STEP, spec["lon1"], PALE_STEP)
    latv = np.arange(spec["lat0"] + PALE_STEP, spec["lat1"], PALE_STEP)
    LO, LA = np.meshgrid(lonv, latv)
    keep = in_ring(poly, LO, LA)

    # on land at the beat's own sea level. A resident population drawn into the
    # Mediterranean would be the beat's most visible lie.
    h, w = z.shape
    # build_tile has already flipped the grid north-up for the texture, so row 0
    # is lat1. Getting this upside down puts the whole population in the Sahara.
    jj = np.clip(((LO - spec["lon0"]) / (spec["lon1"] - spec["lon0"]) * w).astype(int), 0, w - 1)
    ii = np.clip(((spec["lat1"] - LA) / (spec["lat1"] - spec["lat0"]) * h).astype(int), 0, h - 1)
    keep &= (z[ii, jj] > PALE_SEA)

    lo, la = LO[keep], LA[keep]

    # The order patches go out. Three sinusoids at three orientations, which
    # interfere into a mosaic rather than a wave - a wave would say the
    # disappearance swept in one direction, and Higham 2014 says it did not.
    # Rank-normalised, so exactly one patch leaves per step and the field is
    # empty at 1.0 by construction rather than by a fade.
    f = (np.sin(lo * 0.21 + la * 0.09) +
         np.sin(lo * -0.13 + la * 0.27 + 1.7) * 0.8 +
         np.sin(lo * 0.07 - la * 0.41 + 4.1) * 0.6)
    order = np.argsort(np.argsort(f)).astype(float) / max(len(f) - 1, 1)

    # base weight: how much light a patch carries, from the same field at a
    # different phase. Nothing dated, nothing demographic - it exists so the
    # field is not a uniform stipple.
    g = 0.62 + 0.38 * (np.sin(lo * 0.17 - la * 0.23 + 2.4) * 0.5 + 0.5)

    pts = [[round(float(a), 2), round(float(b), 2), round(float(c), 4), round(float(d), 3)]
           for a, b, c, d in zip(lo, la, order, g)]
    print("  pale field: %d points on land at %.0f m, step %.1f deg" % (len(pts), PALE_SEA, PALE_STEP))
    return {
        "what": "The pale light's field: where beat 07 draws the second population.",
        "columns": ["lon", "lat", "goesOutAt", "weight"],
        "goesOutAt": "Rank in [0,1]. The renderer withdraws a patch when its threshold "
                     "function of t passes this value. It is a fixed ORDER, not a date, "
                     "and no patch carries a date.",
        "derivedFrom": "timeline.json/ranges/neanderthal-extent, sampled on a %.1f-degree "
                       "grid and masked to land above %.0f m on ETOPO 2022 bedrock."
                       % (PALE_STEP, PALE_SEA),
        "honesty": "INDICATIVE. See the polygon's own note in timeline.json. This is not a "
                   "distribution and not a site database; it is a field drawn to be "
                   "diffuse, and the on-screen label says so.",
        "seaM": PALE_SEA, "stepDeg": PALE_STEP, "points": pts,
    }


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(os.path.dirname(HERE), "timeline.json"), encoding="utf-8"))
    ring = [r for r in tl["ranges"] if r["id"] == "neanderthal-extent"][0]["polygon"]
    with h5py.File(os.path.join(HERE, "raw", "etopo_bed_60s.nc"), "r") as f:
        print("tiles:")
        rs, zrs = build_tile(REDSEA, f)
        eu, zeu = build_tile(EUROPE, f)
        rs["checks"] = land_fraction(zrs, SEAS)
        eu["checks"] = land_fraction(zeu, SEAS)
        pale = pale_field(ring, zeu, EUROPE)
        del zrs, zeu
        print("the Persian Gulf, which at this beat's sea levels is not a gulf:")
        gulf = gulf_dry(f)
        print("doors - the bottleneck definition, one corridor at a time:")
        rows = measure_doors(f)

    json.dump({"tile": rs}, open(os.path.join(OUT, "bathy_redsea.json"), "w"), indent=1)
    json.dump({"tile": eu}, open(os.path.join(OUT, "bathy_europe.json"), "w"), indent=1)
    json.dump(pale, open(os.path.join(OUT, "pale_extent.json"), "w"), indent=1)
    json.dump({
        "what": "Minimum-bottleneck water crossing out of Africa, measured separately "
                "at each of the two candidate doors.",
        "definition": "Over all island-hopping routes from the African landmass to the "
                      "Eurasian landmass THROUGH THIS CORRIDOR ONLY, the smallest "
                      "achievable longest single water hop. Identical to the Wallacea "
                      "definition, so the two numbers may be quoted in one sentence.",
        "whyCorridors": "Africa and Eurasia share one land component at every sea level in "
                        "the record, by way of Sinai. A global bottleneck is therefore 0 km "
                        "and measures nothing. Each corridor isolates one door.",
        "notMeasured": "Not the coast-to-coast width of the strait, and not a claim that "
                       "either door was the one used. timeline.json/dispersal-route is "
                       "confidence 'band': the route is unresolved and the film does not "
                       "choose.",
        "grid": "ETOPO 2022 bedrock, 60 arc-seconds. Exact great-circle distances on "
                "unit-sphere coordinates, no projection.",
        "doors": DOORS, "rows": rows, "gulf": gulf},
        open(os.path.join(OUT, "doors.json"), "w"), indent=1)
    print("done.")
