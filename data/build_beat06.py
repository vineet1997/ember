"""
Beat 06 needs a sharper earth than the global 4096-wide texture can give it.

Wallacea is the subject: straits 70-100 km wide between islands a few tens of
kilometres across. At 4096x2048 a pixel is 9.8 km and the straits are mush.
This crops the SAME ETOPO 2022 bedrock grid at its native 60" (1.85 km) over
the beat's frame and writes a second terrain-RGB texture. The shader samples
the tile inside the box and the global texture outside it, crossfading over a
2-degree margin - both encode the same field, so the seam is invisible.

Also verifies, on the real grid at the beat's own sea levels, the three
geographic claims the beat puts on screen:
    Sunda fuses to the mainland
    Sahul fuses Australia and New Guinea
    Wallacea never closes

Run:  python data/build_beat06.py
"""
import json, os
import numpy as np
import h5py
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(os.path.dirname(HERE), "slice", "data")

# render tile - the beat's frame, at native resolution
LON0, LON1 = 92.0, 156.0
LAT0, LAT1 = -30.0, 22.0

# connectivity box - wider, so Tasmania and mainland Asia are inside the test
CLON0, CLON1 = 90.0, 160.0
CLAT0, CLAT1 = -50.0, 30.0

E_MIN, E_MAX = -11000.0, 9000.0
SCALE = (E_MAX - E_MIN) / 65535.0

R_EARTH = 6371.0088


def read_box(f, lon0, lon1, lat0, lat1):
    lat = f["lat"][:]; lon = f["lon"][:]
    i0 = int(np.searchsorted(lat, lat0)); i1 = int(np.searchsorted(lat, lat1))
    j0 = int(np.searchsorted(lon, lon0)); j1 = int(np.searchsorted(lon, lon1))
    z = np.asarray(f["z"][i0:i1, j0:j1], dtype=np.float32)
    return z, lat[i0:i1], lon[j0:j1]


def build_tile():
    with h5py.File(os.path.join(HERE, "raw", "etopo_bed_60s.nc"), "r") as f:
        z, lat, lon = read_box(f, LON0, LON1, LAT0, LAT1)
    z = z[::-1, :]                                   # source is south-up; texture is north-up
    h, w = z.shape
    q = np.clip((z - E_MIN) / SCALE, 0, 65535).astype(np.uint16)
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    p = os.path.join(OUT, "bathy_sunda.png")
    Image.fromarray(rgb, "RGB").save(p, optimize=True)
    back = (rgb[:, :, 0].astype(np.float32) * 256 + rgb[:, :, 1]) * SCALE + E_MIN
    err = float(np.abs(back - z).max())
    km = 2 * np.pi * R_EARTH / (360 * 60)
    print("  tile %dx%d  %.1f MB  %.2f km/px  decode err %.3f m"
          % (w, h, os.path.getsize(p) / 1048576, km, err))
    return {"file": "bathy_sunda.png", "w": w, "h": h,
            "lon0": LON0, "lon1": LON1, "lat0": LAT0, "lat1": LAT1,
            "kmPerPx": round(km, 3), "maxDecodeErrorM": round(err, 4),
            "scale": SCALE, "offset": E_MIN}


def label_at(lab, lat, lon, plon, plat):
    j = int(np.abs(lon - plon).argmin()); i = int(np.abs(lat - plat).argmin())
    return int(lab[i, j])


def coast_xyz(mask, lat, lon):
    """Unit-sphere coordinates of the land pixels that touch water."""
    edge = mask & ~ndimage.binary_erosion(mask)
    i, j = np.nonzero(edge)
    la = np.radians(lat[i]); lo = np.radians(lon[j])
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], 1)


PROBES = {
    "mainland Asia": (100.0, 15.0),      # Thailand
    "Sumatra":       (102.0, -0.5),
    "Borneo":        (114.0, 1.0),
    "Java":          (110.0, -7.2),
    "Sulawesi":      (120.0, -2.0),
    "Timor":         (125.5, -9.0),
    "New Guinea":    (141.0, -5.5),
    "Australia":     (134.0, -25.0),
    "Tasmania":      (146.5, -42.0),
}


def verify(seas):
    with h5py.File(os.path.join(HERE, "raw", "etopo_bed_60s.nc"), "r") as f:
        z, lat, lon = read_box(f, CLON0, CLON1, CLAT0, CLAT1)
    print("  connectivity grid %s  (%.0f-%.0fE, %.0f-%.0fN)" % (z.shape, CLON0, CLON1, CLAT0, CLAT1))
    rows = []
    for sea in seas:
        land = z > sea
        lab, _ = ndimage.label(land)                  # 4-connectivity: a bridge must be land
        comp = {k: label_at(lab, lat, lon, *v) for k, v in PROBES.items()}
        sunda_id = comp["mainland Asia"]
        sahul_id = comp["Australia"]
        sunda = {k for k, v in comp.items() if v == sunda_id and v != 0}
        sahul = {k for k, v in comp.items() if v == sahul_id and v != 0}
        a = coast_xyz(lab == sunda_id, lat, lon)
        b = coast_xyz(lab == sahul_id, lat, lon)
        d, _ = cKDTree(b).query(a, k=1)               # chord length on the unit sphere
        chord = float(d.min())
        gap = 2 * R_EARTH * np.arcsin(min(1.0, chord / 2))
        rows.append({"seaM": sea, "sunda": sorted(sunda), "sahul": sorted(sahul),
                     "wallaceaGapKm": round(gap, 1),
                     "landFracBox": round(float(land.mean() * 100), 2)})
        print("    sea %7.1f m | Sunda %-46s | Sahul %-34s | gap %5.1f km"
              % (sea, "+".join(sorted(sunda)), "+".join(sorted(sahul)), gap))
    return rows


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("tile:")
    tile = build_tile()
    print("verify (the beat's own sea levels, from data/sealevel_merged.json):")
    checks = verify([0.0, -68.3, -73.9, -77.0, -85.0, -131.0])
    json.dump({"tile": tile, "checks": checks,
               "note": "Gap is the great-circle distance between the coastlines of the "
                       "component containing mainland Asia and the component containing "
                       "Australia, on ETOPO 2022 bedrock at 60 arc-seconds."},
              open(os.path.join(OUT, "bathy_sunda.json"), "w"), indent=1)
    print("done.")
