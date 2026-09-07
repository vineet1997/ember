"""
Law 07 check on the beat's central claim.

The storyboard says Wallacea "never bridged - a minimum of roughly 70-100 km of
open sea at any sea level." That is NOT the distance between Sunda and Sahul.
It is the BOTTLENECK: over every possible island-hopping route from the Sunda
shelf to Sahul, the shortest achievable longest single hop. Any crossing, by
any route, must include at least one water gap this wide.

First attempt measured coastline-to-coastline between the two continents and
got 994 km, which is a different quantity and would have put a wrong number on
screen. This measures the bottleneck.

Method, on ETOPO 2022 bedrock at 60":
  1. label every land component at the given sea level
  2. Euclidean-Voronoi pass over the water finds which component pairs are
     ever nearest-neighbours, i.e. the candidate hops (a few hundred, not N^2)
  3. for each candidate pair, the exact great-circle minimum between their
     coastlines, from a KD-tree on unit-sphere coordinates - no projection
  4. union-find over hops in ascending order; the hop that first joins Sunda
     to Sahul IS the bottleneck, and the chain it completes is the route

Run:  python data/verify_wallacea.py
"""
import json, os
import numpy as np
import h5py
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(os.path.dirname(HERE), "slice", "data")
R    = 6371.0088

# the crossing corridor: wide enough for both the northern (Sulawesi - Spice
# Islands - New Guinea) and southern (Java - Nusa Tenggara - Timor) routes
BOX = (105.0, 152.0, -16.0, 8.0)

SUNDA_SEED = (100.0, 15.0)      # mainland Asia, reached through the Sunda shelf
SAHUL_SEED = (140.0, -6.0)      # New Guinea, which is Sahul at every sea level tested
WIDE = (90.0, 160.0, -50.0, 30.0)


def read_box(f, lon0, lon1, lat0, lat1):
    lat = f["lat"][:]; lon = f["lon"][:]
    i0, i1 = int(np.searchsorted(lat, lat0)), int(np.searchsorted(lat, lat1))
    j0, j1 = int(np.searchsorted(lon, lon0)), int(np.searchsorted(lon, lon1))
    return np.asarray(f["z"][i0:i1, j0:j1], np.float32), lat[i0:i1], lon[j0:j1]


def xyz(la, lo):
    la, lo = np.radians(la), np.radians(lo)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def gc(chord):
    return 2 * R * np.arcsin(np.clip(chord / 2, 0, 1))


class UF:
    def __init__(s, n): s.p = list(range(n))
    def find(s, a):
        while s.p[a] != a: s.p[a] = s.p[s.p[a]]; a = s.p[a]
        return a
    def union(s, a, b):
        a, b = s.find(a), s.find(b)
        if a == b: return False
        s.p[a] = b; return True


