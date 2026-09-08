"""
Turn the raw environmental grids into the two textures the film reads.

  ETOPO 2022 (60 arc-sec bedrock)  ->  data/bathymetry.png    4096 x 2048, terrain-RGB
  ICE-6G_C  (1 deg, 48 slices)     ->  data/ice_atlas.png     one atlas, all time slices
                                       data/ice_index.json    slice -> kaBP mapping

Terrain-RGB encoding:  elevation_m = (R * 256 + G) * SCALE + OFFSET
That is decodable in one line of GLSL, and 0.305 m per step is far finer than
any sea-level question the film asks.

Run:  python data/build_rasters.py
"""
import json, os, gzip, glob, io as _io
import numpy as np
from PIL import Image
from scipy.io import netcdf_file

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")

W, H = 4096, 2048
E_MIN, E_MAX = -11000.0, 9000.0
SCALE = (E_MAX - E_MIN) / 65535.0
OFFSET = E_MIN


def box_resample(a, oh, ow, chunk=1024):
    """Area-average onto oh x ow across the FULL extent of a.

    THIS REPLACES A DOWNSAMPLER THAT SILENTLY MOVED THE WORLD. The old one took
    integer block factors and cropped the remainder:

        fh, fw = h // oh, w // ow          -> 10800 // 2048 = 5,  21600 // 4096 = 5
        a = a[: fh * oh, : fw * ow]        -> a[:10240, :20480]

    ETOPO at 60" is 21600 x 10800 and neither 4096 nor 2048 divides it, so there
    is no integer factor and the crop threw away 1120 columns and 560 rows -
    18.67 degrees of longitude and 9.33 of latitude. The shader went on mapping
    the result across the whole globe, so every feature was pulled east-to-west
    by up to 17 degrees: about 1,040 km at the Greenwich meridian and 1,730 km
    at 120E, which is most of the width of the Coral Sea.

    It survived a year because it is invisible to the checks that existed. The
    encode is exact and the decode is exact, so a round trip through
    terrain-RGB agrees with itself perfectly; the beat tiles are cut from the
    raw grid by explicit lon/lat bounds and so are correctly registered, and a
    close orbital shot is nearly all tile. Only the limb, and the blend at a
    tile's edge, are drawn from the global texture. See verify_registration(),
    which is the check that would have caught it: it compares the global
    texture against a tile by GEOGRAPHY rather than against itself.

    Method: a running sum along the axis, sampled at fractional cell edges by
    linear interpolation. The difference between two such samples is the exact
    integral between them, so an output cell is the true mean of the input it
    covers, partial cells included. Done in float64 - a float32 running sum over
    21600 cells of order 1e4 m loses hundreds of metres by the end of a row.

    The average is taken in index space, not weighted by cos(latitude), and
    that is deliberate: the texture is equirectangular and the shader samples it
    in lon/lat, so index space is the space the film reads it in.
    """
    def along(x, n_out):
        h, n_in = x.shape
        out = np.empty((h, n_out), dtype=np.float64)
        e = np.linspace(0.0, float(n_in), n_out + 1)
        i0 = np.minimum(np.floor(e).astype(np.int64), n_in - 1)
        f = e - i0
        de = np.diff(e)
        for r in range(0, h, chunk):
            blk = x[r:r + chunk]
            c = np.empty((blk.shape[0], n_in + 1), dtype=np.float64)
            c[:, 0] = 0.0
            np.cumsum(blk, axis=1, dtype=np.float64, out=c[:, 1:])
            v = c[:, i0] + f * (c[:, i0 + 1] - c[:, i0])
            out[r:r + chunk] = np.diff(v, axis=1) / de
        return out

    cols = along(a, ow)                                  # (h, ow)
    return along(np.ascontiguousarray(cols.T), oh).T     # (oh, ow)


def decode_png(path):
    """terrain-RGB back to metres."""
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return (a[:, :, 0] * 256.0 + a[:, :, 1]) * SCALE + OFFSET


