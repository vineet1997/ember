"""
Build the film's sea-level curve from two published sources, spliced.

  300 - 26 ka : Spratt & Lisiecki 2016 PCA stack        1 ka resolution
   26 -  0 ka : ICE-6G_C (VM5a) paleotopography         0.5 ka resolution

The deglacial half is derived, not downloaded: in far-field deep ocean the
ICE-6G variable Topo_Diff is the negative of relative sea level, so the median
of Topo_Diff over deep tropical ocean gives eustatic sea level per time slice.

That replaces the Lambeck 2014 splice the project had been waiting on, and it
is better than a splice would have been: the sea-level curve and the ice-sheet
atlas now come out of one model, so the coastline and the ice can never
disagree with each other.

Two things it fixes outright:
  * The Spratt stack reads +8.5 m at present, a smoothing artifact. ICE-6G
    reads 0.0 m, because present is its zero by construction.
  * Its lowstand of -135.3 m at 26 ka sits 1.3 m from Lambeck's published -134 m.

Run:  python data/build_sealevel.py
"""
import json, io, os, gzip, glob
import numpy as np
from scipy.io import netcdf_file

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = (30000, 24000)          # linear crossfade window, years BP


def ice6g_curve():
    out = []
    for p in sorted(glob.glob(os.path.join(HERE, "raw", "ice6g", "*.nc.gz"))):
        stem = os.path.basename(p).replace("I6_C.VM5a_1deg.", "").replace(".nc.gz", "")
        try:
            ka = float(stem)
        except ValueError:
            continue
        with gzip.open(p, "rb") as g:
            nc = netcdf_file(io.BytesIO(g.read()), "r", mmap=False)
            td = np.asarray(nc.variables["Topo_Diff"][:], dtype=np.float32)
            topo = np.asarray(nc.variables["Topo"][:], dtype=np.float32)
            lat = np.asarray(nc.variables["lat"][:])
        la = np.repeat(lat[:, None], td.shape[1], axis=1)
        deep = (topo < -3000) & (np.abs(la) < 30)      # far-field, away from ice loading
        out.append([int(ka * 1000), round(float(-np.median(td[deep])), 2)])
    out.sort()
    return out


def main():
    sl = json.load(io.open(os.path.join(HERE, "sealevel.json"), encoding="utf-8"))
    spratt = [[int(r["kaBP"] * 1000), r["m"]] for r in sl["series"] if r["m"] is not None]
    spratt.sort()
    ice = ice6g_curve()
    iceD = dict(ice)
    sprattD = dict(spratt)

    def s_at(y):
        ks = sorted(sprattD)
        if y <= ks[0]: return sprattD[ks[0]]
        if y >= ks[-1]: return sprattD[ks[-1]]
        lo = max(k for k in ks if k <= y); hi = min(k for k in ks if k >= y)
        if lo == hi: return sprattD[lo]
        f = (y - lo) / (hi - lo)
        return sprattD[lo] + (sprattD[hi] - sprattD[lo]) * f

    def i_at(y):
        ks = sorted(iceD)
        if y <= ks[0]: return iceD[ks[0]]
        if y >= ks[-1]: return iceD[ks[-1]]
        lo = max(k for k in ks if k <= y); hi = min(k for k in ks if k >= y)
        if lo == hi: return iceD[lo]
        f = (y - lo) / (hi - lo)
        return iceD[lo] + (iceD[hi] - iceD[lo]) * f

    years = sorted(set([y for y, _ in ice] + [y for y, _ in spratt if y >= 20000]))
    series = []
    for y in years:
        if y >= BLEND[0]:
            v, src = s_at(y), "spratt"
        elif y <= BLEND[1]:
            v, src = i_at(y), "ice6g"
        else:
            f = (BLEND[0] - y) / (BLEND[0] - BLEND[1])          # 0 at 30 ka -> 1 at 24 ka
            v, src = s_at(y) * (1 - f) + i_at(y) * f, "blend"
        series.append({"yrBP": y, "m": round(v, 2), "src": src})

    lowest = min(series, key=lambda r: r["m"])
    at0 = [r for r in series if r["yrBP"] == 0]
    gap = round(abs(s_at(27000) - i_at(27000)), 1)

    doc = {
        "_readme": {
            "what": "Global mean sea level relative to present. The curve that generates every coastline in the film.",
            "law01": "Read-only input to t. Nothing here is authored.",
            "splice": "300-26 ka from the Spratt & Lisiecki stack; 26-0 ka derived from ICE-6G_C paleotopography; linear crossfade between 30 and 24 ka.",
            "whyDerived": ("Lambeck 2014's supplementary table is behind a bot block and could not be fetched. It turned out not to be needed: "
                           "ICE-6G_C already encodes relative sea level in Topo_Diff, and taking its median over far-field deep tropical ocean "
                           "recovers the eustatic curve at 0.5 ka resolution. Better than a Lambeck splice would have been, because the sea level "
                           "and the ice sheets now come from ONE model and cannot contradict each other."),
            "resolutionCaveat": ("0.5 ka through the deglacial. Meltwater Pulse 1A lasted about 340 years, so it appears as a steep segment rather "
                                 "than a resolved event. That is acceptable because the film's fast climate signal comes from the 20-year "
                                 "temperature channel; sea level only has to move the coastline."),
            "units": "yrBP = calendar years before present (1950). m = metres relative to present."
        },
        "sources": {
            "spratt2016": "Spratt, R. M. & Lisiecki, L. E. (2016). A Late Pleistocene sea level stack. Climate of the Past 12, 1079-1092.",
            "ice6g": "Peltier, W. R., Argus, D. F. & Drummond, R. (2015). ICE-6G_C (VM5a). J. Geophys. Res. Solid Earth 120, 450-487.",
            "checked": "downloaded-2026-09-06"
        },
        "checks": {
            "lowstand_m": lowest["m"], "lowstand_yrBP": lowest["yrBP"],
            "lambeckPublished_m": -134.0,
            "agreementWithLambeck_m": round(abs(lowstand_diff := lowest["m"] + 134.0), 2),
            "presentValue_m": at0[0]["m"] if at0 else None,
            "sprattPresentArtifact_m": 8.49,
            "spliceGapAt27ka_m": gap
        },
        "series": series
    }
    out = os.path.join(HERE, "sealevel_merged.json")
    json.dump(doc, io.open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print("points %d   span %d - %d BP" % (len(series), series[0]["yrBP"], series[-1]["yrBP"]))
    print("lowstand  %.1f m at %d BP   (Lambeck published -134 m -> agrees to %.1f m)"
          % (lowest["m"], lowest["yrBP"], abs(lowest["m"] + 134.0)))
    print("present   %.2f m            (Spratt artifact was +8.49 m)" % (at0[0]["m"] if at0 else float("nan")))
    print("splice gap at 27 ka: %.1f m, crossfaded 30->24 ka" % gap)
    for y in (26000, 20000, 16000, 14500, 14000, 12000, 8000, 5000, 0):
        r = [x for x in series if x["yrBP"] == y]
        if r: print("  %6d BP  %+8.2f m  [%s]" % (y, r[0]["m"], r[0]["src"]))
    print("wrote %s" % out)


if __name__ == "__main__":
    main()