def bottleneck(z, lat, lon, sea, minpx, sunda_lbl_at, sahul_lbl_at):
    land = z > sea
    lab, n = ndimage.label(land)
    if minpx > 1:                                    # drop specks that would be false stepping stones
        sizes = np.bincount(lab.ravel())
        keep = sizes >= minpx; keep[0] = False
        lab = np.where(keep[lab], lab, 0)
    ids = np.unique(lab); ids = ids[ids != 0]
    idx = {int(v): i for i, v in enumerate(ids)}

    # 1. Voronoi over the water -> which components are ever nearest neighbours
    _, ind = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    near = lab[ind[0], ind[1]]
    acc = []
    for a, b in ((near[:, :-1], near[:, 1:]), (near[:-1, :], near[1:, :])):
        m = (a != b) & (a != 0) & (b != 0)
        u, v = a[m], b[m]
        acc.append(np.stack([np.minimum(u, v), np.maximum(u, v)], 1))
    cand = np.unique(np.concatenate(acc), axis=0)

    # 2. exact great-circle minimum for each candidate hop
    # coastline of every component in one pass; components are water-separated,
    # so eroding the union is the same as eroding each one
    land_l = lab != 0
    edgemask = land_l & ~ndimage.binary_erosion(land_l)
    ei, ej = np.nonzero(edgemask)
    elab = lab[ei, ej]
    order = np.argsort(elab, kind="stable")
    ei, ej, elab = ei[order], ej[order], elab[order]
    starts = np.searchsorted(elab, ids, "left")
    ends = np.searchsorted(elab, ids, "right")
    span = {int(c): (int(a), int(b)) for c, a, b in zip(ids, starts, ends)}
    EL, EO = lat[ei], lon[ej]
    P3 = xyz(EL, EO)

    trees = {}
    def tree_for(c):
        if c not in trees:
            a, b = span[c]
            trees[c] = cKDTree(P3[a:b])
        return trees[c]

    edges = []
    for u, v in cand:
        u, v = int(u), int(v)
        au, bu = span[u]; av, bv = span[v]
        d, k = tree_for(u).query(P3[av:bv], k=1)
        a = int(d.argmin()); ku = au + int(k[a]); kv = av + a
        edges.append((gc(float(d[a])), u, v,
                      (float(EO[kv]), float(EL[kv])), (float(EO[ku]), float(EL[ku]))))
    edges.sort(key=lambda e: e[0])

    # 3. union-find in ascending order; first hop to join the two sides is the bottleneck
    su, sa = sunda_lbl_at(lab, lat, lon), sahul_lbl_at(lab, lat, lon)
    if su == 0 or sa == 0: return None
    uf, chain = UF(len(ids) + 1), []
    for d, u, v, pv, pu in edges:
        uf.union(idx[u], idx[v]); chain.append((d, u, v, pv, pu))
        if uf.find(idx[su]) == uf.find(idx[sa]):
            return {"bottleneckKm": round(d, 1), "hops": len(ids),
                    "gapFrom": [round(pu[0], 3), round(pu[1], 3)],
                    "gapTo":   [round(pv[0], 3), round(pv[1], 3)]}
    return None


def seed(plon, plat):
    def f(lab, lat, lon):
        j = int(np.abs(lon - plon).argmin()); i = int(np.abs(lat - plat).argmin())
        return int(lab[i, j])
    return f


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    with h5py.File(os.path.join(HERE, "raw", "etopo_bed_60s.nc"), "r") as f:
        z, lat, lon = read_box(f, *BOX)
    print("corridor %s  %.0f-%.0fE %.0f-%.0fN" % (z.shape, BOX[0], BOX[1], BOX[2], BOX[3]))
    # inside the corridor, the Sunda side is reached via Borneo and the Sahul side via New Guinea
    S, A = seed(114.0, 1.0), seed(140.0, -6.0)
    rows = []
    for sea in (0.0, -68.3, -73.9, -77.0, -85.0, -131.0):
        for minpx in (1, 10, 100):
            r = bottleneck(z, lat, lon, sea, minpx, S, A)
            if r is None: continue
            r.update(seaM=sea, minIslandPx=minpx,
                     minIslandKm2=round(minpx * 1.855 ** 2, 1))
            rows.append(r)
            print("  sea %7.1f m | islands >= %6.1f km2 | bottleneck %5.1f km | %s -> %s"
                  % (sea, r["minIslandKm2"], r["bottleneckKm"], r["gapFrom"], r["gapTo"]))
    json.dump({
        "what": "Minimum-bottleneck water crossing from the Sunda shelf to Sahul.",
        "definition": "Over all island-hopping routes, the smallest achievable longest single "
                      "hop. Any crossing by any route must include a gap at least this wide.",
        "grid": "ETOPO 2022 bedrock, 60 arc-seconds, corridor %s" % (BOX,),
        "distances": "Exact great-circle on unit-sphere coordinates. No projection.",
        "notMeasured": "This is NOT the Sunda-to-Sahul coastline distance, which is ~994 km "
                       "at -74 m and is a different quantity.",
        "rows": rows}, open(os.path.join(OUT, "wallacea_gap.json"), "w"), indent=1)
    print("done.")