def sample_equirect(grid, lon, lat, lon0=-180.0, lon1=180.0, lat0=-90.0, lat1=90.0):
    """Nearest cell of a north-up equirectangular grid spanning the given box."""
    h, w = grid.shape
    j = np.clip(((lon - lon0) / (lon1 - lon0) * w).astype(int), 0, w - 1)
    i = np.clip(((lat1 - lat) / (lat1 - lat0) * h).astype(int), 0, h - 1)
    return grid[i, j]


def verify_registration(tiles=("bathy_sunda", "bathy_redsea", "bathy_europe")):
    """Is the global texture where it says it is?

    THE CHECK THE OLD BUILD DID NOT HAVE, and the reason it did not have it is
    the reason the bug survived: every check in this project compared the
    project against itself. Encode/decode round-trips agree perfectly with a
    misregistered grid, because the misregistration is upstream of both.

    So this compares the global texture against a DIFFERENT representation of
    the same world: the beat tiles, which are cut straight from the raw grid by
    explicit lon/lat bounds and never pass through a resample. It does not ask
    "do the elevations match" - they cannot, the global texture is 5.3x coarser
    and a coastline will disagree by kilometres of relief. It asks where the
    agreement is BEST: it scans trial offsets in longitude and latitude and
    requires the minimum to sit at zero. That isolates registration from
    resolution, which is the only way to make the question answerable.
    """
    import json as _json
    tiledir = os.path.join(os.path.dirname(HERE), "slice", "data")
    g = decode_png(os.path.join(HERE, "bathymetry.png"))
    ok = True
    print("  registration, against tiles cut straight from the raw grid:")
    for t in tiles:
        meta_p = os.path.join(tiledir, t + ".json")
        png_p = os.path.join(tiledir, t + ".png")
        if not (os.path.exists(meta_p) and os.path.exists(png_p)):
            print("    SKIP %s - not built" % t)
            continue
        m = _json.load(open(meta_p, encoding="utf-8"))["tile"]
        tg = decode_png(png_p)
        # sample well inside the tile, so a trial offset stays in bounds
        pad = 2.0
        lo = np.linspace(m["lon0"] + pad, m["lon1"] - pad, 40)
        la = np.linspace(m["lat0"] + pad, m["lat1"] - pad, 40)
        LO, LA = np.meshgrid(lo, la)
        ref = sample_equirect(tg, LO, LA, m["lon0"], m["lon1"], m["lat0"], m["lat1"])
        best, at = None, None
        for dlon in np.arange(-20.0, 20.01, 0.5):
            for dlat in np.arange(-12.0, 12.01, 0.5):
                got = sample_equirect(g, LO + dlon, LA + dlat)
                r = float(np.sqrt(np.mean((got - ref) ** 2)))
                if best is None or r < best:
                    best, at = r, (dlon, dlat)
        good = abs(at[0]) < 0.5 and abs(at[1]) < 0.5
        ok = ok and good
        print("    %-14s best agreement at dlon %+5.1f  dlat %+5.1f   rms %8.1f m   %s"
              % (t, at[0], at[1], best, "ok" if good else "MISREGISTERED"))
    print("  registration: %s" % ("PASS" if ok else "FAIL"))
    return ok


def build_bathymetry():
    src = os.path.join(RAW, "etopo_bed_60s.nc")
    if not os.path.exists(src):
        print("SKIP bathymetry — %s not present" % src)
        return
    import h5py
    with h5py.File(src, "r") as f:
        name = "z" if "z" in f else [k for k in f.keys() if f[k].ndim == 2][0]
        z = np.asarray(f[name][:], dtype=np.float32)
        lat = np.asarray(f["lat"][:]) if "lat" in f else None
    print("  source grid %s  min %.0f  max %.0f m" % (z.shape, z.min(), z.max()))

    # ETOPO ships south-up; the film's texture is north-up.
    if lat is not None and lat[0] < lat[-1]:
        z = z[::-1, :]

    small = box_resample(z, H, W)
    print("  resampled to %s over the full extent" % (small.shape,))

    q = np.clip((small - OFFSET) / SCALE, 0, 65535).astype(np.uint16)
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    rgb[:, :, 0] = (q >> 8).astype(np.uint8)
    rgb[:, :, 1] = (q & 0xFF).astype(np.uint8)
    out = os.path.join(HERE, "bathymetry.png")
    Image.fromarray(rgb, "RGB").save(out, optimize=True)

    # verify the round-trip at a few real depths
    back = (rgb[:, :, 0].astype(np.float32) * 256 + rgb[:, :, 1]) * SCALE + OFFSET
    err = float(np.abs(back - small).max())
    land_now = float((small > 0).mean() * 100)
    land_lgm = float((small > -130).mean() * 100)
    print("  wrote %s  (%.1f MB)" % (out, os.path.getsize(out) / 1048576))
    print("  max decode error %.3f m" % err)
    print("  land above  0 m: %.1f%% of grid" % land_now)
    print("  land above -130 m (LGM lowstand): %.1f%%  <- the shelf the film exposes" % land_lgm)
    return {"scale": SCALE, "offset": OFFSET, "w": W, "h": H, "maxDecodeErrorM": round(err, 4),
            "landFracNow": round(land_now, 2), "landFracLGM": round(land_lgm, 2)}


def build_ice():
    files = sorted(glob.glob(os.path.join(RAW, "ice6g", "*.nc.gz")))
    if not files:
        print("SKIP ice — no slices in %s" % os.path.join(RAW, "ice6g"))
        return
    slices = []
    for p in files:
        base = os.path.basename(p)
        ka = base.replace("I6_C.VM5a_1deg.", "").replace(".nc.gz", "")
        try:
            ka = float(ka)
        except ValueError:
            continue
        with gzip.open(p, "rb") as g:
            nc = netcdf_file(_io.BytesIO(g.read()), "r", mmap=False)
            frac = np.asarray(nc.variables["sftgif"][:], dtype=np.float32)  # % ice covered
            lat = np.asarray(nc.variables["lat"][:])
        if lat[0] < lat[-1]:
            frac = frac[::-1, :]
        frac = np.roll(frac, frac.shape[1] // 2, axis=1)   # 0..360 -> -180..180
        slices.append((ka, frac))

    slices.sort(key=lambda s: -s[0])                        # oldest first
    n = len(slices)
    cols = 8
    rows = (n + cols - 1) // cols
    sh, sw = slices[0][1].shape
    atlas = np.zeros((rows * sh, cols * sw), dtype=np.uint8)
    for i, (ka, frac) in enumerate(slices):
        r, c = divmod(i, cols)
        atlas[r * sh:(r + 1) * sh, c * sw:(c + 1) * sw] = np.clip(frac * 2.55, 0, 255).astype(np.uint8)

    out = os.path.join(HERE, "ice_atlas.png")
    Image.fromarray(atlas, "L").save(out, optimize=True)
    idx = {"cols": cols, "rows": rows, "tileW": int(sw), "tileH": int(sh),
           "slices": [{"i": i, "kaBP": s[0], "iceFrac": round(float((s[1] > 50).mean() * 100), 2)}
                      for i, s in enumerate(slices)],
           "note": "Grayscale = percent ice cover, 255 = 100%. Tiles are oldest-first, row-major. Crossfade adjacent tiles on t."}
    json.dump(idx, open(os.path.join(HERE, "ice_index.json"), "w"), indent=1)
    print("  wrote %s  (%d slices, %.0f KB)" % (out, n, os.path.getsize(out) / 1024))
    print("  span %.1f - %.1f ka BP" % (slices[0][0], slices[-1][0]))
    print("  ice cover at %.0f ka: %.1f%%   at 0 ka: %.1f%%"
          % (slices[0][0], idx["slices"][0]["iceFrac"], idx["slices"][-1]["iceFrac"]))
    return idx


if __name__ == "__main__":
    print("bathymetry:")
    b = build_bathymetry()
    print("ice:")
    i = build_ice()
    if b:
        json.dump(b, open(os.path.join(HERE, "bathymetry_meta.json"), "w"), indent=1)
    print("verify:")
    verify_registration()
    print("done.")
